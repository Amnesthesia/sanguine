import { FakeDriver, localIso } from '@sanguine/health-adapter';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from './database';
import { activeHealthTypes, mergeReports, runHealthSync, sinceFor } from './healthSync';
import type { Clock } from './ids';
import { migrate } from './migrate';
import { EventStore } from './store';
import { openTestDb } from './testDb';

function clock(): Clock {
  let n = 0;
  return { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Brisbane', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) };
}
const BNE = 'Australia/Brisbane';
const o = { now: '2026-10-09T08:00:00Z', deviceZone: BNE, since: '2024-10-09T00:00:00Z' };
let db: Database;
let store: EventStore;
let d: FakeDriver;
beforeEach(async () => { db = openTestDb(); await migrate(db); store = new EventStore(db, clock()); d = new FakeDriver('2026-10-09T07:00:00Z'); });
const foreignFlow = (day: string) => ({ type: 'period_flow' as const, start: localIso(day, '00:00', BNE), zone: BNE, value: { kind: 'flow' as const, level: 'medium' as const } });

describe('runHealthSync', () => {
  it('imports foreign records, writes ours, and the projections see both', async () => {
    await store.append({ kind: 'flow', payload: { day: '2026-09-01', level: 'medium', flow_kind: 'period' } });
    d.seed([foreignFlow('2026-08-04'), foreignFlow('2026-08-05')]);
    const r = await runHealthSync(db, store, d, ['period_flow', 'bbt'], o);
    expect(r).toMatchObject({ imported: 2, written: 1, failed: [] });
    expect((await db.all<{ day: string }>('SELECT day FROM daily_log ORDER BY day')).map((x) => x.day)).toEqual(['2026-08-04', '2026-08-05', '2026-09-01']);
    expect(await db.all("SELECT provenance FROM event WHERE kind = 'flow' ORDER BY effective_day")).toEqual([{ provenance: 'imported' }, { provenance: 'imported' }, { provenance: 'manual' }]);
  });
  it('a second run changes nothing', async () => {
    d.seed([foreignFlow('2026-08-04')]);
    await runHealthSync(db, store, d, ['period_flow'], o);
    const before = (await store.events()).length;
    const r = await runHealthSync(db, store, d, ['period_flow'], o);
    expect(r).toMatchObject({ imported: 0, written: 0, duplicates: 0 });
    expect((await store.events()).length).toBe(before);
  });
  it('a failing driver read is reported, not thrown, and other types still run', async () => {
    const read = d.read.bind(d);
    d.read = async (t, a, s) => { if (t === 'bbt') throw new Error('permission denied'); return read(t, a, s); };
    d.seed([foreignFlow('2026-08-04')]);
    const r = await runHealthSync(db, store, d, ['bbt', 'period_flow'], o);
    expect(r.failed).toEqual([{ op: 'read', error: 'permission denied' }]);
    expect(r.imported).toBe(1);
  });
});

describe('activeHealthTypes', () => {
  it('drops sexual activity unless its logging is on', () => {
    expect(activeHealthTypes({ healthTypes: ['bbt', 'sex'], sexLogging: false })).toEqual(['bbt']);
    expect(activeHealthTypes({ healthTypes: ['bbt', 'sex'], sexLogging: true })).toEqual(['bbt', 'sex']);
  });
});

describe('mergeReports and sinceFor', () => {
  it('adds counts and concatenates lists', () => {
    const a = { imported: 1, echoed: 0, duplicates: 2, conflicts: 0, retracted: 0, written: 1, deletedRemote: 0, asks: [], failed: [] };
    const b = { ...a, imported: 3, asks: [{ eventId: 'e', externalId: 'x', day: '2026-10-05', reason: 'deleted_remote_manual' as const }] };
    expect(mergeReports([a, b])).toMatchObject({ imported: 4, duplicates: 4, written: 2, asks: b.asks });
  });
  it('turns the import window into an instant before today', () => {
    expect(sinceFor('30d', '2026-10-09')).toBe('2026-09-09T00:00:00.000Z');
    expect(sinceFor('1y', '2026-10-09')).toBe('2025-10-09T00:00:00.000Z');
    expect(sinceFor('2y', '2026-10-09')).toBe('2024-10-09T00:00:00.000Z');
  });
});
