import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from './database';
import { ledgerSummary } from './ledger';
import { type Clock } from './ids';
import { migrate } from './migrate';
import { EventStore } from './store';
import { openTestDb } from './testDb';
import { ENGINE_VERSION } from '@sanguine/engine';

function clock(): Clock {
  let n = 0;
  return { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) };
}
let db: Database;
let store: EventStore;
beforeEach(async () => { db = openTestDb(); await migrate(db); store = new EventStore(db, clock()); });
const start = (d: string) => store.append({ kind: 'flow', payload: { day: d, level: 'medium', flow_kind: 'period' } });
const scores = () => db.all<Record<string, unknown>>('SELECT * FROM prediction_score ORDER BY cycle_id');
const REGULAR = ['2026-06-01', '2026-06-29', '2026-07-28', '2026-08-25', '2026-09-23', '2026-10-21'];

describe('prediction-score ledger (PLAN.md §4.15)', () => {
  it('scores each closed cycle against the forecast issued on the day it started', async () => {
    for (const d of REGULAR) await start(d);
    const rows = await scores();
    expect(rows).toHaveLength(5); // five closed cycles; the open one is not scored
    expect(rows.map((r) => r.cycle_id)).toEqual(REGULAR.slice(0, 5).map((d) => `cyc-${d}`));
    const first = rows[0] as Record<string, unknown>;
    // first cycle: prior only (29.3 d) vs actual 28 d
    expect(first.predicted_day).toBe('2026-06-30');
    expect(first.actual_day).toBe('2026-06-29');
    expect(first.abs_error).toBe(1);
    expect(first.engine_version).toBe(ENGINE_VERSION);
    expect(first.in80).toBe(1);
    expect(first.confidence).toBe('low');
    expect(first.basis).toBe('calendar');
  });
  it('lo80 <= predicted <= hi80 on every row, and in80 agrees with the interval', async () => {
    for (const d of REGULAR) await start(d);
    for (const r of await scores()) {
      expect((r.lo80 as string) <= (r.predicted_day as string) && (r.predicted_day as string) <= (r.hi80 as string)).toBe(true);
      expect(r.in80 === 1).toBe((r.lo80 as string) <= (r.actual_day as string) && (r.actual_day as string) <= (r.hi80 as string));
    }
  });
  it('does not score suspect or excluded cycles', async () => {
    for (const d of ['2026-01-01', '2026-01-29', '2026-02-27', '2026-04-23', '2026-05-21', '2026-06-19', '2026-07-17']) await start(d);
    const ids = (await scores()).map((r) => r.cycle_id);
    expect(ids).not.toContain('cyc-2026-02-27'); // the 56-day cycle
    expect(ids).toContain('cyc-2026-01-01');
  });
  it('is stable: rebuilding does not rewrite existing rows', async () => {
    for (const d of REGULAR) await start(d);
    await db.run("UPDATE prediction_score SET engine_version = '0.0.1' WHERE cycle_id = 'cyc-2026-06-01'");
    await store.rebuild();
    expect((await scores())[0]?.engine_version).toBe('0.0.1'); // what was shown then stays
  });
  it('re-scores a cycle whose end moved and drops rows for cycles that no longer exist', async () => {
    const events = [];
    for (const d of REGULAR) events.push(await start(d));
    await store.retract(events[1]?.id as string); // the 2026-06-29 start is removed
    await start('2026-06-27'); // and entered two days earlier
    const rows = await scores();
    expect(rows.map((r) => r.cycle_id)).not.toContain('cyc-2026-06-29');
    expect(rows.map((r) => r.cycle_id)).toContain('cyc-2026-06-27');
    expect(rows.find((r) => r.cycle_id === 'cyc-2026-06-01')).toMatchObject({ actual_day: '2026-06-27', abs_error: 3 });
  });
  it('a cycle that turns suspect after a correction leaves the ledger', async () => {
    const events = [];
    for (const d of REGULAR) events.push(await start(d));
    await store.retract(events[1]?.id as string); // cycle 1 becomes 57 days: suspect_skip
    expect((await scores()).map((r) => r.cycle_id)).not.toContain('cyc-2026-06-01');
  });
  it('summary: counts, hit rates and average miss', async () => {
    for (const d of REGULAR) await start(d);
    const s = await ledgerSummary(db);
    expect(s.total).toBe(5);
    expect(s.in80).toBeGreaterThanOrEqual(3);
    expect(s.in80).toBeLessThanOrEqual(5);
    expect(s.meanAbsError).toBeGreaterThanOrEqual(0);
    expect(s.meanAbsError).toBeLessThan(3);
  });
  it('summary of an empty ledger', async () => expect(await ledgerSummary(db)).toEqual({ total: 0, in80: 0, in95: 0, meanAbsError: 0 }));
  it('a forecast never uses information from after the day it was issued', async () => {
    // an LH surge logged in the later part of cycle 1 must not move the forecast issued on cycle 1 day 0
    for (const d of REGULAR.slice(0, 2)) await start(d);
    const before = (await scores())[0]?.predicted_day;
    await store.append({ kind: 'biomarker', payload: { day: '2026-06-20', type: 'lh', value: { result: 'positive' }, source: 'strip' } });
    expect((await scores())[0]?.predicted_day).toBe(before);
  });
});
