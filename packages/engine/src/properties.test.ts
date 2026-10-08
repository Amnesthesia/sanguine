// PLAN.md §4.15 property tests (fast-check, 1,000 runs each).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cyclePrior, fitCycleLength, predictiveInterval } from './cycleLength';
import { addDays } from './dates';
import { emptyHistory, FIXTURE_SETTINGS, historyFromLengths, LAST_START } from './fixtures';
import { predict } from './predict';
import type { DailyLog, EngineSettings, History, ISODate, Prediction } from './types';

const RUNS = { numRuns: 1000 };
const lengthsArb = fc.array(fc.integer({ min: 15, max: 60 }), { minLength: 0, maxLength: 12 });
const startArb = fc.integer({ min: 0, max: 3000 }).map((d) => addDays('2020-01-01', d));
const settingsArb: fc.Arbitrary<EngineSettings> = fc.record({
  lifeStates: fc.constant([]), recencyLambda: fc.constantFrom(0.8, 0.92, 1), window: fc.constantFrom(6, 12),
});
const D = /^\d{4}-\d{2}-\d{2}$/;
function shiftDates<T>(v: T, k: number): T {
  if (typeof v === 'string') return (D.test(v) ? addDays(v, k) : v) as T;
  if (Array.isArray(v)) return v.map((x) => shiftDates(x, k)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([key, x]) => [key, shiftDates(x, k)])) as T;
  return v;
}
const run = (lengths: number[], s: EngineSettings, start: ISODate, daysIn: number) =>
  predict(historyFromLengths(lengths, start), s, addDays(start, daysIn));

describe('interval invariants', () => {
  it('point inside 80% inside 95% for the next period and ovulation; probabilities in [0,1]', () => {
    fc.assert(fc.property(lengthsArb, settingsArb, startArb, fc.integer({ min: 0, max: 40 }), (l, s, start, d) => {
      const p = run(l, s, start, d);
      const n = p.nextPeriod;
      if (n) {
        expect(n.i95.lo <= n.i80.lo && n.i80.lo <= n.point && n.point <= n.i80.hi && n.i80.hi <= n.i95.hi).toBe(true);
        expect(p.cycleLength.scale).toBeGreaterThan(0);
        expect(p.cycleLength.nu).toBeGreaterThanOrEqual(5);
      }
      if (p.ovulation) expect(p.ovulation.i80.lo <= p.ovulation.point && p.ovulation.point <= p.ovulation.i80.hi).toBe(true);
      for (const f of p.fertileDays ?? []) expect(f.pInWindow > 0 && f.pInWindow <= 1).toBe(true);
    }), RUNS);
  });
});

describe('monotone narrowing', () => {
  it('an extra observation at the posterior mean never widens the 80% or 95% interval', () => {
    fc.assert(fc.property(lengthsArb, fc.constantFrom(0.92, 1), fc.constantFrom(0.8 as const, 0.95 as const), (l, lambda, level) => {
      const prior = cyclePrior();
      const before = fitCycleLength(l, prior, 1);
      // lambda = 1 so the new observation does not down-weight the old ones
      const after = fitCycleLength([...l, before.m], prior, 1, 99);
      const [a, b] = predictiveInterval(before, level);
      const [c, d] = predictiveInterval(after, level);
      expect(d - c).toBeLessThanOrEqual(b - a + 1e-9);
      void lambda;
    }), RUNS);
  });
  it('repeating an identical cycle length in a perfectly regular history never widens the next-period range', () => {
    fc.assert(fc.property(fc.integer({ min: 20, max: 40 }), fc.integer({ min: 1, max: 10 }), (len, n) => {
      const a = run(Array(n).fill(len), FIXTURE_SETTINGS, LAST_START, 9).nextPeriod;
      const b = run(Array(n + 1).fill(len), FIXTURE_SETTINGS, LAST_START, 9).nextPeriod;
      const w = (x: typeof a) => (x ? Date.parse(x.i80.hi) - Date.parse(x.i80.lo) : 0);
      expect(w(b)).toBeLessThanOrEqual(w(a));
    }), RUNS);
  });
});

describe('translation invariance', () => {
  it('shifting every date by k shifts every output date by k and leaves numbers alone', () => {
    fc.assert(fc.property(lengthsArb, settingsArb, startArb, fc.integer({ min: 0, max: 40 }), fc.integer({ min: -2000, max: 2000 }), (l, s, start, d, k) => {
      const a = run(l, s, start, d);
      const b = run(l, s, addDays(start, k), d);
      const { engineVersion: _v, ...rest } = a;
      expect(JSON.parse(JSON.stringify(b))).toEqual(JSON.parse(JSON.stringify(shiftDates({ ...rest, engineVersion: a.engineVersion }, k))));
    }), RUNS);
  });
});

describe('symptoms never change a prediction (ER-03, C-10)', () => {
  const symptomLog = (date: ISODate, codes: string[]): DailyLog => ({ date, symptoms: codes.map((c, i) => ({ code: c, intensity: ((i % 3) + 1) as 1 | 2 | 3 })) });
  const codesArb = fc.array(fc.constantFrom('cramps', 'headache', 'bloating', 'acne', 'mood_low', 'breast_tenderness', 'fatigue', 'mid_cycle_pain'), { maxLength: 5 });
  it('adding or permuting symptom logs leaves nextPeriod, ovulation, fertileDays, phase unchanged', () => {
    fc.assert(fc.property(
      lengthsArb, startArb, fc.integer({ min: 0, max: 40 }),
      fc.array(fc.tuple(fc.integer({ min: -60, max: 40 }), codesArb), { maxLength: 30 }), fc.integer(),
      (l, start, d, raw, seed) => {
        const today = addDays(start, d);
        const base = historyFromLengths(l, start);
        const logs = raw.map(([off, codes]) => symptomLog(addDays(start, off), codes));
        const shuffled = [...logs].sort((x, y) => ((x.date.charCodeAt(9) * 31 + seed) % 7) - ((y.date.charCodeAt(9) * 31 + seed) % 7));
        const pick = (p: Prediction) => JSON.stringify([p.nextPeriod, p.ovulation, p.fertileDays, p.currentPhase, p.cycleLength]);
        const plain = pick(predict(base, FIXTURE_SETTINGS, today));
        expect(pick(predict({ ...base, logs }, FIXTURE_SETTINGS, today))).toBe(plain);
        expect(pick(predict({ ...base, logs: shuffled }, FIXTURE_SETTINGS, today))).toBe(plain);
      }), RUNS);
  });
});

describe('order independence and determinism (ER-01, ER-11)', () => {
  it('shuffling the cycle list gives the same prediction, and two calls agree byte for byte', () => {
    fc.assert(fc.property(lengthsArb, startArb, fc.integer({ min: 0, max: 40 }), fc.integer({ min: 0, max: 1000 }), (l, start, d, seed) => {
      const h = historyFromLengths(l, start);
      const shuffled: History = { ...h, cycles: [...h.cycles].sort((a, b) => ((a.id.charCodeAt(1) * 7919 + seed) % 13) - ((b.id.charCodeAt(1) * 7919 + seed) % 13)) };
      const today = addDays(start, d);
      const a = JSON.stringify(predict(h, FIXTURE_SETTINGS, today));
      expect(JSON.stringify(predict(shuffled, FIXTURE_SETTINGS, today))).toBe(a);
      expect(JSON.stringify(predict(h, FIXTURE_SETTINGS, today))).toBe(a);
    }), RUNS);
  });
  it('an empty history predicts nothing', () => {
    const p = predict(emptyHistory(), FIXTURE_SETTINGS, LAST_START);
    expect(p.nextPeriod).toBeUndefined();
  });
});
