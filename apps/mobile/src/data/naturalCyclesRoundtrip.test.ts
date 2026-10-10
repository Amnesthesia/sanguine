// P8-12 (D-091): fake Natural Cycles exports from synthetic users with known truth go through the real import
// (xlsx -> parser -> importDailyRows -> event store -> projection) and must reach the engine as that truth.
import { analyzeCycles, diffDays, predict, type ISODate } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { EVENTS, type EventKind, historyFrom, timeline, type Timeline } from '../../../../tools/backtest/src/events';
import { Rng } from '../../../../tools/backtest/src/rng';
import { sampleUsers, TIGHT } from '../../../../tools/backtest/src/synth';
import type { Clock } from './ids';
import { importDailyRows } from './importDaily';
import { readNaturalCycles } from './importNaturalCycles';
import { migrate } from './migrate';
import { ncTable, ncXlsx } from './ncFixture';
import { EventStore } from './store';
import { openTestDb } from './testDb';

let n = 0;
const clock: Clock = { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) };
const PER_EVENT = 3;

async function importUser(t: Timeline, rng: Rng) {
  const parsed = readNaturalCycles(ncXlsx(ncTable(t, rng)));
  if (!parsed) throw new Error('fixture not recognised as a Natural Cycles export');
  const db = openTestDb();
  await migrate(db);
  const store = new EventStore(db, clock);
  const opts = { sourceApp: 'natural_cycles', today: t.observed.at(-1) as ISODate, clock };
  const first = await importDailyRows(db, store, parsed.rows, opts);
  const again = await importDailyRows(db, store, parsed.rows, opts);
  return { parsed, first, again, inputs: await store.engineInputs() };
}

const rng = new Rng(20261011);
const users = sampleUsers(rng, EVENTS.length * PER_EVENT, TIGHT);
const cases = EVENTS.flatMap((e, i) => Array.from({ length: PER_EVENT }, (_, j) => ({ e, u: users[i * PER_EVENT + j] as (typeof users)[number], j })));

describe.each(cases)('fake Natural Cycles export: $e user $j', ({ e, u, j }) => {
  const seed = new Rng(1000 * EVENTS.indexOf(e as EventKind) + j);
  const t = timeline(seed, u, 12, e as EventKind);
  const run = importUser(t, seed);

  it('parses with nothing reported and imports idempotently', async () => {
    const { parsed, first, again } = await run;
    expect(parsed.problems).toEqual([]);
    expect(first.added).toBeGreaterThan(0);
    expect(again.added).toBe(0);
  });
  it('cycle starts are exactly the logged period starts; bleeding after a loss starts none', async () => {
    const { inputs } = await run;
    expect(inputs.history.cycles.map((c) => c.start)).toEqual(t.observed);
    if (t.lossBleed) expect(inputs.history.cycles.map((c) => c.start)).not.toContain(t.lossBleed);
  });
  it('the next-period forecast equals the one from the true logged starts', async () => {
    const { inputs } = await run;
    const today = t.observed.at(-1) as ISODate;
    const fromImport = predict(inputs.history, inputs.settings, today);
    const fromTruth = predict(historyFrom(t.observed, today), inputs.settings, today);
    expect(fromImport.nextPeriod).toEqual(fromTruth.nextPeriod);
    expect(fromImport.cycleLength).toEqual(fromTruth.cycleLength);
  });
  it('ovulation found from the imported LH tests and temperatures is within a day of the truth', async () => {
    const { inputs } = await run;
    const found = analyzeCycles(inputs.history, inputs.settings).map((c) => c.record).filter((c) => t.ovulation.has(c.start) && c.nextStart && t.starts.includes(c.nextStart)); // not a cycle cut by a mid-cycle bleed
    expect(found.length).toBeGreaterThan(0);
    for (const c of found) {
      expect(c.ovulation, `cycle ${c.start}`).toBeDefined();
      expect(Math.abs(diffDays(c.ovulation?.point as string, t.ovulation.get(c.start) as string)), `cycle ${c.start}`).toBeLessThanOrEqual(1);
    }
  });
  it('symptoms imported from the export never change the forecast', async () => {
    const { inputs } = await run;
    const today = t.observed.at(-1) as ISODate;
    const bare = { ...inputs.history, logs: inputs.history.logs.map(({ symptoms: _s, ...l }) => l) };
    expect(predict(bare, inputs.settings, today)).toEqual(predict(inputs.history, inputs.settings, today));
  });
});
