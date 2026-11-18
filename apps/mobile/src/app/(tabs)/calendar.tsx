import { addDays, analyzeCycles, type ISODate } from '@sanguine/engine';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { effectivePrefs } from '@/data/prefs';
import { buildMonth, calendarLegend, cycleDayOf, dayEstimates, type LegendKind, monthOf, monthRows, shiftMonth } from '@/features/calendar/calendarModel';
import { weekdayLabels } from '@/i18n/locale';
import { deviceRegion, deviceWeekStart } from '@/services/locale';
import { lunarAligned, moonPhaseDays, southernRegion } from '@/features/calendar/moon';
import { MoonGlyph } from '@/features/calendar/MoonGlyph';
import { DayCellView } from '@/features/calendar/DayCellView';
import { type Detent, DaySheet } from '@/features/calendar/DaySheet';
import { MonthList } from '@/features/calendar/MonthList';
import { SwipeMonth } from '@/features/calendar/SwipeMonth';
import { useCalendarData } from '@/features/calendar/useCalendarData';
import { dayEvents, type DayEvent } from '@/features/logging/actions';
import { describeEvent } from '@/features/logging/describe';
import { removeEntry, undoRemoval, visibleEntries } from '@/features/logging/removeEntry';
import { FlagCard } from '@/features/today/cards';
import { EstimateSections } from '@/features/guidance/sections/EstimateSections';
import { GuidanceSections } from '@/features/guidance/sections/GuidanceSections';
import { phaseOn, showSupplements } from '@/features/guidance/guidance';
import { buildToday, SHOW_OVULATION_ESTIMATE } from '@/features/today/todayModel';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { GlassSurface } from '@/ui/GlassBar';
import { Screen } from '@/ui/Screen';
import { showToast } from '@/ui/Toast';
import { Text } from '@/ui/Text';

/** The legend swatch of a mark, drawn like the grid: solid is logged, dashed or glowing is an estimate. */
function Swatch({ kind, southern }: { kind: LegendKind; southern: boolean }) {
  const t = useTheme();
  if (kind === 'cycleDay') return <Text variant="caption" tabular style={{ fontSize: 10, lineHeight: 14, fontWeight: '600', color: t.c.textSecondary }}>1</Text>;
  if (kind === 'moon') return <MoonGlyph phase="first" southern={southern} size={14} color={t.c.textSecondary} />;
  if (kind === 'period') return <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.c.period }} />;
  if (kind === 'predicted') return <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.c.period }} />;
  if (kind === 'fertile') return <View style={{ width: 16, height: 10, borderRadius: 5, overflow: 'hidden' }}><View style={{ flex: 1, backgroundColor: t.c.fertile, opacity: 0.25 }} /><View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1.5, backgroundColor: t.c.fertile }} /></View>;
  if (kind === 'ovulation') return <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.c.bg, boxShadow: `0 0 0 1px ${t.c.ovulation}4D, 0 0 5px 1px ${t.c.ovulation}73` }} />;
  return <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: kind === 'symptoms' ? t.c.accent : t.c.textSecondary }} />;
}

export default function CalendarScreen() {
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { prediction, history, settings, today, prefs, profile, store, db, version, refresh } = useApp();
  const muteFlag = useApp((s) => s.muteFlag);
  const t = useTheme();
  const { periodDays, loggedDays, symptomDays, loggedText, pastOv } = useCalendarData();
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState<ISODate>(today);
  const [detent, setDetent] = useState<Detent>('closed');
  const [events, setEvents] = useState<DayEvent[]>([]);

  // gated by teen mode and the ovulation-estimate switch: a stored "show uncertain estimates" never outranks them (D-115)
  const eff = effectivePrefs(prefs, profile, today);
  const showEstimate = SHOW_OVULATION_ESTIMATE && eff.showOvulationEstimate;
  const includeUncertain = eff.showUncertainEstimates;
  const weekStart = useMemo(deviceWeekStart, []);
  // moon phases (D-089): only when the recent cycles run close to a lunar month; decoration, never an estimate
  const records = useMemo(() => (history && settings ? analyzeCycles(history, settings).map((c) => c.record) : []), [history, settings]);
  const lunar = useMemo(() => lunarAligned(records), [records]);
  const southern = useMemo(() => southernRegion(deviceRegion()), []);
  const moon = useMemo(() => {
    if (!lunar) return undefined;
    const first = `${month}-01` as ISODate;
    const localDay = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` as ISODate; };
    return moonPhaseDays(addDays(first, -7), addDays(first, 49), localDay);
  }, [lunar, month]);
  const cycleStarts = useMemo(() => history?.cycles.map((c) => c.start) ?? [], [history]);
  const model = useMemo(() => buildMonth({ month, today, periodDays, loggedDays, symptomDays, prediction, pastOv, showEstimate, includeUncertain, weekStart, cycleStarts, ...(moon ? { moon } : {}) }), [month, today, periodDays, loggedDays, symptomDays, prediction, pastOv, showEstimate, includeUncertain, weekStart, cycleStarts, moon]);
  const rows = useMemo(() => monthRows({ month, today, periodDays, loggedText, prediction, pastOv, showEstimate, includeUncertain, cycleStarts }), [month, today, periodDays, loggedText, prediction, pastOv, showEstimate, includeUncertain, cycleStarts]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads the day after every write
  useEffect(() => {
    if (!store) return;
    void dayEvents(store, selected).then((evs) => setEvents(visibleEntries(evs)));
  }, [store, selected, version]);

  const isFuture = selected > today;
  const flag = useMemo(() => buildToday({ prediction, hasCycles: (history?.cycles.length ?? 0) > 0, today, showEstimate: false, todayFlow: undefined }).flags.find((f) => !f.insightOnly), [prediction, history, today]);
  // what the marks on the selected day mean, in words (D-104); a future day with none says so
  const estimates = useMemo(() => dayEstimates(selected, { prediction, pastOv, showEstimate, includeUncertain, period: periodDays.has(selected) }), [selected, prediction, pastOv, showEstimate, includeUncertain, periodDays]);
  const estimateLines = estimates.length || !isFuture ? estimates : [tr('day.estimates.none')];
  // food and movement notes for the selected day: same call and inputs as the day screen, so both show the same phase
  const guide = useMemo(
    () => (prefs.cycleGuidance ? phaseOn({ date: selected, today, prediction, cycles: records, showEstimate }) : undefined),
    [prefs.cycleGuidance, selected, today, prediction, records, showEstimate],
  );
  // her recent closed periods, oldest first, for the period-end card
  const periodLengths = useMemo(() => records.filter((r) => r.nextStart && r.bleedDays).map((r) => r.bleedDays as number).slice(-6), [records]);
  const goToday = () => { setMonth(monthOf(today)); setSelected(today); };
  const select = (d: ISODate) => { setSelected(d); setMonth(monthOf(d)); };

  // removal is a retraction (append-only); the toast's Undo retracts what the removal wrote (D-113, D-118)
  const onRemove = useCallback(async (id: string) => {
    const e = events.find((x) => x.id === id);
    if (!e || !db || !store) return;
    const label = describeEvent(e, tr, prefs.tempUnit);
    const written = await removeEntry(store, db, e);
    await refresh();
    showToast(tr('log.removed', { label }), { label: tr('common.undo'), onPress: () => void undoRemoval(store, written).then(refresh) });
  }, [events, db, store, tr, prefs.tempUnit, refresh]);

  const cells = model.cells;
  const selectedCell = cells.find((c) => c.date === selected);
  const sheet = (
    <DaySheet
      date={selected} today={today} cell={selectedCell} cycleDay={cycleDayOf(cycleStarts, selected)} period={periodDays.has(selected)}
      detent={detent} onDetent={setDetent} isFuture={isFuture}
      entries={events.map((e) => ({ id: e.id, label: describeEvent(e, tr, prefs.tempUnit), mark: e.kind === 'flow' ? 'flow' : e.kind === 'symptom' ? 'symptom' : 'other' }))}
      onRemove={(id) => void onRemove(id)} estimates={estimateLines}
      onLog={() => router.push({ pathname: '/log', params: { day: selected } })}
      onDetails={() => router.push({ pathname: '/day/[date]', params: { date: selected } })}
      detail={detent === 'large' ? (
        <>
          {prediction ? <EstimateSections prediction={prediction} day={selected} pastOv={pastOv} showEstimate={showEstimate} periodLengths={periodLengths} /> : null}
          {guide ? <GuidanceSections day={guide} supplements={showSupplements(eff.teen)} compact={false} /> : null}
        </>
      ) : undefined}
    />
  );

  const circle = (id: string, label: string, glyph: string, delta: number) => (
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} onPress={() => setMonth(shiftMonth(month, delta))} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: t.cardBg, borderWidth: 1, borderColor: t.hairline }}>
      <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ color: t.c.textOnGlass, fontSize: 22, lineHeight: 26 }}>{glyph}</Text>
    </Pressable>
  );
  // the navigation layer: month, Today as a secondary glass pill (never filled), the weekday row; everything on it is textOnGlass (accent fails on glass)
  const toolbar = (
    <GlassSurface>
      <View style={{ padding: 8, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          {circle('cal-prev', tr('calendar.prevMonth'), '‹', -1)}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', columnGap: 8 }}>
            {/* tap returns to today; VoiceOver/TalkBack swipe up or down on the title changes the month */}
            <Pressable
              testID="cal-title-button"
              accessibilityRole="adjustable"
              accessibilityLabel={model.title}
              accessibilityHint={tr('calendar.a11y.titleHint')}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }]}
              onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'activate' ? goToday() : setMonth(shiftMonth(month, e.nativeEvent.actionName === 'increment' ? 1 : -1)))}
              onPress={goToday}
              style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text variant="heading" testID="cal-title" style={{ color: t.c.textOnGlass }}>{model.title}</Text>
            </Pressable>
            {month !== monthOf(today) ? (
              <Pressable testID="cal-today" accessibilityRole="button" accessibilityLabel={tr('calendar.goToday')} onPress={goToday} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center', backgroundColor: t.cardBg, borderWidth: 1, borderColor: t.hairline }}>
                <Text variant="bodySmall" style={{ color: t.c.textOnGlass, fontWeight: '600' }}>{tr('calendar.today')}</Text>
              </Pressable>
            ) : null}
          </View>
          {circle('cal-next', tr('calendar.nextMonth'), '›', 1)}
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 6 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {weekdayLabels(tr('calendar.weekdays', { returnObjects: true }) as unknown as string[], weekStart).map((w) => <Text key={w} variant="caption" style={{ width: `${100 / 7}%`, textAlign: 'center', color: t.c.textOnGlass, fontWeight: '500' }}>{w}</Text>)}
        </View>
      </View>
    </GlassSurface>
  );

  // an uncertain estimate that is not drawn leaves no marker and no band, so the legend names neither (U-18, D-098, D-106); the numbers' entry goes with them
  const legend = [...calendarLegend(showEstimate), ...(moon ? (['moon'] as const) : [])].filter((k) => !(model.ovulationHidden && (k === 'ovulation' || k === 'fertile')) && !(k === 'cycleDay' && !prefs.calendarCycleDay));
  const onDay = (c: (typeof cells)[number]) => {
    if (c.date === selected) setDetent((d) => (d === 'closed' ? 'small' : d));
    else select(c.date);
  };
  return (
    <View style={{ flex: 1 }}>
      <Screen
        testID="screen-calendar" chrome={toolbar} bottomInset={24}
        // the day card is the sheet's lowest detent, above the tab bar; the content is padded by its measured height
        floating={detent === 'large' ? undefined : sheet}>
        <SwipeMonth month={month} onSwipe={(d) => setMonth((m) => shiftMonth(m, d))}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 }} testID="cal-grid">
            {cells.map((c, i) => (
              <DayCellView
                key={c.date} cell={c} southern={southern} selected={c.date === selected} cycleDays={prefs.calendarCycleDay}
                bandStart={i % 7 === 0 || cells[i - 1]?.fertile === undefined} bandEnd={i % 7 === 6 || cells[i + 1]?.fertile === undefined}
                onPress={() => onDay(c)} />
            ))}
          </View>
        </SwipeMonth>
        {flag ? <FlagCard f={flag} onMute={(c) => void muteFlag(c)} /> : null}
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {legend.map((k) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Swatch kind={k} southern={southern} />
                <Text variant="caption" color="textSecondary">{tr(`calendar.legend.${k}`)}</Text>
              </View>
            ))}
          </View>
          <Text variant="caption" color="textSecondary" testID="cal-legend-rule">{tr('calendar.legendRule')}</Text>
          {model.ovulationUncertain ? <Text variant="caption" color="textSecondary" testID="cal-uncertain">{tr('calendar.ovulationUncertainCaption')}</Text> : null}
          {showEstimate && !model.ovulationHidden ? <Text variant="caption" color="textSecondary" testID="cal-fertile-caption">{tr('today.legendFertile')}</Text> : null}
          {moon ? <Text variant="caption" color="textSecondary" testID="cal-moon-note">{tr('calendar.moonNote')}</Text> : null}
        </View>
        <MonthList title={model.title} rows={rows} periodDays={periodDays} selected={selected} today={today} onSelect={select} />
      </Screen>
      {detent === 'large' ? sheet : null}
    </View>
  );
}
