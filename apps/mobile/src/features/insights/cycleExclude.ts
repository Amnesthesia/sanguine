// Leave a cycle out of the estimates, or put it back. Events are append-only: including again retracts the exclusion.
import { activeEvents } from '@/data/project';
import type { EventStore } from '@/data/store';

export async function setCycleExcluded(store: EventStore, cycleStart: string, excluded: boolean): Promise<void> {
  const active = activeEvents(await store.events()).filter((e) => e.kind === 'cycle.exclude' && (JSON.parse(e.payload) as { cycle_start: string }).cycle_start === cycleStart);
  if (excluded) {
    if (!active.length) await store.append({ kind: 'cycle.exclude', payload: { cycle_start: cycleStart, reason: 'user_excluded' } });
    return;
  }
  for (const e of active) await store.retract(e.id);
}
