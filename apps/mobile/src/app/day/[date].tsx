// Day detail (PLAN.md §8.3): everything logged that day with provenance, edit, delete, and the two correction actions.
import type { ISODate } from '@sanguine/engine';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { effectivePrefs } from '@/data/prefs';
import { dayEstimates } from '@/features/calendar/calendarModel';
import { type DayEvent, dayEvents, dayState, markNotAPeriod, markSpotting } from '@/features/logging/actions';
import { describeEvent } from '@/features/logging/describe';
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
  const { db, store, prefs, profile, prediction, today, refresh } = useApp();
  const [events, setEvents] = useState<DayEvent[]>([]);
  const [isPeriodDay, setIsPeriodDay] = useState(false);

  const reload = useCallback(async () => {
    if (!store || !db) return;
    setEvents(await dayEvents(store, day));
    const s = await dayState(db, day);
    setIsPeriodDay(s.flowKind === 'period' && s.flow !== null && s.flow !== 'none');
  }, [store, db, day]);
  useEffect(() => { void reload(); }, [reload]);
  // the calendar marks on this day in words (D-104); a future day cannot be logged, so it offers neither "Nothing logged" nor Edit
  const isFuture = day > today;
  const showEstimate = SHOW_OVULATION_ESTIMATE && effectivePrefs(prefs, profile, today).showOvulationEstimate;
  const estimates = useMemo(() => dayEstimates(day, prediction, showEstimate, isPeriodDay), [day, prediction, showEstimate, isPeriodDay]);
  const after = async () => { await refresh(); await reload(); };
  // a deleted entry cannot be brought back from this screen, so ask first (I-14, D-075); the event log keeps it as a retraction
  const confirmDelete = (e: DayEvent) => Alert.alert(tr('day.deleteConfirmTitle'), describeEvent(e, tr, prefs.tempUnit), [
    { text: tr('common.cancel'), style: 'cancel' },
    { text: tr('day.deleteConfirmAction'), style: 'destructive', onPress: () => void store?.retract(e.id).then(after) }, // verb + noun so the alert button differs from the row's "Delete"
  ]);

  return (
    <SubScreen testID="screen-day" backTestID="day-back" title={formatLong(day)} bottomInset={32}>
      {events.length === 0 && !isFuture ? <Text color="textSecondary">{tr('day.nothingLogged')}</Text> : null}
      {events.length ? (
        // one row per entry (U-16, D-076): the text with its provenance, and Delete at the trailing edge
        <Card style={{ padding: 0, gap: 0 }}>
          {events.map((e, i) => (
            <View key={e.id} testID={`event-${e.kind}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 4, minHeight: 52, borderBottomWidth: i === events.length - 1 ? 0 : 1, borderBottomColor: t.hairline }}>
              <Text style={{ flex: 1, paddingVertical: 8 }}>{describeEvent(e, tr, prefs.tempUnit)}<Text color="textSecondary">{provenance(e, tr)}</Text></Text>
              <Button kind="text" testID={`event-delete-${e.kind}`} label={tr('common.delete')} accessibilityLabel={`${tr('day.deleteEntry')}: ${describeEvent(e, tr, prefs.tempUnit)}`} onPress={() => confirmDelete(e)} />
            </View>
          ))}
        </Card>
      ) : null}
      {estimates.length || isFuture ? (
        <Card testID="day-estimates" style={{ gap: 6 }}>
          <Text variant="heading" accessibilityRole="header">{tr('day.estimates.title')}</Text>
          {estimates.length ? estimates.map((l) => <Text key={l} testID="day-estimate">{l}</Text>) : <Text color="textSecondary">{tr('day.estimates.none')}</Text>}
          {estimates.length ? <Text variant="caption" color="textSecondary">{tr('day.estimates.note')}</Text> : null}
        </Card>
      ) : null}
      <View style={{ gap: 4 }}>
        {isFuture ? <Text variant="caption" color="textSecondary" testID="day-future-note">{tr('calendar.futureNote')}</Text> : <Button testID="day-edit" label={tr('day.edit')} onPress={() => router.push({ pathname: '/log', params: { day } })} />}
        {isPeriodDay && db && store ? (<>
          <Button testID="day-not-period" kind="secondary" label={tr('day.notAPeriod')} onPress={() => void markNotAPeriod(store, db, day).then(after)} />
          <Button testID="day-spotting" kind="secondary" label={tr('day.markSpotting')} onPress={() => void markSpotting(store, day).then(after)} />
        </>) : null}
      </View>
    </SubScreen>
  );
}
