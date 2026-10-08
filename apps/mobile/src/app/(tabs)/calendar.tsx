import { diffDays, type ISODate } from '@sanguine/engine';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { effectivePrefs } from '@/data/prefs';
import { buildMonth, monthOf, shiftMonth } from '@/features/calendar/calendarModel';
import { DayCellView } from '@/features/calendar/DayCellView';
import { useCalendarData } from '@/features/calendar/useCalendarData';
import { dayEvents } from '@/features/logging/actions';
import { shortDescribe } from '@/features/logging/describe';
import { FlagCard } from '@/features/today/cards';
import { buildToday, SHOW_OVULATION_ESTIMATE } from '@/features/today/todayModel';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { formatLong } from '@/ui/format';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

function Swatch({ kind }: { kind: 'period' | 'predicted' | 'fertile' | 'ovulation' | 'logged' }) {
  const t = useTheme();
  const base = { width: 14, height: 14, borderRadius: 4 } as const;
  if (kind === 'period') return <View style={{ ...base, backgroundColor: t.c.period }} />;
  if (kind === 'predicted') return <View style={{ ...base, borderWidth: 1.5, borderColor: t.c.periodPredicted, borderStyle: 'dashed' }} />;
  if (kind === 'fertile') return <View style={{ width: 14, height: 4, backgroundColor: t.c.fertile, borderRadius: 2 }} />;
  if (kind === 'ovulation') return <View style={{ width: 14, height: 2, backgroundColor: t.c.ovulation }} />;
  return <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.c.textSecondary }} />;
}

export default function CalendarScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { prediction, history, today, prefs, profile, store, version } = useApp();
  const muteFlag = useApp((s) => s.muteFlag);
  const { periodDays, loggedDays } = useCalendarData();
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState<ISODate>(today);
  const [summary, setSummary] = useState<string[]>([]);

  const year = Number(today.slice(0, 4));
  const showEstimate = SHOW_OVULATION_ESTIMATE && effectivePrefs(prefs, profile.birthYear, year).showOvulationEstimate;
  const model = useMemo(() => buildMonth({ month, today, periodDays, loggedDays, prediction, showEstimate }), [month, today, periodDays, loggedDays, prediction, showEstimate]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads the day after every write
  useEffect(() => {
    if (!store) return;
    void dayEvents(store, selected).then((evs) => setSummary(evs.filter((e) => e.kind !== 'period.start' && e.kind !== 'period.end').map((e) => shortDescribe(e, tr, prefs.tempUnit))));
  }, [store, selected, version, tr, prefs.tempUnit]);

  const cycleDay = useMemo(() => {
    const start = [...(history?.cycles ?? [])].reverse().find((c) => c.start <= selected);
    if (!start) return undefined;
    const n = diffDays(selected, start.start) + 1;
    return n >= 1 && n <= 90 ? n : undefined;
  }, [history, selected]);
  const flag = useMemo(() => buildToday({ prediction, hasCycles: (history?.cycles.length ?? 0) > 0, today, showEstimate: false, todayFlow: undefined }).flags.find((f) => !f.insightOnly), [prediction, history, today]);
  const isFuture = selected > today;

  const nav = (delta: number, id: string, label: string) => (
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} onPress={() => setMonth(shiftMonth(month, delta))} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="heading">{delta < 0 ? '‹' : '›'}</Text>
    </Pressable>
  );
  const legend: Array<[Parameters<typeof Swatch>[0]['kind'], string]> = [['period', 'period'], ['predicted', 'predicted'], ['fertile', 'fertile'], ['ovulation', 'ovulation'], ['logged', 'logged']];
  return (
    <Screen testID="screen-calendar" title={tr('calendar.title')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {nav(-1, 'cal-prev', tr('calendar.prevMonth'))}
        <Text variant="heading" accessibilityRole="header" testID="cal-title">{model.title}</Text>
        {nav(1, 'cal-next', tr('calendar.nextMonth'))}
      </View>
      <View style={{ flexDirection: 'row' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {(tr('calendar.weekdays', { returnObjects: true }) as unknown as string[]).map((w) => <Text key={w} variant="caption" color="textSecondary" style={{ width: `${100 / 7}%`, textAlign: 'center' }}>{w}</Text>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }} testID="cal-grid">
        {model.cells.map((c) => <DayCellView key={c.date} cell={c} selected={c.date === selected} onPress={() => { setSelected(c.date); if (!c.inMonth) setMonth(monthOf(c.date)); }} />)}
      </View>
      {flag ? <FlagCard f={flag} onMute={(c) => void muteFlag(c)} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }} accessibilityLabel={tr('calendar.legend.period')}>
        {legend.map(([k, key]) => (
          <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Swatch kind={k} />
            <Text variant="caption" color="textSecondary">{tr(`calendar.legend.${k === 'logged' ? 'logged' : k}`)}</Text>
          </View>
        ))}
      </View>
      {model.ovulationUncertain ? <Text variant="caption" color="textSecondary" testID="cal-uncertain">{tr('calendar.ovulationUncertainCaption')}</Text> : null}
      {showEstimate ? <Text variant="caption" color="textSecondary">{tr('today.legendFertile')}</Text> : null}
      <Card testID="cal-summary">
        <Text variant="heading" accessibilityRole="header">{formatLong(selected)}</Text>
        <Text variant="bodySmall" color="textSecondary" testID="cal-summary-text">
          {[cycleDay ? tr('calendar.summaryDay', { day: cycleDay }) : null, ...(summary.length ? summary : [tr('calendar.summaryNothing')])].filter(Boolean).join(' · ')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
          <Button kind="text" testID="cal-edit" label={tr('calendar.edit')} disabled={isFuture} onPress={() => router.push({ pathname: '/log', params: { day: selected } })} />
          <Button kind="text" testID="cal-details" label={tr('calendar.details')} onPress={() => router.push({ pathname: '/day/[date]', params: { date: selected } })} />
        </View>
      </Card>
      <Button testID="cal-add-earlier" kind="secondary" label={tr('calendar.addEarlier')} onPress={() => router.push({ pathname: '/log', params: { day: isFuture ? today : selected, section: 'period' } })} />
    </Screen>
  );
}
