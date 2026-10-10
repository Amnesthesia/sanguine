// P8-12 (D-091): forecast accuracy around life events on seeded synthetic users. Rolling origin: at every logged period,
// forecast the next one from what was logged so far. Targets are split into before the event, around it, and two or more
// cycles after it (recovery). The challengers (src/challengers.ts) are measured, not gated.
import { addDays, diffDays } from '@sanguine/engine';
import type { EngineSettings, ISODate } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { CHALLENGERS, engine, type DateForecast, type DateModel, tally, type Tally } from './src/challengers';
import { EVENT_AT, EVENTS, type EventKind, historyFrom, timeline } from './src/events';
import { mlModels, train } from './src/ml';
import { Rng } from './src/rng';
import { sampleUsers, WIDE } from './src/synth';

const USERS = 400;
const CYCLES = 16;
const SEED = 20261010;
const BASE: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };

/** Last valid-looking cycle length, the "same as last time" rule many apps start from. */
const naive: DateModel = (h, _s, today) => {
  const st = h.cycles.map((c) => c.start).filter((d) => d <= today).sort();
  const last = st.length >= 2 ? diffDays(st.at(-1) as string, st.at(-2) as string) : 28;
  const at = (d: number) => addDays(st.at(-1) as string, d);
  return { point: at(last), i80: { lo: at(last - 2), hi: at(last + 2) }, i95: { lo: at(last - 4), hi: at(last + 4) } };
};
const ML = mlModels(train());
const MODELS: Record<string, DateModel> = { ...CHALLENGERS, ...ML, naive };

type Segment = 'before' | 'event' | 'after';
type Rows = Record<string, Record<Segment, Array<{ f: DateForecast; actual: ISODate }>>>;

function run(event: EventKind, marked: boolean, seed: number): Record<string, Record<Segment, Tally>> {
  const rng = new Rng(seed);
  const users = sampleUsers(rng, USERS, WIDE);
  const rows: Rows = Object.fromEntries(Object.keys(MODELS).map((m) => [m, { before: [], event: [], after: [] }]));
  for (const u of users) {
    const t = timeline(rng, u, CYCLES, event);
    const settings = marked ? { ...BASE, lifeStates: t.lifeStates } : BASE;
    const eventStart = t.starts[EVENT_AT] as ISODate;
    const recovered = t.starts[EVENT_AT + 3] as ISODate;
    for (let k = 3; k < t.observed.length; k++) {
      const today = t.observed[k - 1] as ISODate;
      const actual = t.observed[k] as ISODate;
      const h = historyFrom(t.observed, today);
      const seg: Segment = actual <= eventStart ? 'before' : actual < recovered ? 'event' : 'after';
      for (const [name, m] of Object.entries(MODELS)) {
        const f = m(h, settings, today);
        if (f) rows[name]?.[seg].push({ f, actual });
      }
    }
  }
  return Object.fromEntries(Object.entries(rows).map(([m, r]) => [m, { before: tally(r.before), event: tally(r.event), after: tally(r.after) }]));
}

/** Mid-cycle forecast three days after an LH-dated ovulation: does ovulation + luteal beat the cycle-length model? */
function midCycle(seed: number): Record<'engine' | 'luteal', Tally> {
  const rng = new Rng(seed);
  const rows = { engine: [] as Array<{ f: DateForecast; actual: ISODate }>, luteal: [] as Array<{ f: DateForecast; actual: ISODate }> };
  for (const u of sampleUsers(rng, USERS, WIDE)) {
    const t = timeline(rng, u, CYCLES, 'none');
    for (let k = 6; k < CYCLES; k++) {
      const start = t.starts[k] as ISODate;
      const ov = t.ovulation.get(start) as ISODate;
      const today = addDays(ov, 3);
      const h = historyFrom(t.observed, today, t.ovulation);
      for (const name of ['engine', 'luteal'] as const) {
        const f = CHALLENGERS[name]?.(h, BASE, today);
        if (f) rows[name].push({ f, actual: t.starts[k + 1] as ISODate });
      }
    }
  }
  return { engine: tally(rows.engine), luteal: tally(rows.luteal) };
}

/** Learning over time (D-094): engine forecasts grouped by how many cycles she had logged, and, after a +5 d lasting change,
 *  by how many cycles had passed since it. */
const BUCKETS = [[0, 1], [2, 3], [4, 6], [7, 10], [11, 15]] as const;
function learning(seed: number): { byHistory: Tally[]; meanError: number[]; sinceStep: Tally[] } {
  const rng = new Rng(seed);
  const byHistory = BUCKETS.map(() => [] as Array<{ f: DateForecast; actual: ISODate }>);
  const meanErr = BUCKETS.map(() => [] as number[]); // |forecast length - her true mean length|: how well the model knows her
  const sinceStep = [0, 1, 2, 3, 4, 5, 6].map(() => [] as Array<{ f: DateForecast; actual: ISODate }>);
  for (const [i, u] of sampleUsers(rng, USERS, WIDE).entries()) {
    const step = i % 2 === 1;
    const t = timeline(rng, u, CYCLES, step ? 'step' : 'none');
    for (let k = 1; k < t.observed.length; k++) {
      const today = t.observed[k - 1] as ISODate;
      const f = engine(historyFrom(t.observed, today), BASE, today);
      if (!f) continue;
      const row = { f, actual: t.observed[k] as ISODate };
      const closed = k - 1;
      const b = BUCKETS.findIndex(([lo, hi]) => closed >= lo && closed <= hi);
      if (!step) { byHistory[b]?.push(row); meanErr[b]?.push(Math.abs(diffDays(f.point, today) - u.mu)); }
      else if (k - 1 - EVENT_AT >= 0) sinceStep[k - 1 - EVENT_AT]?.push(row); // cycles after the change already logged
    }
  }
  return { byHistory: byHistory.map(tally), meanError: meanErr.map((e) => e.reduce((a, b) => a + b, 0) / e.length), sinceStep: sinceStep.map(tally) };
}

const fmt = (r: Record<string, Record<Segment, Tally>>) =>
  Object.entries(r).flatMap(([m, segs]) => Object.entries(segs).map(([seg, t]) => ({
    model: m, seg, n: t.n, mae: +t.mae.toFixed(2), cov80: +t.cov80.toFixed(2), cov95: +t.cov95.toFixed(2), w80: +t.width80.toFixed(1),
  })));

const results = Object.fromEntries(EVENTS.map((e, i) => [e, run(e, false, SEED + i)])) as Record<EventKind, ReturnType<typeof run>>;
const lossMarked = run('loss', true, SEED + EVENTS.indexOf('loss'));
const mid = midCycle(SEED + 100);
const learned = learning(SEED + 200);
if (process.env.BACKTEST_REPORT) {
  for (const [e, r] of Object.entries(results)) { console.log(`\n=== ${e} ===`); console.table(fmt(r)); }
  console.log('\n=== loss, marked ==='); console.table(fmt(lossMarked));
  console.log('\n=== mid-cycle, 3 days after LH-dated ovulation ==='); console.table(mid);
  console.log('\n=== by cycles logged ==='); console.table(learned.byHistory.map((t, i) => ({ cycles: BUCKETS[i]?.join('-'), meanError: learned.meanError[i], ...t })));
  console.log('\n=== by cycles logged since a +5 d change ==='); console.table(learned.sinceStep.map((t, i) => ({ since: i, ...t })));
}
const E = (e: EventKind | 'lossMarked', seg: Segment, m = 'engine') => ((e === 'lossMarked' ? lossMarked : results[e])[m] as Record<Segment, Tally>)[seg];

describe('engine accuracy around life events (synthetic, seeded)', () => {
  it('is deterministic', () => expect(run('skip', false, SEED + EVENTS.indexOf('skip'))).toEqual(results.skip), 30_000);
  it('no event: MAE under 2.8 d, ranges cover at least nominal, better than "same as last time"', () => {
    const t = E('none', 'after');
    expect(t.mae).toBeLessThanOrEqual(2.8);
    // D-091 finding: without the 4% late-ovulation cycles of the acceptance population the 80% range covers ~90%, i.e. it is
    // wider than it needs to be for a user with no long cycles; conservative, so pinned rather than tuned
    expect(t.cov80).toBeGreaterThanOrEqual(0.78);
    expect(t.cov80).toBeLessThanOrEqual(0.95);
    expect(t.cov95).toBeGreaterThanOrEqual(0.93);
    expect(t.mae).toBeLessThan(E('none', 'after', 'naive').mae);
  });
  it.each(['skip', 'long', 'short'] as const)('%s: two cycles on, accuracy is back within 1 d of an event-free user', (e) => {
    expect(E(e, 'after').mae).toBeLessThanOrEqual(E('none', 'after').mae + 1);
    expect(E(e, 'after').cov80).toBeGreaterThanOrEqual(0.7);
  });
  it('step change of +5 d: per-user recency (D-094) follows it; 3.81 d and 75% held with lambda = 1 (D-091)', () => {
    expect(E('step', 'after').mae).toBeLessThan(3.4);
    expect(E('step', 'after').cov80).toBeGreaterThanOrEqual(0.85);
  });
  it('skip and long: the set-aside cycle costs almost nothing after it', () => {
    for (const e of ['skip', 'long'] as const) expect(E(e, 'after').mae - E('none', 'after').mae).toBeLessThan(0.3);
  });
  it('pregnancy loss not marked: the forecast misses the ending bleed, then recovers', () => {
    expect(E('loss', 'event').mae).toBeGreaterThan(10);
    expect(E('loss', 'after').mae).toBeLessThanOrEqual(E('none', 'after').mae + 1);
  });
  it('pregnancy loss marked: no forecast while paused; after it, coverage holds', () => {
    expect(E('lossMarked', 'event').n).toBeLessThan(E('loss', 'event').n);
    expect(E('lossMarked', 'after').cov80).toBeGreaterThanOrEqual(0.7);
  });
  it('pregnancy loss marked: her earlier cycles set the date (5.68 d prior-only in D-091), the range stays as wide as before (D-094)', () => {
    expect(E('lossMarked', 'event').mae).toBeLessThan(5);
    expect(E('lossMarked', 'event').cov80).toBeGreaterThanOrEqual(0.7);
  });
  it('mid-cycle after an LH-dated ovulation, ovulation + luteal length beats the cycle-length forecast (D-091 finding)', () => {
    expect(mid.luteal.mae).toBeLessThan(mid.engine.mae * 0.8);
  });
  it('challengers run on every scenario and return forecasts', () => {
    for (const r of Object.values(results)) for (const m of Object.keys(CHALLENGERS)) expect(r[m]?.after.n).toBeGreaterThan(0);
    // lossKeep (no warm-up at all) only differs where a loss is marked
    expect(E('lossMarked', 'event', 'lossKeep').cov80).not.toBe(E('lossMarked', 'event').cov80);
    expect(mid.luteal.n).toBe(mid.engine.n);
    for (const m of Object.keys(ML)) expect(results.none[m]?.after.n).toBe(results.none.engine?.after.n);
  });
});


describe('predictions improve as data comes in (synthetic, seeded, D-094)', () => {
  const { byHistory, meanError, sinceStep } = learned;
  it('each logged cycle teaches the model her own length: the gap to her true mean shrinks with every history band', () => {
    for (let i = 1; i < meanError.length; i++) expect(meanError[i]).toBeLessThan(meanError[i - 1] as number);
    expect(meanError.at(-1)).toBeLessThan((meanError[0] as number) / 3);
  });
  it('so the error of the next-period forecast falls, down to her own cycle-to-cycle variation', () => {
    expect(byHistory.at(-1)?.mae).toBeLessThan((byHistory[0]?.mae as number) * 0.75);
    for (let i = 1; i < byHistory.length; i++) expect(byHistory[i]?.mae).toBeLessThan((byHistory[i - 1]?.mae as number) + 0.1);
  });
  it('and the range narrows from the population range to hers', () => {
    expect(byHistory.at(-1)?.width80).toBeLessThan((byHistory[0]?.width80 as number) * 0.75);
  });
  it('the ranges stay honest while they narrow: the 80% range holds 75-95% of periods at every history length', () => {
    for (const t of byHistory) { expect(t.cov80).toBeGreaterThanOrEqual(0.75); expect(t.cov80).toBeLessThanOrEqual(0.95); }
  });
  it('after a lasting change, the error falls cycle by cycle as the new length is logged', () => {
    const mae = sinceStep.map((t) => t.mae);
    expect(mae[0]).toBeGreaterThan(4); // the first period after the change is a surprise
    expect(mae[6]).toBeLessThan((mae[0] as number) * 0.6);
    expect(mae[3]).toBeLessThan(mae[1] as number);
  });
});
