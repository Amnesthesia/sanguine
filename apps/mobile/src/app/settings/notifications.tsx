import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ensurePermission, remindersSupported } from '@/services/notifications';
import { widgetsSupported } from '@/services/widgets';
import { useApp } from '@/state/app';
import { Card } from '@/ui/Card';
import { Group, SettingsRow, SwitchRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';
import { formatDay } from '@/ui/format';
import { Text } from '@/ui/Text';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { prefs, prediction, today, updatePrefs, nextReminder } = useApp();
  const [denied, setDenied] = useState(false);
  const next = prediction?.nextPeriod;
  const lo = next ? Math.max(0, Math.round((Date.parse(next.i80.lo) - Date.parse(today)) / 86_400_000)) : 3;
  const hi = next ? Math.max(lo, Math.round((Date.parse(next.i80.hi) - Date.parse(today)) / 86_400_000)) : 8;
  const set = (patch: Partial<typeof prefs.notifications>) => void updatePrefs({ notifications: { ...prefs.notifications, ...patch } });
  async function togglePeriod(v: boolean) {
    if (v && !(await ensurePermission())) { setDenied(true); set({ period: false }); return; }
    setDenied(false);
    set({ period: v });
  }
  return (
    <SubScreen testID="screen-notifications" title={t('settings.notifications.title')}>
      <Group>
        <SwitchRow testID="notif-period" title={t('settings.notifications.periodSoon')} description={remindersSupported ? t('settings.notifications.periodSoonDesc') : t('settings.notifications.androidLater')} disabled={!remindersSupported} value={prefs.notifications.period} onChange={(v) => void togglePeriod(v)} />
        <SwitchRow testID="notif-descriptive" title={t('settings.notifications.descriptive')} description={t('settings.notifications.descriptiveDesc')} value={prefs.notifications.descriptive} onChange={(v) => set({ descriptive: v })} last />
      </Group>
      {denied ? <Text variant="bodySmall" testID="notif-denied" accessibilityLiveRegion="polite">{t('settings.notifications.denied')}</Text> : null}
      {prefs.notifications.period ? <Text variant="bodySmall" color="textSecondary" testID="notif-next">{nextReminder ? t('settings.notifications.next', { date: formatDay(nextReminder) }) : t('settings.notifications.none')}</Text> : null}
      <Text variant="heading" accessibilityRole="header">{t('settings.notifications.preview')}</Text>
      <Card testID="notif-preview"><Text>{prefs.notifications.descriptive ? t('settings.notifications.descriptiveText', { lo, hi }) : t('settings.notifications.defaultText')}</Text></Card>
      <Group title={t('settings.notifications.widgets')}>
        {widgetsSupported
          ? <SwitchRow testID="widget-details" title={t('settings.notifications.widgetDetails')} description={t('settings.notifications.widgetDetailsDesc')} value={prefs.widgetDetails} onChange={(v) => void updatePrefs({ widgetDetails: v })} last />
          : <SettingsRow title={t('settings.notifications.widgetsDesc')} disabled last />}
      </Group>
    </SubScreen>
  );
}
