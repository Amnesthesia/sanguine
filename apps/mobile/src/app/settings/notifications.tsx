import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { effectivePrefs } from '@/data/prefs';
import { getSetting, setSetting } from '@/data/settings';
import { FERTILITY_EVENTS, MAX_RULES, REMINDER_DAYS, REMINDER_EVENTS, type ReminderEvent, type ReminderRule, reminderText } from '@/features/notifications/plan';
import { ensurePermission, remindersSupported } from '@/services/notifications';
import { widgetsSupported } from '@/services/widgets';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CautionPanel } from '@/ui/CautionPanel';
import { Chips } from '@/ui/Chips';
import { Group, SettingsRow, SwitchRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';
import { formatDay } from '@/ui/format';
import { Text } from '@/ui/Text';

/** A heading between groups (frame Settings-Notifications): 15 semibold, a little in from the card edge. */
const SECTION = { fontSize: 15, lineHeight: 20, fontWeight: '600', marginTop: 8, marginLeft: 4 } as const;

/** The two notification texts side by side, the current one outlined: a drawing, not a control. */
function NotificationPair({ on, onText, offText, setting }: { on: boolean; onText: string; offText: string; setting: string }) {
  const { t } = useTranslation();
  const th = useTheme();
  const one = (current: boolean, head: string, text: string) => (
    <View style={{ flex: 1, gap: 6 }}>
      <Text variant="caption" color={current ? 'onAccentSoft' : 'textSecondary'} style={{ fontWeight: '600' }}>{head}</Text>
      <View style={[{ flex: 1, borderRadius: 18, backgroundColor: th.cardBg, padding: 10, flexDirection: 'row', gap: 8, borderWidth: current ? 1.5 : 1, borderColor: current ? th.c.accent : th.hairline }]}>
        <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: th.c.accentSoft }} />
        <View style={{ flex: 1 }}><Text variant="caption" style={{ fontWeight: '600' }}>{t('notifications.defaultTitle')}</Text><Text variant="caption" color="textSecondary">{text}</Text></View>
      </View>
    </View>
  );
  return (
    <View testID="notif-pair" accessible accessibilityRole="image" accessibilityLabel={t('settings.notifications.pairLabel', { setting, off: offText, on: onText })} style={{ flexDirection: 'row', gap: 8 }}>
      {one(!on, t('common.off'), offText)}
      {one(on, t('common.on'), onText)}
    </View>
  );
}

/** Notifications and widgets (D-090): the user's own reminder rules, "N days before <period | ovulation | fertile window>", plus the
 *  late-period reminder. Ovulation and fertile-window rules exist only while the estimate is shown (off under 18 until unlocked). */
/** The small mark at the left of a reminder rule (frame Settings-Notifications): period a dashed ring, ovulation a glowing ring, fertile window a solid dot. The row's words name the event too, so the shape is never the only cue. */
function RuleDot({ event, id }: { event: ReminderEvent; id: string }) {
  const th = useTheme();
  const base = { width: 12, height: 12, borderRadius: 6 } as const;
  const style = event === 'period' ? { ...base, borderWidth: 1.5, borderStyle: 'dashed' as const, borderColor: th.c.period }
    : event === 'ovulation' ? { ...base, backgroundColor: th.cardBg, borderWidth: 1.5, borderColor: th.c.ovulation, shadowColor: th.c.ovulation, shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }
    : { ...base, backgroundColor: th.c.fertile };
  return <View testID={`rule-dot-${id}`} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={style} />;
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const th = useTheme();
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
  const previewText = n.descriptive ? `${t('notifications.defaultTitle')}: ${t(preview.key, preview.params)}` : t('settings.notifications.defaultText');
  return (
    <SubScreen testID="screen-notifications" title={t('settings.notifications.title')}>
      <Group>
        <SwitchRow testID="notif-enabled" title={t('settings.notifications.reminders')} description={remindersSupported ? t('settings.notifications.remindersDesc') : t('settings.notifications.androidLater')} disabled={!remindersSupported} value={n.enabled} onChange={(v) => void toggle(v)} />
        <SwitchRow testID="notif-late" title={t('settings.notifications.late')} description={t('settings.notifications.lateDesc')} disabled={!n.enabled} value={n.late} onChange={(v) => set({ late: v })} />
        <SwitchRow testID="notif-descriptive" title={t('settings.notifications.descriptive')} description={t('settings.notifications.descriptiveDesc', { text: previewText })} value={n.descriptive} onChange={(v) => set({ descriptive: v })} last />
        <View style={{ padding: 16, paddingTop: 0 }}><NotificationPair setting={t('settings.notifications.descriptive')} on={n.descriptive} offText={t('notifications.defaultBody')} onText={t(preview.key, preview.params)} /></View>
      </Group>
      {denied ? <View testID="notif-denied" accessibilityLiveRegion="polite"><CautionPanel>{t('settings.notifications.denied')}</CautionPanel></View> : null}
      {n.enabled ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 4 }}>
          <Svg testID="notif-next-icon" aria-hidden width={14} height={14} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Path d="M6 16.5V11A6 6 0 0 1 18 11V16.5L19.5 18H4.5Z" fill="none" stroke={th.c.textSecondary} strokeWidth={2} strokeLinejoin="round" /></Svg>
          <Text variant="bodySmall" color="textSecondary" testID="notif-next" style={{ flex: 1 }}>{nextReminder ? t('settings.notifications.next', { date: formatDay(nextReminder) }) : t('settings.notifications.none')}</Text>
        </View>
      ) : null}

      <Text accessibilityRole="header" style={SECTION}>{t('settings.notifications.yourReminders')}</Text>
      <Group>
        {shown.length === 0 ? <SettingsRow title={t('settings.notifications.noRules')} disabled last /> : shown.map((r, i) => (
          <View key={r.id} testID={`rule-${r.event}-${r.days}`} style={{ minHeight: 56, paddingLeft: 16, paddingRight: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: i === shown.length - 1 ? 0 : 1, borderBottomColor: th.hairline }}>
            <RuleDot event={r.event} id={`${r.event}-${r.days}`} />
            <Text style={{ flex: 1 }}>{ruleText(r)}</Text>
            <Button kind="text" testID={`rule-remove-${r.event}-${r.days}`} label={t('settings.notifications.remove')} accessibilityLabel={`${t('settings.notifications.remove')}: ${ruleText(r)}`} onPress={() => set({ rules: n.rules.filter((x) => x.id !== r.id) })} />
          </View>
        ))}
      </Group>

      <Card testID="notif-add" style={{ gap: 12 }}>
        <Text variant="heading" accessibilityRole="header">{t('settings.notifications.notifyMe')}</Text>
        <View style={{ gap: 10 }}>
          <Chips testIDPrefix="rule-days" value={days} onChange={setDays} options={REMINDER_DAYS.map((d) => ({ value: String(d), label: d === 0 ? t('settings.notifications.onTheDay') : t(d === 1 ? 'settings.notifications.days1' : 'settings.notifications.daysN', { n: d }) }))} />
          <Text variant="bodySmall" color="textSecondary">{t('settings.notifications.beforeThe')}</Text>
          <Chips testIDPrefix="rule-event" value={events.includes(event) ? event : 'period'} onChange={setEvent} options={events.map((e) => ({ value: e, label: t(`settings.notifications.eventLabel.${e}`) }))} />
          <Button testID="rule-add" kind="secondary" label={t('settings.notifications.add')} onPress={add} />
          {msg ? <Text variant="bodySmall" accessibilityLiveRegion="polite" testID="rule-message">{msg}</Text> : null}
        </View>
      </Card>

      <Text accessibilityRole="header" style={SECTION}>{t('settings.notifications.widgets')}</Text>
      <Group>
        <SwitchRow testID="quick-actions" title={t('settings.notifications.quickActions')} description={prefs.discreetIcon ? t('settings.notifications.quickActionsDiscreet') : t('settings.notifications.quickActionsDesc')} disabled={prefs.discreetIcon} value={quick && !prefs.discreetIcon} onChange={(v) => void (async () => { if (db) { await setSetting(db, 'quickActions', v); setQuick(v); await refresh(); } })()} />
        {widgetsSupported
          ? <SwitchRow testID="widget-details" title={t('settings.notifications.widgetDetails')} description={t('settings.notifications.widgetDetailsDesc')} value={prefs.widgetDetails} onChange={(v) => void updatePrefs({ widgetDetails: v })} last />
          : <SettingsRow title={t('settings.notifications.widgetsDesc')} disabled last />}
      </Group>
    </SubScreen>
  );
}
