import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

/** System tab bar: Liquid Glass on iOS 26+, Material navigation bar on Android (PLAN.md §9.1). */
export default function TabsLayout() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <NativeTabs backgroundColor={t.screenBg} indicatorColor={t.c.accentSoft} tintColor={t.c.accent} labelStyle={{ selected: { color: t.c.accent } }}>
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
