import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { m3 } from '@sanguine/ui-tokens';
import { useTheme } from '@/theme';

/** System tab bar: Liquid Glass on iOS 26+, Material navigation bar on Android (PLAN.md §9.1). */
export default function TabsLayout() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const m = m3[t.scheme];
  // Android: the active pill is solid garnet with the icon on it in onPrimary, so the active tab stands out from the bar (6.9:1)
  // instead of a pale pink pill (1.2:1). iOS ignores indicatorColor and keeps the garnet tint (D-066).
  return (
    <NativeTabs
      backgroundColor={t.screenBg}
      indicatorColor={m.primary}
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
