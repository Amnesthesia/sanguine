import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from './database';
import { storeSink } from './healthSink';
import type { Clock } from './ids';
import { migrate } from './migrate';
import { EventStore } from './store';
import { openTestDb } from './testDb';

function clock(): Clock {
  let n = 0;
  return { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) };
}
let db: Database;
let store: EventStore;
beforeEach(async () => { db = openTestDb(); await migrate(db); store = new EventStore(db, clock()); });
const flow = (day: string) => ({ kind: 'flow', payload: { day, level: 'medium', flow_kind: 'period' } });

describe('storeSink', () => {
  it('lists events with their provenance and leaves retract events out', async () => {
    const e = await store.append(flow('2026-10-05'));
    await store.retract(e.id);
    const events = await storeSink(store).events();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: e.id, kind: 'flow', effectiveDay: '2026-10-05', provenance: 'manual', retracted: true, payload: { level: 'medium' } });
  });
  it('a retracted retract restores its target', async () => {
    const e = await store.append(flow('2026-10-05'));
    const r = await store.retract(e.id);
    await store.retract(r.id);
    expect((await storeSink(store).events())[0]?.retracted).toBe(false);
  });
  it('append writes an imported event with its source and external id, validated', async () => {
    const sink = storeSink(store);
    const ev = await sink.append({ ...flow('2026-10-05'), provenance: 'imported', source_app: 'com.other', external_id: 'x1' });
    expect(ev).toMatchObject({ provenance: 'imported', sourceApp: 'com.other', externalId: 'x1', retracted: false });
    await expect(sink.append({ kind: 'flow', payload: { day: 'nope' }, provenance: 'imported', source_app: 'a', external_id: 'b' })).rejects.toThrow(/invalid flow event/);
  });
  it('retract writes a retract event with provenance imported on the target day', async () => {
    const sink = storeSink(store);
    const ev = await sink.append({ ...flow('2026-10-05'), provenance: 'imported', source_app: 'com.other', external_id: 'x1' });
    const out = await sink.retract(ev.id, { provenance: 'imported', source_app: 'healthkit' });
    expect(out.retracted).toBe(true);
    const log = await store.events();
    expect(log.at(-1)).toMatchObject({ kind: 'retract', provenance: 'imported', source_app: 'healthkit', retracts: ev.id, effective_day: '2026-10-05' });
  });
});

describe('EventStore.batch', () => {
  it('rebuilds the projections once at the end instead of after every append', async () => {
    await store.batch(async () => {
      await store.append(flow('2026-10-05'));
      await store.append(flow('2026-10-06'));
      expect(await db.all('SELECT day FROM daily_log')).toEqual([]);
    });
    expect((await db.all<{ day: string }>('SELECT day FROM daily_log ORDER BY day')).map((r) => r.day)).toEqual(['2026-10-05', '2026-10-06']);
  });
  it('still rebuilds when the batch throws, and rethrows', async () => {
    await expect(store.batch(async () => { await store.append(flow('2026-10-05')); throw new Error('boom'); })).rejects.toThrow('boom');
    expect(await db.all('SELECT day FROM daily_log')).toHaveLength(1);
  });
  it('nested batches rebuild at the outermost end only', async () => {
    await store.batch(async () => {
      await store.batch(async () => { await store.append(flow('2026-10-05')); });
      expect(await db.all('SELECT day FROM daily_log')).toEqual([]);
    });
    expect(await db.all('SELECT day FROM daily_log')).toHaveLength(1);
  });
});
