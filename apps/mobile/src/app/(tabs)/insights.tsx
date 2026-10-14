import { energyInsight, MIN_CHART_POINTS } from '@/features/insights/energyModel';
import { GUIDANCE, phaseOn } from '@/features/guidance/guidance';
import { SHOW_OVULATION_ESTIMATE } from '@/features/today/todayModel';
import { addDays, analyzeCycles, detectBbtShift, diffDays } from '@sanguine/engine';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { type LedgerRow, ledgerRows, ledgerSummary, type LedgerSummary } from '@/data/ledger';
import { energyDays, fromC } from '@/features/logging/actions';
import { effectivePrefs } from '@/data/prefs';
import { EnergyChart, LengthChart, TempChart } from '@/features/insights/charts';
import { HistoryRow } from '@/features/insights/HistoryRow';
import { accuracyText, cycleLengthSeries, historyRows, phaseBars } from '@/features/insights/insightsModel';
import { addPastPregnancy } from '@/features/settings/lifeState';
import { cyclePattern, inPatternState } from '@/features/insights/patternModel';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { formatDay, formatRange } from '@/ui/format';
import { Text } from '@/ui/Text';

type Tab = 'history' | 'charts' | 'accuracy';
// below these a chart is two dots on an empty axis and reads as broken (U-22, D-076)
const MIN_LENGTH_POINTS = 3; // two points are one line segment, not a trend (U-22, D-093); only cycles marked typical count (cycleLengthSeries); copy insights.chart.fewLengths names the 3
const MIN_TEMP_POINTS = 6;

export default function InsightsScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { history, settings, prediction, today, prefs, profile, db, store, refresh, version } = useApp();
  const eff = effectivePrefs(prefs, profile, today);
  const { fertilityTools } = eff;
  const [tab, setTab] = useState<Tab>('history');
  const [ledger, setLedger] = useState<LedgerSummary>({ total: 0, in80: 0, in95: 0, meanAbsError: 0 });
  const [scored, setScored] = useState<LedgerRow[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads the ledger after every write
  useEffect(() => { if (db) { void ledgerSummary(db).then(setLedger); void ledgerRows(db).then(setScored); } }, [db, version]);

  const cycles = useMemo(() => (history && settings ? analyzeCycles(history, settings).map((c) => c.record) : []), [history, settings]);
  const [energyPoints, setEnergyPoints] = useState<Array<{ day: string; level: number }>>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads after every write
  useEffect(() => { if (db) void energyDays(db).then(setEnergyPoints); }, [db, version]);
  const showEstimate = SHOW_OVULATION_ESTIMATE && eff.showOvulationEstimate;
  const energy = useMemo(
    () => energyInsight(energyPoints, today, (d) => phaseOn({ date: d, today, prediction, cycles, showEstimate })),
    [energyPoints, today, prediction, cycles, showEstimate],
  );
  const energyFrom = addDays(today, -83);
  const energyMean = energy.window.length ? Math.round((energy.window.reduce((a, p) => a + p.level, 0) / energy.window.length) * 10) / 10 : 0;
  const closed = cycles.filter((c) => c.length !== undefined).length;
  const rows = useMemo(() => historyRows(cycles, today), [cycles, today]);
  const series = useMemo(() => cycleLengthSeries(cycles, prediction?.cycleLength), [cycles, prediction]);
  const bars = useMemo(() => phaseBars(cycles, history?.logs ?? [], today), [cycles, history, today]);
  const pattern = useMemo(() => (settings && inPatternState(settings.lifeStates, today) ? cyclePattern(cycles, history?.logs ?? [], today) : undefined), [settings, cycles, history, today]);
  const open = cycles.at(-1);
  const temps = useMemo(() => {
    if (!open || !history) return { points: [] as Array<{ day: number; value: number }>, coverline: undefined as number | undefined };
    const mine = history.temperatures.filter((r) => r.date >= open.start && !r.disturbed && (r.source === 'oral' || r.source === 'vaginal' || r.source === 'other'));
    return { points: mine.map((r) => ({ day: diffDays(r.date, open.start) + 1, value: fromC(r.valueC, prefs.tempUnit) })), coverline: fertilityTools ? detectBbtShift(history.temperatures, open.start)?.coverlineC : undefined };
  }, [open, history, prefs.tempUnit, fertilityTools]);
  const acc = accuracyText(ledger);
  const empty = closed < 2;

  return (
    <Screen testID="screen-insights" title={tr('insights.title')}>
      <Segmented testIDPrefix="insights-tab" value={tab} onChange={setTab} options={[{ value: 'history', label: tr('insights.segments.history') }, { value: 'charts', label: tr('insights.segments.charts') }, { value: 'accuracy', label: tr('insights.segments.accuracy') }]} />

      {tab === 'history' ? (
        rows.length === 0 || empty ? (
          <Card testID="insights-empty"><Text color="textSecondary">{tr('insights.needTwo')}</Text></Card>
        ) : (
          rows.map((r) => (
            <HistoryRow key={r.id} r={r} fertilityTools={fertilityTools} onOpen={() => router.push({ pathname: '/cycle/[id]', params: { id: r.id } })} actions={
              r.offerMissedLog && r.midDay ? (
                <View style={{ gap: 2 }}>
                  <Button kind="text" testID="missed-log" label={tr('insights.missedLogPrompt')} onPress={() => router.push({ pathname: '/log', params: { day: r.midDay as string } })} />
                  {r.nextStartISO ? <Button kind="text" testID="was-pregnant" label={tr('insights.wasPregnant')} onPress={() => {
                    const mark = (outcome: 'birth' | 'loss') => { if (store && r.nextStartISO) void addPastPregnancy(store, { from: r.startISO, until: r.nextStartISO, outcome }).then(refresh); };
                    Alert.alert(tr('insights.pregnancyOutcome'), undefined, [
                      { text: tr('insights.outcome.birth'), onPress: () => mark('birth') },
                      { text: tr('insights.outcome.loss'), onPress: () => mark('loss') },
                      { text: tr('common.cancel'), style: 'cancel' },
                    ]);
                  }} /> : null}
                  <Button kind="text" testID="confirm-long" label={tr('insights.confirmLong')} onPress={() => void store?.append({ kind: 'cycle.confirm_long', payload: { cycle_start: r.startISO, reason: 'user_confirmed' } }).then(refresh)} />
                </View>
              ) : null} />
          ))
        )
      ) : null}

      {tab === 'charts' && pattern ? (
        <Card testID="card-pattern">
          <Text variant="heading" accessibilityRole="header">{tr('insights.pattern.title')}</Text>
          {pattern.daysSinceStart === undefined ? <Text variant="bodySmall" color="textSecondary">{tr('insights.pattern.none')}</Text> : (<>
            <Text testID="pattern-since">{tr('insights.pattern.since', { n: pattern.daysSinceStart })}</Text>
            {pattern.spread ? <Text testID="pattern-spread" variant="bodySmall">{tr('insights.pattern.spread', { n: pattern.lengths.length, min: pattern.spread.min, max: pattern.spread.max })}</Text> : null}
            {pattern.lengths.length > 1 ? <Text testID="pattern-changes" variant="bodySmall">{tr('insights.pattern.changes', { n: pattern.changes7 })}</Text> : null}
            {pattern.lengths.length ? <Text testID="pattern-long" variant="bodySmall">{tr('insights.pattern.long', { n: pattern.longCycles })}</Text> : null}
          </>)}
          <Text variant="caption" color="textSecondary" style={{ marginTop: 6 }}>{tr('insights.pattern.intro')}</Text>
          <Text variant="bodySmall" style={{ marginTop: 10, fontWeight: '600' }}>{tr('insights.pattern.symptomsTitle')}</Text>
          {pattern.symptoms.map((x) => <Text key={x.code} variant="bodySmall" testID={`pattern-${x.code}`}>{tr('insights.pattern.symptomLine', { name: tr(`symptom.${x.code}`, { defaultValue: x.code }), w4: x.last4w, w12: x.last12w })}</Text>)}
          <Text variant="caption" color="textSecondary">{tr('insights.pattern.symptomsNote')}</Text>
        </Card>
      ) : null}

      {tab === 'charts' ? (
        empty ? (
          <Card testID="insights-empty"><Text color="textSecondary">{tr('insights.needTwo')}</Text></Card>
        ) : (<>
          <Card testID="card-length">
            <Text variant="heading">{tr('insights.charts.cycleLength')}</Text>
            {series.points.length >= MIN_LENGTH_POINTS ? (<>
              <LengthChart series={series} />
              <Text variant="caption" color="textSecondary">{tr('insights.chart.bandCaption')}</Text>
            </>) : <Text testID="chart-length-few" variant="bodySmall" color="textSecondary">{tr('insights.chart.fewLengths')}</Text>}
          </Card>
          <Card testID="card-temp">
            <Text variant="heading">{tr('insights.charts.temperature')}</Text>
            {temps.points.length >= MIN_TEMP_POINTS ? (<>
              <TempChart points={temps.points} coverline={temps.coverline === undefined ? undefined : fromC(temps.coverline, prefs.tempUnit)} unitLabel={`°${prefs.tempUnit}`} />
              {temps.coverline !== undefined ? <Text variant="caption" color="textSecondary">{tr('insights.chart.coverlineNote')}</Text> : null}
            </>) : <Text testID="chart-temp-few" variant="bodySmall" color="textSecondary">{temps.points.length ? tr('insights.chart.fewTemps', { n: MIN_TEMP_POINTS - temps.points.length }) : tr('insights.chart.noTemps')}</Text>}
          </Card>
          <Card testID="card-phases">
            <Text variant="heading">{tr('insights.charts.symptomsByPhase')}</Text>
            {bars.length ? bars.map((b) => (
              <View key={b.code} style={{ gap: 6, marginTop: 6 }} accessible accessibilityLabel={`${tr(`symptom.${b.code}`, { defaultValue: b.code })}: ${(['menstrual', 'follicular', 'luteal'] as const).map((p) => `${tr(`insights.phases.${p}`)} ${Math.round(b.share[p] * 100)}%`).join(', ')}`}>
                <Text variant="bodySmall">{tr(`symptom.${b.code}`, { defaultValue: b.code })}</Text>
                {(['menstrual', 'follicular', 'luteal'] as const).map((p) => (
                  <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text variant="caption" color="textSecondary" style={{ width: 76 }}>{tr(`insights.phases.${p}`)}</Text>
                    <View style={{ flex: 1, height: 10, backgroundColor: t.c.border, borderRadius: 5, overflow: 'hidden' }}><View style={{ width: `${Math.round(b.share[p] * 100)}%`, height: 10, backgroundColor: t.c.accent }} /></View>
                    <Text variant="caption" tabular style={{ width: 36, textAlign: 'right' }}>{Math.round(b.share[p] * 100)}%</Text>
                  </View>
                ))}
              </View>
            )) : <Text variant="bodySmall" color="textSecondary">{tr('insights.chart.noSymptoms')}</Text>}
            {bars.length ? <Text variant="caption" color="textSecondary" style={{ marginTop: 6 }}>{tr('insights.chart.phaseCaption')}</Text> : null}
          </Card>
        </>)
      ) : null}

      {tab === 'charts' ? (
        <Card testID="card-energy">
          <Text variant="heading" accessibilityRole="header">{tr('insights.energy.title')}</Text>
          {energy.window.length >= MIN_CHART_POINTS ? (<>
            <EnergyChart points={energy.window} starts={cycles.map((c) => c.start).filter((s) => s >= energyFrom)} from={energyFrom} to={today}
              label={tr('insights.energy.chartA11y', { n: energy.window.length, mean: energyMean })} />
            <Text variant="caption" color="textSecondary">{tr('insights.energy.chartCaption')}</Text>
          </>) : <Text testID="chart-energy-few" variant="bodySmall" color="textSecondary">{energy.window.length ? tr('insights.energy.few', { n: MIN_CHART_POINTS - energy.window.length }) : tr('insights.energy.none')}</Text>}
          {energy.byPhase.length ? (<>
            <Text variant="bodySmall" style={{ marginTop: 10, fontWeight: '600' }}>{tr('insights.energy.byPhaseTitle')}</Text>
            {energy.byPhase.map((b) => (
              <View key={b.phase} testID={`energy-phase-${b.phase}`} accessible accessibilityLabel={`${tr(`guidance.phase.${b.phase}`)}: ${tr('insights.energy.meanLine', { mean: b.mean, n: b.n })}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text variant="caption" color="textSecondary" style={{ width: 110 }}>{tr(`guidance.phase.${b.phase}`)}</Text>
                <View style={{ flex: 1, height: 10, backgroundColor: t.c.border, borderRadius: 5, overflow: 'hidden' }}><View style={{ width: `${(b.mean / 5) * 100}%`, height: 10, backgroundColor: t.c.accent }} /></View>
                <Text variant="caption" tabular style={{ width: 92, textAlign: 'right' }}>{tr('insights.energy.meanLine', { mean: b.mean, n: b.n })}</Text>
              </View>
            ))}
          </>) : null}
          {!prediction?.suspended && energy.suggestions.length ? (<>
            <Text variant="bodySmall" style={{ marginTop: 10, fontWeight: '600' }}>{tr('insights.energy.suggestionsTitle')}</Text>
            {energy.suggestions.map((s) => (
              <View key={s.kind} testID={`energy-suggestion-${s.kind}`} style={{ gap: 2 }}>
                <Text variant="bodySmall">{s.kind === 'lowOverall' ? tr('insights.energy.lowOverall', { mean: s.mean, n: s.n }) : tr(`insights.energy.${s.kind}`, { phaseIn: tr(`guidance.phaseIn.${s.phase}`), mean: s.mean, overall: s.overall, n: s.n })}</Text>
                {s.kind === 'lowPhase' ? (<>
                  <Text variant="bodySmall" color="textSecondary">{tr('insights.energy.lowPhaseTip')}</Text>
                  <Text variant="caption" color="textSecondary">{tr(`guidance.evidence.${GUIDANCE[s.phase].move}`)}</Text>
                </>) : null}
              </View>
            ))}
          </>) : null}
          <Text variant="caption" color="textSecondary" style={{ marginTop: 6 }}>{tr('insights.energy.caption')}</Text>
        </Card>
      ) : null}

      {tab === 'accuracy' ? (
        <Card testID="card-accuracy">
          {acc ? (<>
            <Text testID="accuracy-summary">{tr('insights.accuracy.summary', acc.summary)}</Text>
            <Text variant="bodySmall" color="textSecondary">{tr('insights.accuracy.averageMiss', { days: acc.missDays })}</Text>
            <Text variant="caption" color="textSecondary" style={{ marginTop: 6 }}>{tr('insights.accuracy.explain')}</Text>
          </>) : <Text color="textSecondary" testID="accuracy-none">{tr('insights.accuracy.none')}</Text>}
        </Card>
      ) : null}
      {tab === 'accuracy' && scored.length ? (
        // one line per scored cycle: the range the engine gave on day 1 against the day the period came (U-25, D-076)
        <Card testID="accuracy-rows" style={{ padding: 0, gap: 0 }}>
          {scored.map((r, i) => (
            <View key={r.cycleId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, paddingHorizontal: 16, borderBottomWidth: i === scored.length - 1 ? 0 : 1, borderBottomColor: t.hairline }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodySmall">{formatRange(r.lo80, r.hi80)}</Text>
                <Text variant="caption" color="textSecondary">{tr('insights.accuracy.rowActual', { date: formatDay(r.actual) })}</Text>
              </View>
              <Text variant="caption" color={r.in80 ? 'textSecondary' : 'accent'}>{r.in80 ? tr('insights.accuracy.rowIn') : tr('insights.accuracy.rowOff', { n: r.absError })}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
