import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { getConsent } from '@/data/consent';
import { useTranslation } from 'react-i18next';
import { Alert, Platform } from 'react-native';
import { shareExport, pickAndImport } from '@/services/exportImport';
import { deviceHasLock } from '@/services/lockAuth';
import { discreetIconSupported, setDiscreetIcon } from '@/services/discreet';
import { useApp } from '@/state/app';
import { Card } from '@/ui/Card';
import { Group, SettingsRow, SwitchRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { db, store, prefs, updatePrefs, refresh, deleteEverything } = useApp();
  const [msg, setMsg] = useState<string | undefined>();
  const [busy, setBusy] = useState<'export' | 'import' | undefined>();
  const [consentAt, setConsentAt] = useState<string | null>(null);
  useEffect(() => { if (db) void getConsent(db).then((c) => setConsentAt(c?.at ?? null)); }, [db]);

  async function run(what: 'export' | 'import', fn: () => Promise<string | undefined>) {
    if (busy) return;
    setBusy(what);
    setMsg(undefined);
    try { setMsg(await fn()); } catch (e) { setMsg(`${t(what === 'export' ? 'settings.privacy.exportFailed' : 'settings.privacy.importFailed')} ${(e as Error).message}`); } finally { setBusy(undefined); }
  }
  // Saved first: on Android the switch closes the app, so nothing after it is guaranteed to run. Reverted if it fails.
  async function switchIcon(on: boolean) {
    await updatePrefs({ discreetIcon: on });
    if ((await setDiscreetIcon(on).catch(() => !on)) !== on) await updatePrefs({ discreetIcon: !on });
  }
  const confirmDelete = () => Alert.alert(t('settings.privacy.deleteConfirmTitle'), t('settings.privacy.deleteConfirmBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('settings.privacy.deleteConfirmAction'), style: 'destructive', onPress: () => void deleteEverything().then(() => router.replace('/')) },
  ]);
  return (
    <SubScreen testID="screen-privacy" title={t('settings.privacy.title')}>
      <Card><Text>{t('settings.privacy.intro')}</Text></Card>
      <Group>
        <SettingsRow testID="privacy-export" title={t('settings.privacy.export')} description={busy === 'export' ? t('settings.privacy.exportBusy') : t('settings.privacy.exportDesc')} onPress={() => db && store && void run('export', async () => { await shareExport(db, store); return t('settings.privacy.exportDone'); })} />
        <SettingsRow testID="privacy-import" title={t('settings.privacy.import')} description={t('settings.privacy.importDesc')} onPress={() => db && store && void run('import', async () => {
          const r = await pickAndImport(db, store);
          if (r.kind === 'cancelled') return undefined;
          await refresh();
          // imported symptoms appear in the logging sheet too, not only in the day detail
          if (r.kind === 'natural_cycles' && r.symptoms.some((c) => !prefs.symptoms.includes(c))) await updatePrefs({ symptoms: [...new Set([...prefs.symptoms, ...r.symptoms])] });
          const done = t('settings.privacy.importDone', { n: r.kind === 'sanguine' ? r.result.imported : r.result.added })
            + (r.kind === 'natural_cycles' && r.result.notesDropped > 0 ? ` ${t('settings.privacy.importNotesDropped', { n: r.result.notesDropped })}` : '');
          return r.kind === 'natural_cycles' && r.problems.length > 0 ? `${done}\n${t('settings.privacy.importSkipped')} ${r.problems.slice(0, 5).join('; ')}${r.problems.length > 5 ? ` ${t('settings.privacy.importMore', { n: r.problems.length - 5 })}` : ''}` : done;
        })} />
        <SettingsRow testID="privacy-backup" title={t('settings.privacy.backup')} description={t('settings.privacy.backupDesc')} onPress={() => router.push('/settings/backup' as never)} />
        <SwitchRow testID="privacy-lock" title={t('settings.privacy.appLock')} description={t('settings.privacy.appLockDesc')} value={prefs.appLock} onChange={(v) => void (async () => { if (v && !(await deviceHasLock())) { setMsg(t('settings.privacy.appLockOnly')); return; } setMsg(undefined); await updatePrefs({ appLock: v }); })()} />
        <SwitchRow testID="privacy-icon" title={t('settings.privacy.discreetIcon')} description={discreetIconSupported() ? t(Platform.OS === 'android' ? 'settings.privacy.discreetIconDescAndroid' : 'settings.privacy.discreetIconDesc') : t('settings.privacy.discreetIconUnavailable')} disabled={!discreetIconSupported()} value={prefs.discreetIcon} onChange={(v) => void switchIcon(v)} />
        <SwitchRow testID="privacy-protect" title={t('settings.privacy.screenProtection')} description={t('settings.privacy.screenProtectionDesc')} value={prefs.screenProtection} onChange={(v) => void updatePrefs({ screenProtection: v })} />
        <SettingsRow testID="privacy-consent" title={t('settings.privacy.consentTitle')} description={consentAt ? t('settings.privacy.consentGiven', { date: consentAt.slice(0, 10) }) : t('settings.privacy.consentNone')} />
        <SettingsRow testID="privacy-delete" title={t('settings.privacy.deleteAll')} destructive onPress={confirmDelete} last />
      </Group>
      {msg ? <Text variant="bodySmall" testID="privacy-message" accessibilityLiveRegion="polite">{msg}</Text> : null}
    </SubScreen>
  );
}
