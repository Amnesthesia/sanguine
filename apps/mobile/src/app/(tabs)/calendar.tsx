import { addDays, analyzeCycles, type ISODate } from '@sanguine/engine';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { effectivePrefs } from '@/data/prefs';
import { buildMonth, calendarLegend, cycleDayOf, dayEstimates, type LegendKind, monthOf, shiftMonth } from '@/features/calendar/calendarModel';
import { weekdayLabels } from '@/i18n/locale';
import { deviceRegion, deviceWeekStart } from '@/services/locale';
import { lunarAligned, moonPhaseDays, southernRegion } from '@/features/calendar/moon';
import { MoonGlyph } from '@/features/calendar/MoonGlyph';
import { CycleDayBadge, DayCellView } from '@/features/calendar/DayCellView';
import { SwipeMonth } from '@/features/calendar/SwipeMonth';
import { useCalendarData } from '@/features/calendar/useCalendarData';
import { dayEvents } from '@/features/logging/actions';
import { shortDescribe } from '@/features/logging/describe';
import { FlagCard } from '@/features/today/cards';
import { QuickLogRow } from '@/features/today/QuickLogRow';
import { buildToday, SHOW_OVULATION_ESTIMATE } from '@/features/today/todayModel';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { formatLong } from '@/ui/format';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { DropGlyph } from '@/features/logging/DropGlyph';

function Swatch({ kind, southern }: { kind: LegendKind; southern: boolean }) {
  const t = useTheme();
  if (kind === 'cycleDay') return <CycleDayBadge day={1} inverted={false} />;
  if (kind === 'moon') return <MoonGlyph phase="first" southern={southern} size={14} color={t.c.textSecondary} />;
  const base = { width: 14, height: 14, borderRadius: 4 } as const;
  if (kind === 'period') return <View style={{ ...base, backgroundColor: t.c.period, alignItems: 'center', justifyContent: 'center' }}><DropGlyph fill={1} size={9} color="#FFFFFF" /></View>;
  if (kind === 'predicted') return <View style={{ ...base, borderWidth: 1.5, borderColor: t.c.periodPredicted, borderStyle: 'dashed' }} />;
  if (kind === 'fertile') return <View style={{ width: 14, height: 4, backgroundColor: t.c.fertile, borderRadius: 2 }} />;
  if (kind === 'ovulation') return <View style={{ width: 14, height: 2, backgroundColor: t.c.ovulation }} />;
  return <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.c.textSecondary }} />;
}

export default function CalendarScreen() {
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { prediction, history, settings, today, prefs, profile, store, version } = useApp();
  const muteFlag = useApp((s) => s.muteFlag);
  const t = useTheme();
  const { periodDays, loggedDays } = useCalendarData();
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState<ISODate>(today);
  const [summary, setSummary] = useState<string[]>([]);

  const showEstimate = SHOW_OVULATION_ESTIMATE && effectivePrefs(prefs, profile, today).showOvulationEstimate;
  const weekStart = useMemo(deviceWeekStart, []);
  // moon phases (D-089): only when the recent cycles run close to a lunar month; decoration, never an estimate
  const lunar = useMemo(() => (history && settings ? lunarAligned(analyzeCycles(history, settings).map((c) => c.record)) : false), [history, settings]);
  const southern = useMemo(() => southernRegion(deviceRegion()), []);
  const moon = useMemo(() => {
    if (!lunar) return undefined;
    const first = `${month}-01` as ISODate;
    const localDay = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` as ISODate; };
    return moonPhaseDays(addDays(first, -7), addDays(first, 49), localDay);
  }, [lunar, month]);
  const cycleStarts = useMemo(() => history?.cycles.map((c) => c.start) ?? [], [history]);
  const model = useMemo(() => buildMonth({ month, today, periodDays, loggedDays, prediction, showEstimate, weekStart, cycleStarts, ...(moon ? { moon } : {}) }), [month, today, periodDays, loggedDays, prediction, showEstimate, weekStart, cycleStarts, moon]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads the day after every write
  useEffect(() => {
    if (!store) return;
    void dayEvents(store, selected).then((evs) => setSummary(evs.filter((e) => e.kind !== 'period.start' && e.kind !== 'period.end').map((e) => shortDescribe(e, tr, prefs.tempUnit))));
  }, [store, selected, version, tr, prefs.tempUnit]);

  const cycleDay = cycleDayOf(cycleStarts, selected);
  const flag = useMemo(() => buildToday({ prediction, hasCycles: (history?.cycles.length ?? 0) > 0, today, showEstimate: false, todayFlow: undefined }).flags.find((f) => !f.insightOnly), [prediction, history, today]);
  const isFuture = selected > today;
  // what the marks on the selected day mean, in words (D-104); a future day has nothing to log, so it says no "Nothing logged"
  const estimates = useMemo(() => dayEstimates(selected, prediction, showEstimate, periodDays.has(selected)), [selected, prediction, showEstimate, periodDays]);
  const summaryLine = [cycleDay ? tr('calendar.summaryDay', { day: cycleDay }) : null, ...(summary.length ? summary : isFuture ? [] : [tr('calendar.summaryNothing')])].filter(Boolean).join(' · ');
  const estimateLines = estimates.length || !isFuture ? estimates : [tr('day.estimates.none')];
  const goToday = () => { setMonth(monthOf(today)); setSelected(today); };

  const nav = (delta: number, id: string, label: string) => (
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} onPress={() => setMonth(shiftMonth(month, delta))} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="heading" color="accent" style={{ fontSize: 28, lineHeight: 32 }}>{delta < 0 ? '‹' : '›'}</Text>
    </Pressable>
  );
  const legend: Array<[LegendKind, string]> = [...calendarLegend(showEstimate), ...(moon ? (['moon'] as const) : [])].filter((k) => k !== 'ovulation' || !model.ovulationUncertain).map((k) => [k, k]); // no marker is drawn for an uncertain estimate (U-18)
  return (
    <Screen
      testID="screen-calendar" title={tr('calendar.title')}
      // logging is the one button, pinned above the tab bar (U-20, D-076, D-099); a future day cannot be logged, so it has none
      floating={isFuture ? undefined : <QuickLogRow day={selected} testID="cal-edit" label={tr('calendar.edit')} accessibilityLabel={`${tr('calendar.edit')}: ${formatLong(selected)}`} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {nav(-1, 'cal-prev', tr('calendar.prevMonth'))}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8 }}>
          {/* tap returns to today; VoiceOver/TalkBack swipe up or down on the title changes the month */}
          <Pressable
            testID="cal-title-button"
            accessibilityRole="adjustable"
            accessibilityLabel={model.title}
            accessibilityHint={tr('calendar.a11y.titleHint')}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }]}
            onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'activate' ? goToday() : setMonth(shiftMonth(month, e.nativeEvent.actionName === 'increment' ? 1 : -1)))}
            onPress={goToday}
            style={{ minHeight: 48, justifyContent: 'center' }}>
            <Text variant="heading" testID="cal-title">{model.title}</Text>
          </Pressable>
          {month !== monthOf(today) ? (
            <Pressable testID="cal-today" accessibilityRole="button" accessibilityLabel={tr('calendar.goToday')} onPress={goToday} style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 22, justifyContent: 'center', backgroundColor: t.c.accentSoft }}>
              <Text variant="caption" color="onAccentSoft">{tr('calendar.today')}</Text>
            </Pressable>
          ) : null}
        </View>
        {nav(1, 'cal-next', tr('calendar.nextMonth'))}
      </View>
      <View style={{ flexDirection: 'row' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {weekdayLabels(tr('calendar.weekdays', { returnObjects: true }) as unknown as string[], weekStart).map((w) => <Text key={w} variant="caption" color="textSecondary" style={{ width: `${100 / 7}%`, textAlign: 'center' }}>{w}</Text>)}
      </View>
      <SwipeMonth month={month} onSwipe={(d) => setMonth((m) => shiftMonth(m, d))}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }} testID="cal-grid">
          {model.cells.map((c) => <DayCellView key={c.date} cell={c} southern={southern} selected={c.date === selected} onPress={() => { setSelected(c.date); if (!c.inMonth) setMonth(monthOf(c.date)); }} />)}
        </View>
      </SwipeMonth>
      {flag ? <FlagCard f={flag} onMute={(c) => void muteFlag(c)} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {legend.map(([k, key]) => (
          <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Swatch kind={k} southern={southern} />
            <Text variant="caption" color="textSecondary">{tr(`calendar.legend.${k === 'logged' ? 'logged' : k}`)}</Text>
          </View>
        ))}
      </View>
      {model.ovulationUncertain ? <Text variant="caption" color="textSecondary" testID="cal-uncertain">{tr('calendar.ovulationUncertainCaption')}</Text> : null}
      {showEstimate ? <Text variant="caption" color="textSecondary">{tr('today.legendFertile')}</Text> : null}
      {moon ? <Text variant="caption" color="textSecondary" testID="cal-moon-note">{tr('calendar.moonNote')}</Text> : null}
      {/* the card is the way to the day's detail */}
      <Pressable testID="cal-details" style={{ minHeight: 56 }} accessibilityRole="button" accessibilityLabel={[formatLong(selected), summaryLine, ...estimateLines, tr('calendar.details')].filter(Boolean).join('. ')} onPress={() => router.push({ pathname: '/day/[date]', params: { date: selected } })}>
        <Card testID="cal-summary" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="heading" accessibilityRole="header">{formatLong(selected)}</Text>
            {summaryLine ? <Text variant="bodySmall" color="textSecondary" testID="cal-summary-text">{summaryLine}</Text> : null}
            {estimateLines.map((l) => <Text key={l} variant="bodySmall" testID="cal-estimate">{l}</Text>)}
          </View>
          <Text color="textSecondary" accessibilityElementsHidden>›</Text>
        </Card>
      </Pressable>
      {isFuture ? <Text variant="caption" color="textSecondary" testID="cal-future-note">{tr('calendar.futureNote')}</Text> : null}
    </Screen>
  );
}
