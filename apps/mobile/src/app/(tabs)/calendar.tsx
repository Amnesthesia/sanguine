import { addDays, analyzeCycles, type ISODate } from '@sanguine/engine';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { effectivePrefs } from '@/data/prefs';
import { buildMonth, countedStarts, cycleDayOf, cycleHeadlines, dayEstimates, type LegendKind, legendKinds, monthOf, monthRows, shiftMonth } from '@/features/calendar/calendarModel';
import { weekdayLabels } from '@/i18n/locale';
import { deviceRegion, deviceWeekStart } from '@/services/locale';
import { lunarAligned, moonPhaseDays, southernRegion } from '@/features/calendar/moon';
import { MoonGlyph } from '@/features/calendar/MoonGlyph';
import { DayCellView, ovulationGlow } from '@/features/calendar/DayCellView';
import { type Detent, DaySheet } from '@/features/calendar/DaySheet';
import { useDevParams, useDevScroll } from '@/features/dev/devParams';
import { MonthList } from '@/features/calendar/MonthList';
import { SheetDetail } from '@/features/calendar/SheetDetail';
import { SwipeMonth } from '@/features/calendar/SwipeMonth';
import { useCalendarData } from '@/features/calendar/useCalendarData';
import { dayEvents, type DayEvent } from '@/features/logging/actions';
import { visibleEntries } from '@/features/logging/removeEntry';
import { FlagCard } from '@/features/today/cards';
import { buildToday, SHOW_OVULATION_ESTIMATE } from '@/features/today/todayModel';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { GlassSurface } from '@/ui/GlassBar';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

/** The legend swatch of a mark, drawn like the grid: solid is logged, dashed, dotted or glowing is an estimate. Sizes as frame Calendar-1-Closed. */
function Swatch({ kind, southern }: { kind: LegendKind; southern: boolean }) {
  const t = useTheme();
  if (kind === 'cycleDay') return <Text variant="caption" tabular style={{ fontSize: 10, lineHeight: 14, fontWeight: '600', color: t.c.textSecondary }}>12</Text>;
  if (kind === 'moon') return <MoonGlyph phase="first" southern={southern} size={14} color={t.c.textSecondary} />;
  if (kind === 'period') return <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: t.c.period }} />;
  if (kind === 'predicted') return <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: t.c.period }} />;
  if (kind === 'predicted95') return <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderStyle: 'dotted', borderColor: t.c.period }} />;
  // the band's solid lower edge is kept (the frame's swatch has none): it is the grid's 3:1 mark for the fertile window (D-093)
  if (kind === 'fertile') return <View style={{ width: 22, height: 12, borderRadius: 6, overflow: 'hidden' }}><View style={{ flex: 1, backgroundColor: t.c.fertile, opacity: 0.35 }} /><View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1.5, backgroundColor: t.c.fertile }} /></View>;
  if (kind === 'ovulation') { const ov = ovulationGlow(t, '7px 2px'); return <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: ov.backgroundColor, boxShadow: ov.shadows.join(', ') }} />; }
  return <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: kind === 'symptoms' ? t.c.accent : t.c.textSecondary }} />;
}

export default function CalendarScreen() {
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { prediction, history, settings, today, prefs, profile, store, version, refresh } = useApp();
  const muteFlag = useApp((s) => s.muteFlag);
  const t = useTheme();
  const { periodDays, loggedDays, symptomDays, loggedText, pastOv } = useCalendarData();
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState<ISODate>(today);
  const [detent, setDetent] = useState<Detent>('closed');
  // dev only (tools/verify-screens): `?day=&sheet=` opens a day and a detent from a link; a new value is applied, the user's own taps are not undone
  const dev = useDevParams();
  const { scrollRef, anchor } = useDevScroll();
  useEffect(() => {
    if (dev.day) { setSelected(dev.day); setMonth(monthOf(dev.day)); }
    if (dev.sheet) setDetent(dev.sheet);
  }, [dev.day, dev.sheet]);
  const [sheetH, setSheetH] = useState(0);
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
  const todayModel = useMemo(() => buildToday({ prediction, hasCycles: (history?.cycles.length ?? 0) > 0, today, showEstimate: false, todayFlow: undefined }), [prediction, history, today]);
  const flag = todayModel.flags.find((f) => !f.insightOnly);
  // estimates paused (pregnancy, suspended): the bar names the state where the cycle day would be, and no day counts a cycle (fix plan C5)
  const pausedKey = todayModel.state === 'suspended' ? todayModel.headline.params?.stateKey : undefined;
  // what the marks on the selected day mean, in words (D-104); a future day with none says so
  const estimates = useMemo(() => {
    const input = { prediction, pastOv, showEstimate, includeUncertain, today };
    const own = dayEstimates(selected, { ...input, period: periodDays.has(selected) });
    // the open cycle's two headline estimates come first (frames), without repeating a line the day already has
    const heads = showEstimate ? cycleHeadlines(selected, input).filter((l) => !own.includes(l)) : [];
    return [...heads, ...own];
  }, [selected, prediction, pastOv, showEstimate, includeUncertain, periodDays, today]);
  const estimateLines = estimates.length || !isFuture ? estimates : [tr('day.estimates.none')];
  const goToday = () => { setMonth(monthOf(today)); setSelected(today); };
  const select = (d: ISODate) => { setSelected(d); setMonth(monthOf(d)); };

  const cells = model.cells;
  const selectedCell = cells.find((c) => c.date === selected);
  const sheet = (
    <DaySheet
      date={selected} today={today} cell={selectedCell} cycleDay={cycleDayOf(countedStarts({ prediction, cycleStarts }), selected)} paused={pausedKey ? tr(String(pausedKey)) : undefined} period={periodDays.has(selected)}
      detent={detent} onDetent={setDetent} onInset={setSheetH} isFuture={isFuture}
      entries={events} onChanged={refresh} estimates={estimateLines}
      onLog={() => router.push({ pathname: '/log', params: { day: selected } })}
      onDetails={() => router.push({ pathname: '/day/[date]', params: { date: selected } })}
      detail={() => <SheetDetail day={selected} pastOv={pastOv} cycleStarts={cycleStarts} periodDays={periodDays} showEstimate={showEstimate} includeUncertain={includeUncertain} teen={eff.teen} records={records} />}
    />
  );

  const circle = (id: string, label: string, glyph: string, delta: number) => (
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} onPress={() => setMonth(shiftMonth(month, delta))} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: t.cardBg, borderWidth: 1, borderColor: t.hairline }}>
      <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ color: t.c.textOnGlass, fontSize: 22, lineHeight: 26 }}>{glyph}</Text>
    </Pressable>
  );
  // the navigation layer: month, Today as a secondary glass pill (never filled), the weekday row; everything on it is textOnGlass (accent fails on glass).
  // Legible glass: the grid scrolls beneath it, and its numbers must not read through the month title (D-130, fix plan X1)
  const toolbar = (
    <GlassSurface legible>
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
            <Pressable testID="cal-today" accessibilityRole="button" accessibilityLabel={tr('calendar.goToday')} onPress={goToday} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center', backgroundColor: t.cardBg, borderWidth: 1, borderColor: t.hairline }}>
              <Text variant="bodySmall" style={{ color: t.c.textOnGlass, fontWeight: '600' }}>{tr('calendar.today')}</Text>
            </Pressable>
          </View>
          {circle('cal-next', tr('calendar.nextMonth'), '›', 1)}
        </View>
        {/* single letters as the frame (M T W T F S S); hidden from screen readers, each cell's label names its weekday */}
        <View testID="cal-weekdays" style={{ flexDirection: 'row', paddingHorizontal: 6 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {/* the seven weekday initials repeat (T, S), so the position is the identity */}
          {weekdayLabels(tr('calendar.weekdays', { returnObjects: true }) as unknown as string[], weekStart).map((w, k) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: M T W T F S S repeat; the position is the identity
            <Text key={k} variant="caption" style={{ width: `${100 / 7}%`, textAlign: 'center', color: t.c.textOnGlass, fontWeight: '500' }}>{w}</Text>
          ))}
        </View>
      </View>
    </GlassSurface>
  );

  // the legend names only what the grid draws (D-118): an uncertain estimate that is not drawn, a paused month or the cycle-day setting off
  // leave their entries out (U-18, D-098, D-106; fix plan C3, C5)
  const legend = legendKinds(cells, { showEstimate, cycleDays: prefs.calendarCycleDay });
  const onDay = (c: (typeof cells)[number]) => {
    if (c.date === selected) setDetent((d) => (d === 'closed' ? 'small' : d)); // the bar opens to the sheet
    else select(c.date);
  };
  const large = detent === 'large';
  return (
    <View style={{ flex: 1 }}>
      {/* the large detent is modal: screen readers leave the toolbar and the grid behind its scrim alone */}
      <View style={{ flex: 1 }} aria-hidden={large} accessibilityElementsHidden={large} importantForAccessibility={large ? 'no-hide-descendants' : 'auto'}>
        <Screen
          // the sheet floats above the tab bar (12 pt gap); the content is padded by its settled height so the last row scrolls clear of it
          testID="screen-calendar" chrome={toolbar} scrollRef={scrollRef} bottomInset={24 + 12 + sheetH}>
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, columnGap: 14 }}>
              {legend.map((k) => (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                  <Swatch kind={k} southern={southern} />
                  <Text variant="caption" color="textSecondary" style={{ flexShrink: 1 }}>{tr(`calendar.legend.${k}`)}</Text>
                </View>
              ))}
            </View>
            <Text variant="caption" color="textSecondary" testID="cal-legend-rule">{tr('calendar.legendRule')}</Text>
            {model.ovulationUncertain ? <Text variant="caption" color="textSecondary" testID="cal-uncertain">{tr('calendar.ovulationUncertainCaption')}</Text> : null}
            {moon ? <Text variant="caption" color="textSecondary" testID="cal-moon-note">{tr('calendar.moonNote')}</Text> : null}
          </View>
          <View {...anchor('list')}><MonthList title={model.monthName} rows={rows} periodDays={periodDays} selected={selected} today={today} onSelect={select} /></View>
        </Screen>
      </View>
      {/* the sheet sits over the screen at every detent, so a drag moves one sheet from the bar to the full detail */}
      {sheet}
    </View>
  );
}
