import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { getConsent } from '@/data/consent';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Switch, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { shareExport, pickAndImport } from '@/services/exportImport';
import { deviceHasLock } from '@/services/lockAuth';
import { discreetIconSupported, setDiscreetIcon } from '@/services/discreet';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { CautionPanel } from '@/ui/CautionPanel';
import { Group, SettingsRow, SwitchRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';
import { showToast } from '@/ui/Toast';

/** The small drawings of the frame: the lock beside the intro, an arrow into or out of a tray on the export and import rows, the leaf on the discreet icon row. */
function Glyph({ name }: { name: 'lock' | 'download' | 'upload' | 'leaf' }) {
  const t = useTheme();
  const line = { fill: 'none', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  const hidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;
  if (name === 'lock') return <Svg width={22} height={22} viewBox="0 0 22 22" {...hidden}><Rect x={4} y={9.5} width={14} height={10} rx={3} stroke={t.c.accent} {...line} /><Path d="M7.5 9.5V7A3.5 3.5 0 0 1 14.5 7V9.5" stroke={t.c.accent} {...line} /></Svg>;
  if (name === 'leaf') return <Svg width={18} height={18} viewBox="0 0 18 18" {...hidden}><Path d="M3 15C3 8 7.5 3.5 15 3C15 10 11 14.5 4.5 14.5M3 15L9.5 8.5" stroke={t.c.fertile} {...line} /></Svg>;
  return <Svg width={20} height={20} viewBox="0 0 20 20" {...hidden}><Path d={name === 'download' ? 'M10 2.5V12.5M6.5 9L10 12.5L13.5 9M3 13V16A1.5 1.5 0 0 0 4.5 17.5H15.5A1.5 1.5 0 0 0 17 16V13' : 'M10 12.5V2.5M6.5 6L10 2.5L13.5 6M3 13V16A1.5 1.5 0 0 0 4.5 17.5H15.5A1.5 1.5 0 0 0 17 16V13'} stroke={t.c.textSecondary} {...line} /></Svg>;
}

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { db, store, prefs, updatePrefs, refresh, deleteEverything } = useApp();
  /** What the last action left to say: an error, or the import result. It stays until the next action (a caution panel, not a toast). */
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
  const discreetOk = discreetIconSupported();
  const confirmDelete = () => Alert.alert(t('settings.privacy.deleteConfirmTitle'), t('settings.privacy.deleteConfirmBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('settings.privacy.deleteConfirmAction'), style: 'destructive', onPress: () => void deleteEverything().then(() => router.replace('/')) },
  ]);
  const importFile = (d: NonNullable<typeof db>, st: NonNullable<typeof store>) => run('import', async () => {
    const r = await pickAndImport(d, st);
    if (r.kind === 'cancelled') return undefined;
    await refresh();
    // imported symptoms appear in the logging sheet too, not only in the day detail
    const daily = r.kind === 'natural_cycles' || r.kind === 'drip' ? r : undefined;
    if (daily?.symptoms.some((c) => !prefs.symptoms.includes(c))) await updatePrefs({ symptoms: [...new Set([...prefs.symptoms, ...daily.symptoms])] });
    const done = t('settings.privacy.importDone', { n: r.kind === 'sanguine' ? r.result.imported : r.result.added })
      + (daily && daily.result.notesDropped > 0 ? ` ${t('settings.privacy.importNotesDropped', { n: daily.result.notesDropped })}` : '');
    return daily && daily.problems.length > 0 ? `${done}\n${t('settings.privacy.importSkipped')} ${daily.problems.slice(0, 5).join('; ')}${daily.problems.length > 5 ? ` ${t('settings.privacy.importMore', { n: daily.problems.length - 5 })}` : ''}` : done;
  });
  return (
    <SubScreen testID="screen-privacy" title={t('settings.privacy.title')}>
      <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Glyph name="lock" />
        <Text style={{ flex: 1 }}>{t('settings.privacy.intro')}</Text>
      </Card>
      {msg ? <View testID="privacy-message" accessibilityLiveRegion="polite"><CautionPanel>{msg}</CautionPanel></View> : null}
      <Group>
        <SettingsRow testID="privacy-export" title={t('settings.privacy.export')} description={busy === 'export' ? t('settings.privacy.exportBusy') : t('settings.privacy.exportDesc')} disabled={busy !== undefined} right={<Glyph name="download" />} onPress={() => db && store && void run('export', async () => { await shareExport(db, store); showToast(t('settings.privacy.exportDone')); return undefined; })} />
        <SettingsRow testID="privacy-import" title={t('settings.privacy.import')} description={t('settings.privacy.importDesc')} disabled={busy !== undefined} right={<Glyph name="upload" />} onPress={() => db && store && void importFile(db, store)} last />
      </Group>
      <Group>
        <SettingsRow testID="privacy-report" title={t('report.screenTitle')} description={t('report.rowDesc')} onPress={() => router.push('/settings/report' as never)} />
        <SettingsRow testID="privacy-calendar" title={t('settings.calendar.title')} description={t('settings.calendar.rowDesc')} onPress={() => router.push('/settings/calendar' as never)} />
        <SettingsRow testID="privacy-backup" title={t('settings.privacy.backup')} description={t('settings.privacy.backupDesc')} onPress={() => router.push('/settings/backup' as never)} last />
      </Group>
      <Group>
        <SwitchRow testID="privacy-lock" title={t('settings.privacy.appLock')} description={t('settings.privacy.appLockDesc')} value={prefs.appLock} onChange={(v) => void (async () => { if (v && !(await deviceHasLock())) { setMsg(t('settings.privacy.appLockOnly')); return; } setMsg(undefined); await updatePrefs({ appLock: v }); })()} />
        {/* SwitchRow has no leading icon, so this row is SettingsRow with the same switch: the leaf shows what the discreet icon looks like */}
        <SettingsRow
          leadingIcon={<Glyph name="leaf" />} title={t('settings.privacy.discreetIcon')} disabled={!discreetOk}
          description={discreetOk ? t(Platform.OS === 'android' ? 'settings.privacy.discreetIconDescAndroid' : 'settings.privacy.discreetIconDesc') : t('settings.privacy.discreetIconUnavailable')}
          right={<Switch testID="privacy-icon" accessibilityRole="switch" accessibilityLabel={t('settings.privacy.discreetIcon')} value={prefs.discreetIcon} disabled={!discreetOk} onValueChange={(v) => void switchIcon(v)} trackColor={{ true: theme.c.accent, false: theme.c.border }} thumbColor={theme.scheme === 'dark' ? theme.c.textPrimary : theme.c.surface} />} />
        <SwitchRow testID="privacy-protect" title={t('settings.privacy.screenProtection')} description={t('settings.privacy.screenProtectionDesc')} value={prefs.screenProtection} onChange={(v) => void updatePrefs({ screenProtection: v })} last />
      </Group>
      <Group>
        <SettingsRow testID="privacy-consent" title={t('settings.privacy.consentTitle')} description={consentAt ? t('settings.privacy.consentGiven', { date: consentAt.slice(0, 10) }) : t('settings.privacy.consentNone')} last />
      </Group>
      <Group>
        <SettingsRow testID="privacy-delete" title={t('settings.privacy.deleteAll')} destructive onPress={confirmDelete} last />
      </Group>
    </SubScreen>
  );
}
