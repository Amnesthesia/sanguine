import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/app';
import { Card } from '@/ui/Card';
import { Group, SettingsRow, SwitchRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { prefs, prediction, today, updatePrefs } = useApp();
  const next = prediction?.nextPeriod;
  const lo = next ? Math.max(0, Math.round((Date.parse(next.i80.lo) - Date.parse(today)) / 86_400_000)) : 3;
  const hi = next ? Math.max(lo, Math.round((Date.parse(next.i80.hi) - Date.parse(today)) / 86_400_000)) : 8;
  const set = (patch: Partial<typeof prefs.notifications>) => void updatePrefs({ notifications: { ...prefs.notifications, ...patch } });
  return (
    <SubScreen testID="screen-notifications" title={t('settings.notifications.title')}>
      <Group>
        <SwitchRow testID="notif-period" title={t('settings.notifications.periodSoon')} description={t('settings.notifications.periodSoonDesc')} value={prefs.notifications.period} onChange={(v) => set({ period: v })} />
        <SwitchRow testID="notif-descriptive" title={t('settings.notifications.descriptive')} description={t('settings.notifications.descriptiveDesc')} value={prefs.notifications.descriptive} onChange={(v) => set({ descriptive: v })} last />
      </Group>
      <Text variant="heading" accessibilityRole="header">{t('settings.notifications.preview')}</Text>
      <Card testID="notif-preview"><Text>{prefs.notifications.descriptive ? t('settings.notifications.descriptiveText', { lo, hi }) : t('settings.notifications.defaultText')}</Text></Card>
      <Group title={t('settings.notifications.widgets')}><SettingsRow title={t('settings.notifications.widgetsDesc')} disabled last /></Group>
    </SubScreen>
  );
}
