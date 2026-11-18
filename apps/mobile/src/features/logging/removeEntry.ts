import type { Database } from '@/data/database';
import type { EventRow, FlowKind } from '@/data/events';
import type { EventStore } from '@/data/store';
import { setEnergy, setFlow, setSymptom, type DayEvent } from './actions';

/** dayEvents is in log order; only the latest flow represents the day's flow. */
export function visibleEntries(events: DayEvent[]): DayEvent[] {
  const flow = events.filter((e) => e.kind === 'flow').at(-1);
  return events.filter((e) => e.kind !== 'flow' || (e === flow && e.data.level !== 'none'));
}

export async function removeEntry(store: EventStore, _db: Database, entry: DayEvent): Promise<EventRow[]> {
  const day = entry.effective_day;
  switch (entry.kind) {
    case 'flow': return setFlow(store, day, 'none', { kind: entry.data.flow_kind as FlowKind });
    case 'symptom': return setSymptom(store, day, entry.data.code as string, 0);
    case 'energy': return setEnergy(store, day, 0);
    default: return [await store.retract(entry.id)];
  }
}

/** Reverse write order restores the flow before restoring its join answers. */
export async function undoRemoval(store: EventStore, written: EventRow[]): Promise<void> {
  for (const event of [...written].reverse()) await store.retract(event.id);
}
