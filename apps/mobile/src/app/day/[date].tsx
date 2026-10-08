// Day detail (PLAN.md §8.3): everything logged that day with provenance, edit, delete, and the two correction actions.
import type { ISODate } from '@sanguine/engine';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { type DayEvent, dayEvents, dayState, markNotAPeriod, markSpotting } from '@/features/logging/actions';
import { describeEvent } from '@/features/logging/describe';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { formatLong } from '@/ui/format';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export function ProvenanceChip({ e }: { e: DayEvent }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  if (e.provenance === 'manual') return null;
  const label = e.provenance === 'imported' ? `${tr('day.provenance.imported')}${e.source_app ? ` · ${e.source_app}` : ''}` : tr('day.provenance.sensor');
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: t.chipBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
      <Text variant="caption" color="textSecondary">{label}</Text>
    </View>
  );
}

export default function DayDetail() {
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const day = date as ISODate;
  const { db, store, prefs, refresh } = useApp();
  const [events, setEvents] = useState<DayEvent[]>([]);
  const [isPeriodDay, setIsPeriodDay] = useState(false);

  const reload = useCallback(async () => {
    if (!store || !db) return;
    setEvents(await dayEvents(store, day));
    const s = await dayState(db, day);
    setIsPeriodDay(s.flowKind === 'period' && s.flow !== null && s.flow !== 'none');
  }, [store, db, day]);
  useEffect(() => { void reload(); }, [reload]);
  const after = async () => { await refresh(); await reload(); };

  return (
    <Screen testID="screen-day" title={formatLong(day)} bottomInset={32}>
      {events.length === 0 ? <Text color="textSecondary">{tr('day.nothingLogged')}</Text> : null}
      {events.map((e) => (
        <Card key={e.id} testID={`event-${e.kind}`}>
          <Text>{describeEvent(e, tr, prefs.tempUnit)}</Text>
          <ProvenanceChip e={e} />
          <View style={{ flexDirection: 'row' }}>
            <Button kind="text" testID={`event-delete-${e.kind}`} label={tr('common.delete')} accessibilityLabel={`${tr('day.deleteEntry')}: ${describeEvent(e, tr, prefs.tempUnit)}`} onPress={() => void store?.retract(e.id).then(after)} />
          </View>
        </Card>
      ))}
      <View style={{ gap: 4 }}>
        <Button testID="day-edit" label={tr('day.edit')} onPress={() => router.push({ pathname: '/log', params: { day } })} />
        {isPeriodDay && db && store ? (<>
          <Button testID="day-not-period" kind="secondary" label={tr('day.notAPeriod')} onPress={() => void markNotAPeriod(store, db, day).then(after)} />
          <Button testID="day-spotting" kind="secondary" label={tr('day.markSpotting')} onPress={() => void markSpotting(store, day).then(after)} />
        </>) : null}
      </View>
    </Screen>
  );
}
