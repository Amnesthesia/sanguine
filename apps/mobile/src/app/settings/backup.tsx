// Encrypted backup (PLAN.md §6.3): passphrase + device secret. The recovery code is shown once, before the file leaves the phone.
import { BackupError, recoveryWordsToSecret, secretToRecoveryWords as recoveryCodeFor } from '@sanguine/crypto';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { createBackup } from '@/data/backup';
import { deviceClock, todayLocal } from '@/services/clock';
import { getDeviceSecret, getOrCreateDeviceSecret } from '@/services/secrets';
import { pickAndRestore } from '@/services/backup';
import { shareFile } from '@/services/shareFile';
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
  const { db, store, refresh } = useApp();
  const [mode, setMode] = useState<'create' | 'restore'>('create');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [code, setCode] = useState('');
  const [pct, setPct] = useState<number | undefined>();
  const [msg, setMsg] = useState<string | undefined>();
  const [pending, setPending] = useState<{ bytes: Uint8Array; words: string } | undefined>();

  async function create() {
    if (!db || !store) return;
    if (pass.length < MIN_PASSPHRASE) return setMsg(t('settings.privacy.passphraseTooShort'));
    if (pass !== pass2) return setMsg(t('settings.privacy.passphraseMismatch'));
    setMsg(undefined);
    setPct(0);
    try {
      const started = Date.now();
      const { secret, created } = await getOrCreateDeviceSecret();
      const bytes = await createBackup(db, store, { passphrase: pass, deviceSecret: secret, clock: deviceClock, onProgress: (f) => setPct(Math.round(f * 100)) });
      if (__DEV__) console.log(`[backup] sealed ${bytes.length} bytes in ${Date.now() - started} ms`);
      if (created) setPending({ bytes, words: recoveryCodeFor(secret) });
      else { await shareFile(bytes, `sanguine-backup-${todayLocal()}.sgb`, 'application/octet-stream'); setMsg(t('settings.privacy.backupReady')); }
    } catch (e) { setMsg((e as Error).message); } finally { setPct(undefined); }
  }
  async function restore() {
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
      const r = await pickAndRestore(db, store, pass, secret, (f) => setPct(Math.round(f * 100)));
      if (r) { await refresh(); setMsg(t('settings.privacy.importDone', { n: r.imported })); }
    } catch (e) {
      setMsg(e instanceof BackupError && e.code === 'auth' ? t('settings.privacy.restoreWrongPassphrase') : (e as Error).message);
    } finally { setPct(undefined); }
  }

  if (pending) {
    return (
      <SubScreen testID="screen-recovery" title={t('settings.privacy.recoveryCode.title')}>
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
          await shareFile(p.bytes, `sanguine-backup-${todayLocal()}.sgb`, 'application/octet-stream');
          setMsg(t('settings.privacy.backupReady'));
        })()} />
      </SubScreen>
    );
  }
  return (
    <SubScreen testID="screen-backup" title={t('settings.privacy.backup')}>
      <Segmented testIDPrefix="backup-mode" value={mode} onChange={(m) => { setMode(m); setMsg(undefined); }} options={[{ value: 'create', label: t('settings.privacy.backupCreate') }, { value: 'restore', label: t('settings.privacy.backupRestore') }]} />
      <Text variant="bodySmall" color="textSecondary">{t('settings.privacy.backupNote')}</Text>
      <TextField testID="backup-pass" label={t('settings.privacy.passphrase')} value={pass} onChangeText={setPass} keyboardType="default" />
      {mode === 'create' ? <TextField testID="backup-pass2" label={t('settings.privacy.passphraseConfirm')} value={pass2} onChangeText={setPass2} keyboardType="default" /> : <TextField testID="restore-code" label={t('settings.privacy.restoreCodeLabel')} value={code} onChangeText={setCode} keyboardType="default" />}
      <Button testID={mode === 'create' ? 'backup-create' : 'backup-restore'} label={mode === 'create' ? t('settings.privacy.backupCreate') : t('settings.privacy.restorePick')} disabled={pct !== undefined || pass.length === 0} onPress={() => void (mode === 'create' ? create() : restore())} />
      {pct !== undefined ? <Text variant="bodySmall" testID="backup-progress" accessibilityLiveRegion="polite">{t('settings.privacy.backupWorking', { pct })}</Text> : null}
      {msg ? <Text variant="bodySmall" testID="backup-message" accessibilityLiveRegion="polite">{msg}</Text> : null}
    </SubScreen>
  );
}
