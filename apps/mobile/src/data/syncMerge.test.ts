// Sync between the user's own phones (P8-7, D-083) is a union of append-only event logs: `importBundle` inserts the events it does not
// have and rebuilds. Property: whatever each phone logged, and in whatever order the copies are exchanged, both phones end with the
// same events and the same projections, and a repeated exchange adds nothing.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Database } from './database';
import { exportBundle, importBundle } from './exportImport';
import type { Clock } from './ids';
import { migrate } from './migrate';
import { EventStore } from './store';
import { openTestDb } from './testDb';

type Op = { kind: 'flow'; day: number; level: 'spotting' | 'light' | 'medium' | 'heavy' } | { kind: 'symptom'; day: number } | { kind: 'retract'; pick: number };
const op = fc.oneof(
  fc.record({ kind: fc.constant('flow' as const), day: fc.integer({ min: 0, max: 90 }), level: fc.constantFrom('spotting' as const, 'light' as const, 'medium' as const, 'heavy' as const) }),
  fc.record({ kind: fc.constant('symptom' as const), day: fc.integer({ min: 0, max: 90 }) }),
  fc.record({ kind: fc.constant('retract' as const), pick: fc.nat() }),
);
const dayOf = (n: number) => new Date(Date.UTC(2026, 6, 1) + n * 86_400_000).toISOString().slice(0, 10);

async function phone(seed: number) {
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  const clock: Clock = { nowMs: () => 1_700_000_000_000 + seed * 1_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (seed * 31 + n * 7 + i) % 256) };
  return { db, store: new EventStore(db, clock), clock };
}
async function play(p: Awaited<ReturnType<typeof phone>>, ops: Op[]) {
  const mine: string[] = [];
  for (const o of ops) {
    if (o.kind === 'flow') mine.push((await p.store.append({ kind: 'flow', payload: { day: dayOf(o.day), level: o.level, flow_kind: 'period' } })).id);
    else if (o.kind === 'symptom') mine.push((await p.store.append({ kind: 'symptom', payload: { day: dayOf(o.day), code: 'cramps', intensity: 2 } })).id);
    else if (mine.length) { const id = mine.splice(o.pick % mine.length, 1)[0] as string; await p.store.retract(id); }
  }
}
const send = async (from: Awaited<ReturnType<typeof phone>>, to: Awaited<ReturnType<typeof phone>>) => (await importBundle(to.db, to.store, (await exportBundle(from.db, from.store, from.clock)).zip)).imported;
const snapshot = async (db: Database) => ({
  events: (await db.all<{ id: string }>('SELECT id FROM event ORDER BY id')).map((r) => r.id),
  cycles: await db.all('SELECT start_day, end_day, bleed_days FROM cycle ORDER BY start_day'),
  days: await db.all('SELECT day, flow, symptoms FROM daily_log ORDER BY day'),
});

describe('sync merge converges (P8-7)', () => {
  it('two phones that exchange copies end identical, in either order, and a second exchange adds nothing', async () => {
    await fc.assert(fc.asyncProperty(fc.array(op, { maxLength: 12 }), fc.array(op, { maxLength: 12 }), fc.boolean(), async (opsA, opsB, aFirst) => {
      const a = await phone(1);
      const b = await phone(2);
      await play(a, opsA);
      await play(b, opsB);
      if (aFirst) { await send(a, b); await send(b, a); } else { await send(b, a); await send(a, b); }
      expect(await snapshot(a.db)).toEqual(await snapshot(b.db));
      expect(await send(a, b)).toBe(0);
      expect(await send(b, a)).toBe(0);
    }), { numRuns: 60 });
  });
});
