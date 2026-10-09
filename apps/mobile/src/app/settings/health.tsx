// Health sync (PLAN.md §7.5): each type is its own switch, nothing is on until the user asks, wrist temperature is read only.
import type { HealthType } from '@sanguine/health-adapter';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { effectivePrefs } from '@/data/prefs';
import { healthRows, withType } from '@/features/health/healthModel';
import { getHealthDriver, healthPlatformName, requestHealthAccess } from '@/services/health';
import { useApp } from '@/state/app';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chips } from '@/ui/Chips';
import { Group, SettingsRow, SwitchRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

export default function HealthScreen() {
  const { t } = useTranslation();
  const { prefs, profile, today, updatePrefs, health, syncHealth, resolveHealthAsk } = useApp();
  const [available, setAvailable] = useState<boolean | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  useEffect(() => { void getHealthDriver().then((d) => setAvailable(d !== null)); }, []);
  const platform = healthPlatformName();
  const eff = effectivePrefs(prefs, profile, today);

  if (available === false) {
    return (
      <SubScreen testID="screen-health" title={t('settings.health.title')}>
        <Group><SettingsRow testID="health-unavailable" title={t('settings.health.unavailable')} last /></Group>
      </SubScreen>
    );
  }

  async function toggle(type: HealthType, on: boolean) {
    setMessage(undefined);
    if (on) {
      try { await requestHealthAccess([type]); } catch { setMessage(t('settings.health.denied')); return; }
    }
    await updatePrefs({ healthTypes: withType(prefs.healthTypes, type, on) });
    if (on) void syncHealth({ force: true });
  }

  const last = health.last;
  const empty = last !== undefined && last.imported + last.duplicates + last.echoed + last.retracted + last.written === 0 && last.failed.length === 0;
  const rows = healthRows({ teen: eff.teen, sexLogging: eff.sexLogging });

  return (
    <SubScreen testID="screen-health" title={t('settings.health.title')}>
      <Text variant="bodySmall" color="textSecondary">{t('settings.health.intro', { platform })}</Text>
      <Group>
        {rows.map((r, i) => (
          <SwitchRow
            key={r.type} testID={`health-row-${r.type}`} title={t(r.titleKey)}
            description={`${r.readOnly ? t('settings.health.readOnly') : t('settings.health.readWrite')}. ${t(r.bodyKey, { platform })}`}
            value={prefs.healthTypes.includes(r.type)} onChange={(v) => void toggle(r.type, v)} last={i === rows.length - 1} />
        ))}
      </Group>
      <Text variant="bodySmall" color="textSecondary">{t('settings.health.offNote')}</Text>

      <Text variant="heading" accessibilityRole="header">{t('settings.health.since')}</Text>
      <Chips testIDPrefix="health-since" value={prefs.healthWindow} onChange={(v) => void updatePrefs({ healthWindow: v })} options={(['30d', '1y', '2y'] as const).map((w) => ({ value: w, label: t(`settings.health.window.${w}`) }))} />
      <Text variant="bodySmall" color="textSecondary">{t('settings.health.windowNote')}</Text>

      {health.asks.map((a) => (
        <Card key={a.externalId} testID={`health-ask-${a.externalId}`}>
          <Text variant="heading">{t('settings.health.ask.title', { platform })}</Text>
          <Text>{t('settings.health.ask.body', { platform, day: a.day })}</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button testID="health-ask-remove" kind="secondary" label={t('settings.health.ask.remove')} onPress={() => void resolveHealthAsk(a, true)} />
            <Button testID="health-ask-keep" kind="text" label={t('settings.health.ask.keep')} onPress={() => void resolveHealthAsk(a, false)} />
          </View>
        </Card>
      ))}

      <Button testID="health-sync-now" label={health.running ? t('settings.health.syncing') : t('settings.health.syncNow')} disabled={health.running || prefs.healthTypes.length === 0} onPress={() => void syncHealth({ force: true })} />
      <Text testID="health-last" variant="bodySmall" color="textSecondary" accessibilityLiveRegion="polite">
        {health.lastAt ? t('settings.health.lastSync', { when: new Date(health.lastAt).toLocaleTimeString() }) : t('settings.health.never')}
      </Text>
      {last ? <Text testID="health-result" variant="bodySmall">{t('settings.health.result', last)}</Text> : null}
      {last && last.failed.length > 0 ? <Text testID="health-failed" variant="bodySmall" color="textSecondary">{t('settings.health.failed', { n: last.failed.length })}</Text> : null}
      {empty ? (
        <>
          <Text testID="health-empty" variant="bodySmall" color="textSecondary">{t('settings.health.emptyHint')}</Text>
          <Button testID="health-open-settings" kind="secondary" label={t('settings.health.openSettings')} onPress={() => void Linking.openSettings()} />
        </>
      ) : null}
      <Text variant="bodySmall" color="textSecondary">{t('settings.health.shared', { platform })}</Text>
    </SubScreen>
  );
}
