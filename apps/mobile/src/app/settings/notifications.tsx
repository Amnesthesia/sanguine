import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { effectivePrefs } from '@/data/prefs';
import { getSetting, setSetting } from '@/data/settings';
import { FERTILITY_EVENTS, MAX_RULES, REMINDER_DAYS, REMINDER_EVENTS, type ReminderEvent, type ReminderRule, reminderText } from '@/features/notifications/plan';
import { ensurePermission, remindersSupported } from '@/services/notifications';
import { widgetsSupported } from '@/services/widgets';
import { useApp } from '@/state/app';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chips } from '@/ui/Chips';
import { Group, SettingsRow, SwitchRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';
import { formatDay } from '@/ui/format';
import { Text } from '@/ui/Text';

/** Notifications and widgets (D-090): the user's own reminder rules, "N days before <period | ovulation | fertile window>", plus the
 *  late-period reminder. Ovulation and fertile-window rules exist only while the estimate is shown (off under 18 until unlocked). */
export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { db, prefs, profile, today, updatePrefs, nextReminder, refresh } = useApp();
  const [quick, setQuick] = useState(false);
  useEffect(() => { if (db) void getSetting(db, 'quickActions', false).then(setQuick); }, [db]);
  const [denied, setDenied] = useState(false);
  const [days, setDays] = useState<string>('3');
  const [event, setEvent] = useState<ReminderEvent>('period');
  const [msg, setMsg] = useState<string>();
  const n = prefs.notifications;
  const fertility = effectivePrefs(prefs, profile, today).showOvulationEstimate;
  const events = REMINDER_EVENTS.filter((e) => fertility || !FERTILITY_EVENTS.includes(e));
  const shown = n.rules.filter((r) => fertility || !FERTILITY_EVENTS.includes(r.event));
  const set = (patch: Partial<typeof n>) => void updatePrefs({ notifications: { ...n, ...patch } });
  async function toggle(v: boolean) {
    if (v && !(await ensurePermission())) { setDenied(true); set({ enabled: false }); return; }
    setDenied(false);
    set({ enabled: v });
  }
  const ruleText = (r: Pick<ReminderRule, 'days' | 'event'>) => {
    const what = t(`settings.notifications.event.${r.event}`);
    return r.days === 0 ? t('settings.notifications.ruleOnDay', { event: what }) : t(r.days === 1 ? 'settings.notifications.ruleBefore1' : 'settings.notifications.ruleBefore', { n: r.days, event: what });
  };
  function add() {
    const d = Number(days);
    if (n.rules.some((r) => r.days === d && r.event === event)) return setMsg(t('settings.notifications.duplicate'));
    if (n.rules.length >= MAX_RULES) return setMsg(t('settings.notifications.maxRules', { n: MAX_RULES }));
    setMsg(undefined);
    set({ rules: [...n.rules, { id: `r-${Date.now().toString(36)}`, days: d, event }] });
  }
  const sample = shown[0];
  const preview = sample ? reminderText({ event: sample.event, lo: Math.max(sample.days, 0), hi: sample.days + 5 }) : reminderText({ event: 'late', lo: 0, hi: 0 });
  return (
    <SubScreen testID="screen-notifications" title={t('settings.notifications.title')}>
      <Group>
        <SwitchRow testID="notif-enabled" title={t('settings.notifications.reminders')} description={remindersSupported ? t('settings.notifications.remindersDesc') : t('settings.notifications.androidLater')} disabled={!remindersSupported} value={n.enabled} onChange={(v) => void toggle(v)} />
        <SwitchRow testID="notif-late" title={t('settings.notifications.late')} description={t('settings.notifications.lateDesc')} disabled={!n.enabled} value={n.late} onChange={(v) => set({ late: v })} />
        <SwitchRow testID="notif-descriptive" title={t('settings.notifications.descriptive')} description={t('settings.notifications.descriptiveDesc')} value={n.descriptive} onChange={(v) => set({ descriptive: v })} last />
      </Group>
      {denied ? <Text variant="bodySmall" testID="notif-denied" accessibilityLiveRegion="polite">{t('settings.notifications.denied')}</Text> : null}
      {n.enabled ? <Text variant="bodySmall" color="textSecondary" testID="notif-next">{nextReminder ? t('settings.notifications.next', { date: formatDay(nextReminder) }) : t('settings.notifications.none')}</Text> : null}

      <Text variant="heading" accessibilityRole="header">{t('settings.notifications.yourReminders')}</Text>
      <Group>
        {shown.length === 0 ? <SettingsRow title={t('settings.notifications.noRules')} disabled last /> : shown.map((r, i) => (
          <SettingsRow key={r.id} testID={`rule-${r.event}-${r.days}`} title={ruleText(r)} last={i === shown.length - 1}
            right={<Button kind="text" testID={`rule-remove-${r.event}-${r.days}`} label={t('settings.notifications.remove')} accessibilityLabel={`${t('settings.notifications.remove')}: ${ruleText(r)}`} onPress={() => set({ rules: n.rules.filter((x) => x.id !== r.id) })} />} />
        ))}
      </Group>

      <Card testID="notif-add">
        <Text variant="heading" accessibilityRole="header">{t('settings.notifications.notifyMe')}</Text>
        <View style={{ gap: 10, marginTop: 8 }}>
          <Chips testIDPrefix="rule-days" value={days} onChange={setDays} options={REMINDER_DAYS.map((d) => ({ value: String(d), label: d === 0 ? t('settings.notifications.onTheDay') : t(d === 1 ? 'settings.notifications.days1' : 'settings.notifications.daysN', { n: d }) }))} />
          <Text variant="bodySmall" color="textSecondary">{t('settings.notifications.beforeThe')}</Text>
          <Chips testIDPrefix="rule-event" value={events.includes(event) ? event : 'period'} onChange={setEvent} options={events.map((e) => ({ value: e, label: t(`settings.notifications.eventLabel.${e}`) }))} />
          <Button testID="rule-add" kind="secondary" label={t('settings.notifications.add')} onPress={add} />
          {msg ? <Text variant="bodySmall" accessibilityLiveRegion="polite" testID="rule-message">{msg}</Text> : null}
        </View>
      </Card>

      <Text variant="heading" accessibilityRole="header">{t('settings.notifications.preview')}</Text>
      <Card testID="notif-preview"><Text>{n.descriptive ? `${t('notifications.defaultTitle')}: ${t(preview.key, preview.params)}` : t('settings.notifications.defaultText')}</Text></Card>
      <Group title={t('settings.notifications.widgets')}>
        <SwitchRow testID="quick-actions" title={t('settings.notifications.quickActions')} description={prefs.discreetIcon ? t('settings.notifications.quickActionsDiscreet') : t('settings.notifications.quickActionsDesc')} disabled={prefs.discreetIcon} value={quick && !prefs.discreetIcon} onChange={(v) => void (async () => { if (db) { await setSetting(db, 'quickActions', v); setQuick(v); await refresh(); } })()} />
        {widgetsSupported
          ? <SwitchRow testID="widget-details" title={t('settings.notifications.widgetDetails')} description={t('settings.notifications.widgetDetailsDesc')} value={prefs.widgetDetails} onChange={(v) => void updatePrefs({ widgetDetails: v })} last />
          : <SettingsRow title={t('settings.notifications.widgetsDesc')} disabled last />}
      </Group>
    </SubScreen>
  );
}
