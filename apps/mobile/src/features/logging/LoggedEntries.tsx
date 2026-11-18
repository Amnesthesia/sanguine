// "Logged on this day": one removable chip per entry (D-113). Removal is a retraction; the toast's Undo retracts what it wrote.
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useApp } from '@/state/app';
import { LoggedChip } from '@/ui/LoggedChip';
import { Text } from '@/ui/Text';
import { showToast } from '@/ui/Toast';
import type { DayEvent } from './actions';
import { describeEvent } from './describe';
import { removeEntry, undoRemoval } from './removeEntry';

export function LoggedEntries({ entries, onChanged, labelFor }: {
  /** Already filtered with visibleEntries. */
  entries: DayEvent[];
  /** Runs after a removal and after its Undo, so the caller reloads. */
  onChanged: () => void | Promise<void>;
  /** Overrides the chip text (the day screen adds where an entry came from). */
  labelFor?: (e: DayEvent) => string;
}) {
  const { t: tr } = useTranslation();
  const { db, store, prefs } = useApp();
  if (entries.length === 0) return <Text variant="bodySmall" color="textSecondary" testID="logged-empty">{tr('day.nothingLogged')}</Text>;
  async function remove(e: DayEvent) {
    if (!db || !store) return;
    const label = describeEvent(e, tr, prefs.tempUnit);
    const written = await removeEntry(store, db, e);
    await onChanged();
    showToast(tr('log.removed', { label }), { label: tr('common.undo'), onPress: () => void undoRemoval(store, written).then(onChanged) });
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {entries.map((e) => <LoggedChip key={e.id} label={labelFor ? labelFor(e) : describeEvent(e, tr, prefs.tempUnit)} mark={e.kind === 'flow' ? 'flow' : e.kind === 'symptom' ? 'symptom' : 'other'} onRemove={() => void remove(e)} />)}
    </View>
  );
}
