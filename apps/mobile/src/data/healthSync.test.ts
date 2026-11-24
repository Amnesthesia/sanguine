import { FakeDriver, localIso } from '@sanguine/health-adapter';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from './database';
import { activeHealthTypes, backfillWidened, mergeReports, runHealthSync, serialize, sinceFor } from './healthSync';
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
    expect(sinceFor('all', '2026-10-09')).toBe('1970-01-01T00:00:00.000Z');
  });
});

/** Health Connect semantics: no anchor reads the records that exist and carries no deletion feed; an anchor returns the changes, deletions included. */
class HcLikeDriver extends FakeDriver {
  override async read(type: Parameters<FakeDriver['read']>[0], anchor: string | null, since: string) {
    const r = await super.read(type, anchor, since);
    return anchor === null ? { ...r, deleted: [] } : r;
  }
}
describe('backfillWidened', () => {
  const anchorOf = async () => (await db.get<{ anchor: string | null }>('SELECT anchor FROM health_sync WHERE data_type = ?', ['period_flow']))?.anchor ?? null;
  const days = async () => (await db.all<{ day: string }>('SELECT day FROM daily_log ORDER BY day')).map((x) => x.day);
  const recent = { ...o, since: '2026-08-01T00:00:00Z' };
  const backfill = (window: 'all' | '2y' | '30d', drv: FakeDriver = d) => backfillWidened(db, store, drv, ['period_flow'], window, { ...o, since: sinceFor(window, '2026-10-09') });

  it('imports older records without touching the anchor, and the incremental feed still delivers a deletion made before the widening', async () => {
    d = new HcLikeDriver('2026-10-09T07:00:00Z');
    const [recentRec] = d.seed([foreignFlow('2026-08-04')]);
    await backfill('30d');
    await runHealthSync(db, store, d, ['period_flow'], recent);
    const anchor = await anchorOf();
    d.seed([foreignFlow('2024-03-01')]);
    d.remoteDelete((recentRec as { externalId: string }).externalId);
    expect(await backfill('all')).toMatchObject({ imported: 1, retracted: 0, failed: [] });
    expect(await anchorOf()).toBe(anchor);
    expect(await days()).toContain('2026-08-04'); // still active: the deletion arrives through the feed, not the backfill
    const r = await runHealthSync(db, store, d, ['period_flow'], recent);
    expect(r.retracted).toBe(1);
    expect(await days()).toEqual(['2024-03-01']);
  });
  it('ignores the deleted list of a fresh read', async () => {
    const [rec] = d.seed([foreignFlow('2026-08-04')]);
    await runHealthSync(db, store, d, ['period_flow'], o);
    d.remoteDelete((rec as { externalId: string }).externalId);
    const r = await runHealthSync(db, store, d, ['period_flow'], { ...o, backfill: true });
    expect(r.retracted).toBe(0);
    expect(await days()).toEqual(['2026-08-04']);
  });
  it('a second backfill adds nothing, and a run for an unchanged or narrower window does not read', async () => {
    d.seed([foreignFlow('2026-08-04'), foreignFlow('2024-03-01')]);
    await backfill('30d');
    await backfill('all');
    const n = (await store.events()).length;
    const again = await runHealthSync(db, store, d, ['period_flow'], { ...o, since: sinceFor('all', '2026-10-09'), backfill: true });
    expect(again).toMatchObject({ imported: 0 });
    expect((await store.events()).length).toBe(n);
    d.lastAnchor = 'untouched';
    expect(await backfill('all')).toBeNull();
    expect(await backfill('2y')).toBeNull();
    expect(d.lastAnchor).toBe('untouched');
  });
  it('a failed backfill does not mark the window done, so the next call retries', async () => {
    d.seed([foreignFlow('2024-03-01')]);
    await backfill('30d');
    const read = d.read.bind(d);
    d.read = async () => { throw new Error('offline'); };
    expect((await backfill('all'))?.failed).toEqual([{ op: 'read', error: 'offline' }]);
    d.read = read;
    expect(await backfill('all')).toMatchObject({ imported: 1 });
    expect(await backfill('all')).toBeNull();
  });
});

describe('serialize', () => {
  it('runs overlapping calls one after the other, in order, and keeps going after a failure', async () => {
    const log: string[] = [];
    const task = (name: string, fail = false) => serialize(async () => {
      log.push(`${name}:start`);
      await new Promise((r) => setTimeout(r, 5));
      log.push(`${name}:end`);
      if (fail) throw new Error(name);
      return name;
    });
    const results = await Promise.allSettled([task('a', true), task('b'), task('c')]);
    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
    expect(results.map((x) => x.status)).toEqual(['rejected', 'fulfilled', 'fulfilled']);
  });
});
