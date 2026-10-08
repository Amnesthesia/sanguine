import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { shareExport, pickAndImport } from '@/services/exportImport';
import { deviceHasLock } from '@/services/lockAuth';
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
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<string | undefined>) {
    if (busy) return;
    setBusy(true);
    setMsg(undefined);
    try { setMsg(await fn()); } catch (e) { setMsg(`${t('settings.privacy.importFailed')} ${(e as Error).message}`); } finally { setBusy(false); }
  }
  const confirmDelete = () => Alert.alert(t('settings.privacy.deleteConfirmTitle'), t('settings.privacy.deleteConfirmBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('settings.privacy.deleteConfirmAction'), style: 'destructive', onPress: () => void deleteEverything().then(() => router.replace('/')) },
  ]);
  return (
    <SubScreen testID="screen-privacy" title={t('settings.privacy.title')}>
      <Card><Text>{t('settings.privacy.intro')}</Text></Card>
      <Group>
        <SettingsRow testID="privacy-export" title={t('settings.privacy.export')} description={busy ? t('settings.privacy.exportBusy') : t('settings.privacy.exportDesc')} onPress={() => db && store && void run(async () => { await shareExport(db, store); return t('settings.privacy.exportDone'); })} />
        <SettingsRow testID="privacy-import" title={t('settings.privacy.import')} description={t('settings.privacy.importDesc')} onPress={() => db && store && void run(async () => {
          const r = await pickAndImport(db, store);
          if (r.kind === 'cancelled') return undefined;
          await refresh();
          return t('settings.privacy.importDone', { n: r.kind === 'sanguine' ? r.result.imported : r.result.added });
        })} />
        <SettingsRow testID="privacy-backup" title={t('settings.privacy.backup')} description={t('settings.privacy.backupDesc')} onPress={() => router.push('/settings/backup' as never)} />
        <SwitchRow testID="privacy-lock" title={t('settings.privacy.appLock')} description={t('settings.privacy.appLockDesc')} value={prefs.appLock} onChange={(v) => void (async () => { if (v && !(await deviceHasLock())) { setMsg(t('settings.privacy.appLockOnly')); return; } setMsg(undefined); await updatePrefs({ appLock: v }); })()} />
        <SwitchRow testID="privacy-icon" title={t('settings.privacy.discreetIcon')} description={t('settings.privacy.discreetSoon')} value={false} onChange={() => {}} disabled />
        <SettingsRow testID="privacy-delete" title={t('settings.privacy.deleteAll')} destructive onPress={confirmDelete} last />
      </Group>
      {msg ? <Text variant="bodySmall" testID="privacy-message" accessibilityLiveRegion="polite">{msg}</Text> : null}
    </SubScreen>
  );
}
