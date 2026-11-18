// Leaving a cycle out of estimates and putting it back: the row on Insights and the cycle page share this.
import { describe, expect, it } from 'vitest';
import { migrate } from '@/data/migrate';
import { activeEvents } from '@/data/project';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { setCycleExcluded } from './cycleExclude';

async function store() {
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  return new EventStore(db, { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-14T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) });
}
const excludes = async (s: EventStore) => activeEvents(await s.events()).filter((e) => e.kind === 'cycle.exclude');

describe('setCycleExcluded', () => {
  it('appends a cycle.exclude event, and including again retracts it (events are append-only)', async () => {
    const s = await store();
    await setCycleExcluded(s, '2026-07-17', true);
    expect(await excludes(s)).toHaveLength(1);
    expect(JSON.parse((await excludes(s))[0]?.payload ?? '{}')).toMatchObject({ cycle_start: '2026-07-17', reason: 'user_excluded' });
    await setCycleExcluded(s, '2026-07-17', false);
    expect(await excludes(s)).toHaveLength(0);
    expect((await s.events()).filter((e) => e.kind === 'cycle.exclude')).toHaveLength(1);
  });
  it('only retracts the exclusion of the named cycle', async () => {
    const s = await store();
    await setCycleExcluded(s, '2026-07-17', true);
    await setCycleExcluded(s, '2026-08-31', true);
    await setCycleExcluded(s, '2026-07-17', false);
    expect((await excludes(s)).map((e) => (JSON.parse(e.payload) as { cycle_start: string }).cycle_start)).toEqual(['2026-08-31']);
  });
  it('leaving out twice (a double tap) appends once', async () => {
    const s = await store();
    await setCycleExcluded(s, '2026-07-17', true);
    await setCycleExcluded(s, '2026-07-17', true);
    expect(await excludes(s)).toHaveLength(1);
  });
  it('including retracts every active exclusion of the cycle, e.g. a synced duplicate', async () => {
    const s = await store();
    for (let i = 0; i < 2; i++) await s.append({ kind: 'cycle.exclude', payload: { cycle_start: '2026-07-17', reason: 'user_excluded' } });
    await s.append({ kind: 'cycle.exclude', payload: { cycle_start: '2026-08-31', reason: 'user_excluded' } });
    await setCycleExcluded(s, '2026-07-17', false);
    expect((await excludes(s)).map((e) => (JSON.parse(e.payload) as { cycle_start: string }).cycle_start)).toEqual(['2026-08-31']);
  });
});
