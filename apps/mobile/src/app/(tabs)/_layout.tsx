import * as QuickActions from 'expo-quick-actions';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useEffect } from 'react';
import { getSetting } from '@/data/settings';
import { quickActionItems } from '@/features/settings/quickActions';
import { useApp } from '@/state/app';
import { useTranslation } from 'react-i18next';
import { m3 } from '@sanguine/ui-tokens';
import { useTheme } from '@/theme';

/** System tab bar: Liquid Glass on iOS 26+, Material navigation bar on Android (PLAN.md §9.1). */
export default function TabsLayout() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const m = m3[t.scheme];
  // home-screen quick actions (P8-8): routed here, inside the tabs, as the library asks; kept in step with the setting and the discreet icon
  useQuickActionRouting();
  const { db, prefs, version } = useApp();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads the setting after it is switched
  useEffect(() => {
    if (!db) return;
    void getSetting(db, 'quickActions', false).then((on) => QuickActions.setItems(quickActionItems(on, prefs.discreetIcon, tr))).catch(() => undefined);
  }, [db, prefs.discreetIcon, version, tr]);
  // Android: the active pill is solid rose with the icon on it in onPrimary, so the active tab stands out from the bar (5.1:1)
  // instead of a pale pink pill (1.2:1). iOS ignores indicatorColor and keeps the rose tint (D-066).
  return (
    <NativeTabs
      backgroundColor={t.screenBg}
      indicatorColor={m.primary}
      rippleColor={`${m.primary}33`}
      tintColor={t.c.accent}
      iconColor={t.isIOS ? undefined : { default: t.c.textSecondary, selected: m.onPrimary }}
      labelStyle={{ selected: { color: t.c.accent } }}>
      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Label>{tr('tabs.today')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="drop" md="water_drop" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendar">
        <NativeTabs.Trigger.Label>{tr('tabs.calendar')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="insights">
        <NativeTabs.Trigger.Label>{tr('tabs.insights')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="show_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{tr('tabs.settings')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
