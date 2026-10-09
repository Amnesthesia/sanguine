// Encrypted backup (PLAN.md §6.3): passphrase + device secret. The recovery code is shown once, before the file leaves the phone.
import { BackupError, recoveryWordsToSecret, secretToRecoveryWords as recoveryCodeFor } from '@sanguine/crypto';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { createBackup } from '@/data/backup';
import { deviceClock, todayLocal } from '@/services/clock';
import { getDeviceSecret, getOrCreateDeviceSecret } from '@/services/secrets';
import { pickBackupBytes as pickAndRestoreBytes } from '@/services/backup';
import { backupCrypto, nativeArgon2 } from '@/services/argon2';
import { BACKUP_NAME, BACKUP_PREV, type CloudStore, cloudServiceName, disableAutoBackup, enableAutoBackup, getCloudStore, uploadCloudIfDue } from '@/services/cloud';
import { getSetting, setSetting } from '@/data/settings';
import { restoreBackup } from '@/data/backup';
import { SwitchRow, Group } from '@/ui/SettingsRow';
import { shareFile } from '@/services/shareFile';
import { NoCapture } from '@/features/lock/ScreenProtection';
import { useApp } from '@/state/app';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Segmented } from '@/ui/Segmented';
import { SubScreen } from '@/ui/SubScreen';
import { TextField } from '@/ui/TextField';
import { Text } from '@/ui/Text';

const MIN_PASSPHRASE = 8;

export default function BackupScreen() {
  const { t } = useTranslation();
  const { db, store, refresh, prefs, updatePrefs } = useApp();
  const [cloud, setCloud] = useState<CloudStore | null>(null);
  const [lastUpload, setLastUpload] = useState<string | null>(null);
  const [mode, setMode] = useState<'create' | 'restore'>('create');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [code, setCode] = useState('');
  const [pct, setPct] = useState<number | undefined>();
  const [msg, setMsg] = useState<string | undefined>();
  const [pending, setPending] = useState<{ words: string; next: () => Promise<void> } | undefined>();
  const service = cloud ? cloudServiceName(cloud) : '';
  useEffect(() => { void getCloudStore().then(setCloud); }, []);
  const reloadLast = () => { if (db) void getSetting<string | null>(db, 'cloud.lastUploadAt', null).then(setLastUpload); };
  useEffect(reloadLast, [db]);

  async function create() {
    if (!db || !store) return;
    if (pass.length < MIN_PASSPHRASE) return setMsg(t('settings.privacy.passphraseTooShort'));
    if (pass !== pass2) return setMsg(t('settings.privacy.passphraseMismatch'));
    setMsg(undefined);
    setPct(0);
    try {
      const started = Date.now();
      const { secret, created } = await getOrCreateDeviceSecret();
      const bytes = await createBackup(db, store, { passphrase: pass, deviceSecret: secret, clock: deviceClock, ...backupCrypto(), onProgress: (f) => setPct(Math.round(f * 100)) });
      if (__DEV__) console.log(`[backup] sealed ${bytes.length} bytes in ${Date.now() - started} ms`);
      const share = async () => { await shareFile(bytes, `sanguine-backup-${todayLocal()}.sgb`, 'application/octet-stream'); setMsg(t('settings.privacy.backupReady')); };
      // the code is shown until the person has confirmed they saved it, even if they left this screen the first time
      if (created || !(await getSetting(db, 'recoveryShown', false))) setPending({ words: recoveryCodeFor(secret), next: share });
      else await share();
    } catch (e) { setMsg((e as Error).message); } finally { setPct(undefined); setPass(''); setPass2(''); }
  }
  async function restoreWith(getBytes: () => Promise<Uint8Array | null>, fromCloud = false) {
    if (!db || !store) return;
    setMsg(undefined);
    try {
      let secret = await getDeviceSecret();
      if (code.trim()) {
        const fromCode = recoveryWordsToSecret(code);
        if (!fromCode) return setMsg(t('settings.privacy.restoreBadCode'));
        secret = fromCode;
      }
      if (!secret) return setMsg(t('settings.privacy.restoreNeedCode'));
      setPct(0);
      const bytes = await getBytes();
      if (!bytes) return fromCloud ? setMsg(t('settings.privacy.cloud.none', { service })) : undefined;
      const r = await restoreBackup(db, store, bytes, pass, secret, (f) => setPct(Math.round(f * 100)), nativeArgon2() ?? undefined);
      await refresh();
      setMsg(t('settings.privacy.importDone', { n: r.imported }));
    } catch (e) {
      setMsg(e instanceof BackupError && e.code === 'auth' ? t('settings.privacy.restoreWrongPassphrase') : (e as Error).message);
    } finally { setPct(undefined); setPass(''); setCode(''); }
  }
  const restore = () => restoreWith(pickAndRestoreBytes);
  const restoreFromCloud = () => restoreWith(async () => (cloud ? cloud.get(BACKUP_NAME) : null), true);

  /** Turns the automatic copy on or off. On needs the passphrase once (the slow key derivation runs here, not at every upload). */
  async function toggleCloud(on: boolean) {
    if (!db || !store || !cloud) return;
    setMsg(undefined);
    if (!on) {
      await disableAutoBackup();
      await updatePrefs({ cloudBackup: false });
      return setMsg(t('settings.privacy.cloud.off', { service }));
    }
    if (pass.length < MIN_PASSPHRASE) return setMsg(t('settings.privacy.cloud.needPass'));
    const enable = async () => {
      try {
        setPct(0);
        await enableAutoBackup(pass, (f) => setPct(Math.round(f * 100)));
        await updatePrefs({ cloudBackup: true });
        const r = await uploadCloudIfDue(db, store, true);
        setMsg(r === 'failed' ? t('settings.privacy.cloud.failed', { service }) : r === 'skipped' ? t('settings.privacy.cloud.waitingWifi') : t('settings.privacy.cloud.uploaded', { service }));
        reloadLast();
      } catch (e) { setMsg((e as Error).message); } finally { setPct(undefined); setPass(''); setPass2(''); }
    };
    const { secret, created } = await getOrCreateDeviceSecret();
    if (created || !(await getSetting(db, 'recoveryShown', false))) setPending({ words: recoveryCodeFor(secret), next: enable });
    else await enable();
  }
  async function uploadNow() {
    if (!db || !store || !cloud) return;
    if (pass.length < MIN_PASSPHRASE) return setMsg(t('settings.privacy.cloud.needPass'));
    setMsg(undefined);
    try {
      setPct(0);
      const { secret } = await getOrCreateDeviceSecret();
      const bytes = await createBackup(db, store, { passphrase: pass, deviceSecret: secret, clock: deviceClock, ...backupCrypto(), onProgress: (f) => setPct(Math.round(f * 100)) });
      const previous = await cloud.get(BACKUP_NAME);
      if (previous) await cloud.put(BACKUP_PREV, previous);
      await cloud.put(BACKUP_NAME, bytes);
      await setSetting(db, 'cloud.lastUploadAt', new Date().toISOString());
      setMsg(t('settings.privacy.cloud.uploaded', { service }));
      reloadLast();
    } catch { setMsg(t('settings.privacy.cloud.failed', { service })); } finally { setPct(undefined); setPass(''); setPass2(''); }
  }

  if (pending) {
    return (
      <SubScreen testID="screen-recovery" title={t('settings.privacy.recoveryCode.title')}>
        <NoCapture />
        <Card testID="recovery-words">
          <Text variant="heading">{t('settings.privacy.recoveryCode.words')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {/* biome-ignore lint/suspicious/noArrayIndexKey: words can repeat; the position is the identity */}
            {pending.words.split(' ').map((w, i) => <Text key={`${i}-${w}`} variant="body" tabular style={{ width: '45%' }}>{`${i + 1}. ${w}`}</Text>)}
          </View>
        </Card>
        <Text variant="bodySmall" color="textSecondary">{t('settings.privacy.recoveryCode.body')}</Text>
        <Button testID="recovery-saved" label={t('settings.privacy.recoveryCode.saved')} onPress={() => void (async () => {
          const p = pending;
          setPending(undefined);
          if (db) await setSetting(db, 'recoveryShown', true);
          await p.next();
        })()} />
      </SubScreen>
    );
  }
  return (
    <SubScreen testID="screen-backup" title={t('settings.privacy.backup')}>
      <Segmented testIDPrefix="backup-mode" value={mode} onChange={(m) => { setMode(m); setMsg(undefined); }} options={[{ value: 'create', label: t('settings.privacy.backupCreate') }, { value: 'restore', label: t('settings.privacy.backupRestore') }]} />
      <Text variant="bodySmall" color="textSecondary">{t('settings.privacy.backupNote')}</Text>
      <TextField testID="backup-pass" secure label={t('settings.privacy.passphrase')} value={pass} onChangeText={setPass} keyboardType="default" />
      {mode === 'create' ? <TextField testID="backup-pass2" secure label={t('settings.privacy.passphraseConfirm')} value={pass2} onChangeText={setPass2} keyboardType="default" /> : <TextField testID="restore-code" secure label={t('settings.privacy.restoreCodeLabel')} value={code} onChangeText={setCode} keyboardType="default" />}
      <Button testID={mode === 'create' ? 'backup-create' : 'backup-restore'} label={mode === 'create' ? t('settings.privacy.backupCreate') : t('settings.privacy.restorePick')} disabled={pct !== undefined || pass.length === 0} onPress={() => void (mode === 'create' ? create() : restore())} />
      {cloud && mode === 'create' ? (
        <Group title={t('settings.privacy.cloud.title')}>
          <SwitchRow testID="cloud-switch" title={t('settings.privacy.cloud.switch', { service })} description={t('settings.privacy.cloud.switchDesc')} value={prefs.cloudBackup} onChange={(v) => void toggleCloud(v)} disabled={pct !== undefined} last />
        </Group>
      ) : null}
      {cloud && mode === 'create' ? <Button testID="cloud-upload-now" kind="secondary" label={t('settings.privacy.cloud.uploadNow')} disabled={pct !== undefined || pass.length === 0} onPress={() => void uploadNow()} /> : null}
      {cloud && mode === 'restore' ? <Button testID="cloud-restore" kind="secondary" label={t('settings.privacy.cloud.restore', { service })} disabled={pct !== undefined || pass.length === 0} onPress={() => void restoreFromCloud()} /> : null}
      {cloud && lastUpload ? <Text testID="cloud-last" variant="bodySmall" color="textSecondary">{t('settings.privacy.cloud.lastUpload', { when: new Date(lastUpload).toLocaleString() })}</Text> : null}
      {pct !== undefined ? <Text variant="bodySmall" testID="backup-progress" accessibilityLiveRegion="polite">{t('settings.privacy.backupWorking', { pct })}</Text> : null}
      {msg ? <Text variant="bodySmall" testID="backup-message" accessibilityLiveRegion="polite">{msg}</Text> : null}
    </SubScreen>
  );
}
