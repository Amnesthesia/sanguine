// Day detail (PLAN.md §8.3; frames Day-Screen, Day-Screen-Future): the Log this day button pinned at the bottom, the cycle day, what was logged as
// removable chips with provenance, the correction actions, the day's estimates as short rows with meters, food and movement as two tiles, and
// "More about this cycle ›" to Insights > This cycle, where the full explanations live (D-134).
import { analyzeCycles, type ISODate, pastOvulations } from '@sanguine/engine';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { effectivePrefs } from '@/data/prefs';
import { DayEstimateRows } from '@/features/guidance/sections/EstimateSections';
import { GuidanceSections } from '@/features/guidance/sections/GuidanceSections';
import { cycleDayOf, dayEstimates } from '@/features/calendar/calendarModel';
import { useDevScroll } from '@/features/dev/devParams';
import { usePeriodDays } from '@/features/calendar/useCalendarData';
import { phaseOn, showSupplements } from '@/features/guidance/guidance';
import { type DayEvent, dayEvents, dayState, markNotAPeriod, markSpotting } from '@/features/logging/actions';
import { describeEvent } from '@/features/logging/describe';
import { LoggedEntries } from '@/features/logging/LoggedEntries';
import { visibleEntries } from '@/features/logging/removeEntry';
import { MoreAboutThisCycle } from '@/features/insights/ThisCycle';
import { SHOW_OVULATION_ESTIMATE } from '@/features/today/todayModel';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { formatLong } from '@/ui/format';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

/** "imported · Natural Cycles" or "from a sensor" as a muted suffix; nothing for a manual entry. */
function provenance(e: DayEvent, tr: (k: string) => string): string {
  if (e.provenance === 'manual') return '';
  return e.provenance === 'imported' ? ` · ${tr('day.provenance.imported')}${e.source_app ? ` · ${e.source_app}` : ''}` : ` · ${tr('day.provenance.sensor')}`;
}

export default function DayDetail() {
  const { t: tr } = useTranslation();
  const t = useTheme();
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const day = date as ISODate;
  const { db, store, prefs, profile, prediction, today, history, settings, refresh, version } = useApp();
  const [events, setEvents] = useState<DayEvent[]>([]);
  const [isPeriodDay, setIsPeriodDay] = useState(false);
  const { scrollRef, anchor } = useDevScroll(); // dev only: `?scroll=estimates|guidance` (tools/verify-screens)

  const reload = useCallback(async () => {
    if (!store || !db) return;
    setEvents(await dayEvents(store, day));
    const s = await dayState(db, day);
    setIsPeriodDay(s.flowKind === 'period' && s.flow !== null && s.flow !== 'none');
  }, [store, db, day]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads entries after writes in the log sheet
  useEffect(() => { void reload(); }, [reload, version]);
  // a future day cannot be logged: estimates only, no entries and no "Nothing logged"
  const isFuture = day > today;
  const eff = effectivePrefs(prefs, profile, today);
  const showEstimate = SHOW_OVULATION_ESTIMATE && eff.showOvulationEstimate;
  const cycles = useMemo(() => (history && settings ? analyzeCycles(history, settings).map((c) => c.record) : []), [history, settings]);
  const pastOv = useMemo(() => (history && settings ? pastOvulations(history, settings) : []), [history, settings]);
  const cycleStarts = useMemo(() => history?.cycles.map((c) => c.start) ?? [], [history]);
  const periodDays = usePeriodDays(); // the same logged period days the calendar and the dial draw solid
  // the same words as the calendar's day sheet for this day (one source: calendarModel.dayEstimates)
  const lines = useMemo(
    () => dayEstimates(day, { prediction, pastOv, showEstimate, includeUncertain: eff.showUncertainEstimates, period: periodDays.has(day), today }),
    [day, prediction, pastOv, showEstimate, eff.showUncertainEstimates, periodDays, today],
  );
  const guide = useMemo(
    () => (prefs.cycleGuidance && history && settings ? phaseOn({ date: day, today, prediction, cycles, showEstimate }) : undefined),
    [prefs.cycleGuidance, history, settings, day, today, prediction, cycles, showEstimate],
  );
  const after = async () => { await refresh(); await reload(); };
  const entries = visibleEntries(events);
  // "Day 2 of your cycle · Period": the same count as the calendar's day sheet; a future day's is an estimate
  const cycleDay = cycleDayOf(cycleStarts, day);
  const subline = [cycleDay ? tr('day.subline.cycleDay', { day: cycleDay }) : null, isFuture ? tr('day.subline.estimate') : isPeriodDay ? tr('day.subline.period') : null].filter(Boolean).join(' · ');

  const live = prediction && !prediction.suspended ? prediction : undefined;
  const plus = <Svg width={16} height={16} viewBox="0 0 16 16"><Path d="M8 2V14M2 8H14" stroke={t.c.onAccent} strokeWidth={2.2} strokeLinecap="round" /></Svg>;
  return (
    <SubScreen testID="screen-day" backTestID="day-back" scrollRef={scrollRef} title={formatLong(day)} bottomInset={32} floating={isFuture ? undefined : <Button testID="day-edit" label={tr('calendar.edit')} icon={plus} onPress={() => router.push({ pathname: '/log', params: { day } })} />}>
      {subline ? <Text testID="day-subline" color="textSecondary" style={{ marginHorizontal: 4 }}>{subline}</Text> : null}
      {isFuture ? (
        <Card testID="day-future-note" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
          <Svg width={16} height={16} viewBox="0 0 16 16" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Rect x={2} y={3} width={12} height={11} rx={2.5} fill="none" stroke={t.c.textSecondary} strokeWidth={1.4} /><Path d="M2 6.5H14M5.5 1.5V4M10.5 1.5V4" stroke={t.c.textSecondary} strokeWidth={1.4} strokeLinecap="round" /></Svg>
          <Text style={{ flex: 1 }}>{tr('calendar.futureNote')}</Text>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          <Text variant="title" accessibilityRole="header">{tr('log.loggedOnDay')}</Text>
          <LoggedEntries entries={entries} onChanged={after} labelFor={(e) => `${describeEvent(e, tr, prefs.tempUnit)}${provenance(e, tr)}`} />
        </View>
      )}
      {isPeriodDay && !isFuture && db && store ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button testID="day-not-period" kind="secondary" label={tr('day.notAPeriod')} onPress={() => void markNotAPeriod(store, db, day).then(after)} />
          <Button testID="day-spotting" kind="secondary" label={tr('day.markSpotting')} onPress={() => void markSpotting(store, day).then(after)} />
        </View>
      ) : null}
      <View {...anchor('estimates')}><DayEstimateRows lines={lines} future={isFuture} note bar={isFuture && live?.nextPeriod ? { next: live.nextPeriod, day } : undefined} /></View>
      {guide ? <View {...anchor('guidance')}><GuidanceSections day={guide} supplements={showSupplements(eff.teen)} extras={showEstimate} compact /></View> : null}
      {live || guide ? <MoreAboutThisCycle /> : null}
    </SubScreen>
  );
}
