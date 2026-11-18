// Leave a cycle out of the estimates, or put it back. Events are append-only: including again retracts the exclusion.
import { activeEvents } from '@/data/project';
import type { EventStore } from '@/data/store';

export async function setCycleExcluded(store: EventStore, cycleStart: string, excluded: boolean): Promise<void> {
  if (excluded) {
    await store.append({ kind: 'cycle.exclude', payload: { cycle_start: cycleStart, reason: 'user_excluded' } });
    return;
  }
  const ev = activeEvents(await store.events()).find((e) => e.kind === 'cycle.exclude' && (JSON.parse(e.payload) as { cycle_start: string }).cycle_start === cycleStart);
  if (ev) await store.retract(ev.id);
}
