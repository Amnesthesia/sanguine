// Health sync (PLAN.md §7.5): each type is its own switch, nothing is on until the user asks, wrist temperature is read only.
import type { HealthType } from '@sanguine/health-adapter';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { effectivePrefs } from '@/data/prefs';
import { healthRows, withType } from '@/features/health/healthModel';
import { getHealthDriver, healthPlatformName, requestHealthAccess } from '@/services/health';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CautionPanel } from '@/ui/CautionPanel';
import { Chips } from '@/ui/Chips';
import { Group, SwitchRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

export default function HealthScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { prefs, profile, today, updatePrefs, health, syncHealth, resolveHealthAsk } = useApp();
  const [available, setAvailable] = useState<boolean | undefined>();
  /** Access was refused for the last type she switched on: she needs to read it and act (phone settings), so it is a panel, not a toast. */
  const [denied, setDenied] = useState(false);
  useEffect(() => { void getHealthDriver().then((d) => setAvailable(d !== null)); }, []);
  const platform = healthPlatformName();
  const eff = effectivePrefs(prefs, profile, today);

  if (available === false) {
    return (
      <SubScreen testID="screen-health" title={t('settings.health.title')}>
        <View testID="health-unavailable"><CautionPanel>{t('settings.health.unavailable')}</CautionPanel></View>
      </SubScreen>
    );
  }

  async function toggle(type: HealthType, on: boolean) {
    if (on) {
      try { await requestHealthAccess([type]); } catch { setDenied(true); return; }
    }
    setDenied(false);
    await updatePrefs({ healthTypes: withType(prefs.healthTypes, type, on) });
    if (on) void syncHealth({ force: true });
  }

  const last = health.last;
  const empty = last !== undefined && last.imported + last.duplicates + last.echoed + last.retracted + last.written === 0 && last.failed.length === 0;
  const rows = healthRows({ teen: eff.teen, sexLogging: eff.sexLogging, fertilityTools: eff.fertilityTools });

  return (
    <SubScreen testID="screen-health" title={t('settings.health.title')}>
      <Text variant="bodySmall" color="textSecondary" style={{ marginHorizontal: 4 }}>{t('settings.health.intro', { platform })}</Text>
      {health.asks.map((a) => (
        <Card key={a.externalId} testID={`health-ask-${a.externalId}`} style={{ gap: 10 }}>
          <Text variant="heading" accessibilityRole="header">{t('settings.health.ask.title', { platform })}</Text>
          <Text>{t('settings.health.ask.body', { platform, day: a.day })}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button testID="health-ask-remove" kind="secondary" label={t('settings.health.ask.remove')} onPress={() => void resolveHealthAsk(a, true)} />
            <Button testID="health-ask-keep" kind="text" label={t('settings.health.ask.keep')} onPress={() => void resolveHealthAsk(a, false)} />
          </View>
        </Card>
      ))}

      <Card testID="health-sync-card" style={{ gap: 12 }}>
        <Text testID="health-last" accessibilityLiveRegion="polite" color={health.lastAt ? 'textPrimary' : 'textSecondary'} style={health.lastAt ? { fontWeight: '600' } : undefined}>
          {health.lastAt ? t('settings.health.lastSync', { when: new Date(health.lastAt).toLocaleTimeString() }) : t('settings.health.never')}
        </Text>
        {last ? <Text testID="health-result" variant="bodySmall">{t('settings.health.result', { imported: last.imported, duplicates: last.duplicates, retracted: last.retracted, written: last.written })}</Text> : null}
        {last && last.failed.length > 0 ? <View testID="health-failed" accessibilityLiveRegion="polite"><CautionPanel>{t('settings.health.failed', { n: last.failed.length })}</CautionPanel></View> : null}
        {empty ? (
          <View testID="health-empty" style={{ gap: 8 }}>
            <CautionPanel>{t('settings.health.emptyHint')}</CautionPanel>
            <Button testID="health-open-settings" kind="secondary" label={t('settings.health.openSettings')} onPress={() => void Linking.openSettings()} />
          </View>
        ) : null}
        <Button testID="health-sync-now" label={health.running ? t('settings.health.syncing') : t('settings.health.syncNow')} disabled={health.running || prefs.healthTypes.length === 0} onPress={() => void syncHealth({ force: true })} />
      </Card>

      {denied ? <View testID="health-denied" accessibilityLiveRegion="polite"><CautionPanel>{t('settings.health.denied')}</CautionPanel></View> : null}
      <Group>
        {rows.map((r, i) => (
          <SwitchRow
            key={r.type} testID={`health-row-${r.type}`} title={t(r.titleKey)}
            description={`${r.readOnly ? t('settings.health.readOnly') : t('settings.health.readWrite')}. ${t(r.bodyKey, { platform })}`}
            value={prefs.healthTypes.includes(r.type)} onChange={(v) => void toggle(r.type, v)} last={i === rows.length - 1} />
        ))}
      </Group>
      <Text variant="bodySmall" color="textSecondary" style={{ marginHorizontal: 4 }}>{t('settings.health.offNote')}</Text>

      <View style={{ gap: 8 }}>
        <Text variant="caption" color="textSecondary" accessibilityRole="header" style={{ marginHorizontal: 4, fontWeight: '600' }}>{t('settings.health.since')}</Text>
        <Chips testIDPrefix="health-since" value={prefs.healthWindow} onChange={(v) => void updatePrefs({ healthWindow: v })} options={(['30d', '1y', '2y', 'all'] as const).map((w) => ({ value: w, label: t(`settings.health.window.${w}`) }))} />
        <Text variant="bodySmall" color="textSecondary" style={{ marginHorizontal: 4 }}>{t('settings.health.windowNote')}</Text>
        <View testID="health-other-apps" style={{ borderRadius: 16, padding: 12, backgroundColor: theme.chipBg }}>
          <Text variant="bodySmall">{t('settings.health.otherApps', { platform })}</Text>
        </View>
      </View>

      <Text variant="bodySmall" color="textSecondary" style={{ marginHorizontal: 4 }}>{t('settings.health.shared', { platform })}</Text>
    </SubScreen>
  );
}
