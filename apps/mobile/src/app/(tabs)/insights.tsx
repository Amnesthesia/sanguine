import { analyzeCycles, detectBbtShift, diffDays } from '@sanguine/engine';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { ledgerSummary, type LedgerSummary } from '@/data/ledger';
import { fromC } from '@/features/logging/actions';
import { LengthChart, TempChart } from '@/features/insights/charts';
import { accuracyText, cycleLengthSeries, historyRows, phaseBars } from '@/features/insights/insightsModel';
import { addPastPregnancy } from '@/features/settings/lifeState';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { Text } from '@/ui/Text';

type Tab = 'history' | 'charts' | 'accuracy';

export default function InsightsScreen() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { history, settings, prediction, today, prefs, db, store, refresh, version } = useApp();
  const [tab, setTab] = useState<Tab>('history');
  const [ledger, setLedger] = useState<LedgerSummary>({ total: 0, in80: 0, in95: 0, meanAbsError: 0 });
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads the ledger after every write
  useEffect(() => { if (db) void ledgerSummary(db).then(setLedger); }, [db, version]);

  const cycles = useMemo(() => (history && settings ? analyzeCycles(history, settings).map((c) => c.record) : []), [history, settings]);
  const closed = cycles.filter((c) => c.length !== undefined).length;
  const rows = useMemo(() => historyRows(cycles, today), [cycles, today]);
  const series = useMemo(() => cycleLengthSeries(cycles, prediction?.cycleLength), [cycles, prediction]);
  const bars = useMemo(() => phaseBars(cycles, history?.logs ?? [], today), [cycles, history, today]);
  const open = cycles.at(-1);
  const temps = useMemo(() => {
    if (!open || !history) return { points: [] as Array<{ day: number; value: number }>, coverline: undefined as number | undefined };
    const mine = history.temperatures.filter((r) => r.date >= open.start && !r.disturbed && (r.source === 'oral' || r.source === 'vaginal' || r.source === 'other'));
    return { points: mine.map((r) => ({ day: diffDays(r.date, open.start) + 1, value: fromC(r.valueC, prefs.tempUnit) })), coverline: detectBbtShift(history.temperatures, open.start)?.coverlineC };
  }, [open, history, prefs.tempUnit]);
  const acc = accuracyText(ledger);
  const empty = closed < 2;

  const chip = (q: string) => (
    <View style={{ backgroundColor: t.chipBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text variant="caption" color="textSecondary">{tr(`insights.quality.${q}`)}</Text>
    </View>
  );
  return (
    <Screen testID="screen-insights" title={tr('insights.title')}>
      <Segmented testIDPrefix="insights-tab" value={tab} onChange={setTab} options={[{ value: 'history', label: tr('insights.segments.history') }, { value: 'charts', label: tr('insights.segments.charts') }, { value: 'accuracy', label: tr('insights.segments.accuracy') }]} />

      {tab === 'history' ? (
        rows.length === 0 || empty ? (
          <Card testID="insights-empty"><Text color="textSecondary">{tr('insights.needTwo')}</Text></Card>
        ) : (
          rows.map((r) => (
            <Card key={r.id} testID={`history-${r.id}`}>
              <Text variant="heading" accessibilityRole="header">{[r.start, r.lengthDays ? `${r.lengthDays} days` : tr('insights.dayN', { day: r.dayOfCycle })].join(' · ')}</Text>
              <Text variant="bodySmall" color="textSecondary">{[r.bleedDays ? `${r.bleedDays} bleed days` : null, tr(`insights.ovulationBasis.${r.basis}`)].filter(Boolean).join(' · ')}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>{r.current ? <View style={{ backgroundColor: t.chipBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}><Text variant="caption" color="textSecondary">{tr('insights.current')}</Text></View> : chip(r.quality)}</View>
              {r.offerMissedLog && r.midDay ? (
                <View style={{ gap: 2 }}>
                  <Button kind="text" testID="missed-log" label={tr('insights.missedLogPrompt')} onPress={() => router.push({ pathname: '/log', params: { day: r.midDay as string, section: 'period' } })} />
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
              ) : null}
              <Button kind="text" testID="cycle-detail-link" label={tr('insights.viewCycle')} onPress={() => router.push({ pathname: '/cycle/[id]', params: { id: r.id } })} />
            </Card>
          ))
        )
      ) : null}

      {tab === 'charts' ? (
        empty ? (
          <Card testID="insights-empty"><Text color="textSecondary">{tr('insights.needTwo')}</Text></Card>
        ) : (<>
          <Card testID="card-length">
            <Text variant="heading">{tr('insights.charts.cycleLength')}</Text>
            <LengthChart series={series} />
            <Text variant="caption" color="textSecondary">{tr('insights.chart.bandCaption')}</Text>
          </Card>
          <Card testID="card-temp">
            <Text variant="heading">{tr('insights.charts.temperature')}</Text>
            {temps.points.length ? (<>
              <TempChart points={temps.points} coverline={temps.coverline === undefined ? undefined : fromC(temps.coverline, prefs.tempUnit)} unitLabel={`°${prefs.tempUnit}`} />
              {temps.coverline !== undefined ? <Text variant="caption" color="textSecondary">{tr('insights.chart.coverlineNote')}</Text> : null}
            </>) : <Text variant="bodySmall" color="textSecondary">{tr('insights.chart.noTemps')}</Text>}
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

      {tab === 'accuracy' ? (
        <Card testID="card-accuracy">
          {acc ? (<>
            <Text testID="accuracy-summary">{tr('insights.accuracy.summary', acc.summary)}</Text>
            <Text variant="bodySmall" color="textSecondary">{tr('insights.accuracy.averageMiss', { days: acc.missDays })}</Text>
            <Text variant="caption" color="textSecondary" style={{ marginTop: 6 }}>{tr('insights.accuracy.explain')}</Text>
          </>) : <Text color="textSecondary" testID="accuracy-none">{tr('insights.accuracy.none')}</Text>}
        </Card>
      ) : null}
    </Screen>
  );
}
