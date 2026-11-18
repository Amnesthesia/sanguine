// Day detail (PLAN.md §8.3): what was logged that day as removable chips with provenance, the two correction actions, then the full estimate and food-and-movement sections.
import { analyzeCycles, type ISODate, pastOvulations } from '@sanguine/engine';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { effectivePrefs } from '@/data/prefs';
import { EstimateSections } from '@/features/guidance/sections/EstimateSections';
import { GuidanceSections } from '@/features/guidance/sections/GuidanceSections';
import { phaseOn, showSupplements } from '@/features/guidance/guidance';
import { type DayEvent, dayEvents, dayState, markNotAPeriod, markSpotting } from '@/features/logging/actions';
import { describeEvent } from '@/features/logging/describe';
import { removeEntry, undoRemoval, visibleEntries } from '@/features/logging/removeEntry';
import { SHOW_OVULATION_ESTIMATE } from '@/features/today/todayModel';
import { useApp } from '@/state/app';
import { Button } from '@/ui/Button';
import { formatLong } from '@/ui/format';
import { LoggedChip } from '@/ui/LoggedChip';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';
import { showToast } from '@/ui/Toast';

/** "imported · Natural Cycles" or "from a sensor" as a muted suffix; nothing for a manual entry. */
function provenance(e: DayEvent, tr: (k: string) => string): string {
  if (e.provenance === 'manual') return '';
  return e.provenance === 'imported' ? ` · ${tr('day.provenance.imported')}${e.source_app ? ` · ${e.source_app}` : ''}` : ` · ${tr('day.provenance.sensor')}`;
}

export default function DayDetail() {
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const day = date as ISODate;
  const { db, store, prefs, profile, prediction, today, history, settings, refresh, version } = useApp();
  const [events, setEvents] = useState<DayEvent[]>([]);
  const [isPeriodDay, setIsPeriodDay] = useState(false);

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
  // lengths of her recent closed periods, oldest first, for the period-end card
  const periodLengths = useMemo(() => cycles.filter((c) => c.nextStart && c.bleedDays).map((c) => c.bleedDays as number).slice(-6), [cycles]);
  const guide = useMemo(
    () => (prefs.cycleGuidance && history && settings ? phaseOn({ date: day, today, prediction, cycles, showEstimate }) : undefined),
    [prefs.cycleGuidance, history, settings, day, today, prediction, cycles, showEstimate],
  );
  const after = async () => { await refresh(); await reload(); };
  // removal is a retraction (append-only, I-14); Undo retracts what the removal wrote, so no confirm step is needed (D-113, D-123)
  const onRemove = async (e: DayEvent) => {
    if (!store || !db) return;
    const label = describeEvent(e, tr, prefs.tempUnit);
    const written = await removeEntry(store, db, e);
    await after();
    showToast(tr('log.removed', { label }), { label: tr('common.undo'), onPress: () => void undoRemoval(store, written).then(after) });
  };
  const entries = visibleEntries(events);

  return (
    <SubScreen testID="screen-day" backTestID="day-back" title={formatLong(day)} bottomInset={32}>
      {isFuture ? null : (
        <View style={{ gap: 6 }}>
          <Text variant="caption" accessibilityRole="header" style={{ fontWeight: '600' }} color="textSecondary">{tr('log.loggedOnDay')}</Text>
          {entries.length === 0 ? <Text variant="bodySmall" color="textSecondary">{tr('day.nothingLogged')}</Text> : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {entries.map((e) => (
                <View key={e.id} testID={`event-${e.kind}`}>
                  <LoggedChip label={`${describeEvent(e, tr, prefs.tempUnit)}${provenance(e, tr)}`} mark={e.kind === 'flow' ? 'flow' : e.kind === 'symptom' ? 'symptom' : 'other'} onRemove={() => void onRemove(e)} />
                </View>
              ))}
            </View>
          )}
        </View>
      )}
      {isPeriodDay && !isFuture && db && store ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button testID="day-not-period" kind="secondary" label={tr('day.notAPeriod')} onPress={() => void markNotAPeriod(store, db, day).then(after)} />
          <Button testID="day-spotting" kind="secondary" label={tr('day.markSpotting')} onPress={() => void markSpotting(store, day).then(after)} />
        </View>
      ) : null}
      {prediction ? <EstimateSections prediction={prediction} day={day} pastOv={pastOv} showEstimate={showEstimate} periodLengths={periodLengths} /> : null}
      {guide ? <GuidanceSections day={guide} supplements={showSupplements(eff.teen)} compact={false} /> : null}
      {isFuture
        ? <Text variant="caption" color="textSecondary" testID="day-future-note">{tr('calendar.futureNote')}</Text>
        : <Button testID="day-edit" label={tr('day.edit')} onPress={() => router.push({ pathname: '/log', params: { day } })} />}
    </SubScreen>
  );
}
