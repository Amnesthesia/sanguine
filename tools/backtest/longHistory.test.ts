// D-161 gates on long histories (synthetic, seeded): the calendar ovulation range holds its true ovulation at least 80% of
// the time under both between-woman luteal spreads, period ranges stay calibrated, and a longer window helps regular users.
// Protocol: history of h cycles, forecast on the day cycle h+1 starts, scored against that cycle's true ovulation and length.
import { describe, expect, it } from 'vitest';
import { addDays, diffDays, predict, WINDOW_CYCLES, type CycleRecord, type EngineSettings, type History } from '@sanguine/engine';
import { Rng } from './src/rng';
import { sampleOvulationHistory, sampleUsers, WIDE } from './src/synth';

const USERS = 300;
const SEED = 20261125;
const H = [8, 12, 36, 78] as const;
const START = '2020-01-01';
const DRIFT_PER_CYCLE = -0.18 / 12.4; // Bull 2019: about -0.18 d per year of age

function historyFor(lengths: number[]): History {
  let s = START;
  const cycles: CycleRecord[] = [{ id: 'c1', start: s, quality: 'valid' }];
  lengths.forEach((l, i) => { s = addDays(s, l); cycles.push({ id: `c${i + 2}`, start: s, quality: 'valid' }); });
  return { cycles, temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
}

interface Row { ovIn: boolean; ovWidth: number; graded: boolean; periodIn: boolean; periodErr: number; regular: boolean }

function run(lutealBetweenSd: number, window: number, drift = 0): Record<number, Row[]> {
  const rng = new Rng(SEED);
  const settings: EngineSettings = { lifeStates: [], recencyLambda: 1, window };
  const out: Record<number, Row[]> = Object.fromEntries(H.map((h) => [h, []]));
  for (const u of sampleUsers(rng, USERS, WIDE)) {
    const { lengths, ovulation } = sampleOvulationHistory(rng, u, 79, WIDE, lutealBetweenSd, drift);
    for (const h of H) {
      const today = addDays(START, lengths.slice(0, h).reduce((a, b) => a + b, 0));
      const p = predict(historyFor(lengths.slice(0, h)), settings, today);
      if (!p.ovulation || !p.nextPeriod) continue;
      const at = (d: string) => diffDays(d, today);
      const truthOv = ovulation[h] as number;
      const truthLen = lengths[h] as number;
      out[h]?.push({
        ovIn: at(p.ovulation.i80.lo) <= truthOv && truthOv <= at(p.ovulation.i80.hi),
        ovWidth: at(p.ovulation.i80.hi) - at(p.ovulation.i80.lo),
        graded: p.ovulation.confidence !== 'low',
        periodIn: at(p.nextPeriod.i80.lo) <= truthLen && truthLen <= at(p.nextPeriod.i80.hi),
        periodErr: Math.abs(at(p.nextPeriod.point) - truthLen),
        regular: u.sig <= 1.5,
      });
    }
  }
  return out;
}

const mean = (rows: Row[], f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0) / rows.length;

describe('long histories (D-161)', () => {
  const narrowLuteal = run(1.1, WINDOW_CYCLES);
  const wideLuteal = run(2.0, WINDOW_CYCLES);
  const window12 = run(1.1, 12);
  if (process.env.BACKTEST_REPORT) {
    const row = (name: string, t: Record<number, Row[]>) => H.map((h) => {
      const r = t[h] as Row[];
      const reg = r.filter((x) => x.regular);
      return { arm: name, cycles: h, ovHeld: +mean(r, (x) => (x.ovIn ? 1 : 0)).toFixed(3), ovWidth: +mean(r, (x) => x.ovWidth).toFixed(1),
        gradedAll: +mean(r, (x) => (x.graded ? 1 : 0)).toFixed(2), gradedRegular: +mean(reg, (x) => (x.graded ? 1 : 0)).toFixed(2),
        periodHeld: +mean(r, (x) => (x.periodIn ? 1 : 0)).toFixed(3), periodMae: +mean(r, (x) => x.periodErr).toFixed(2) };
    });
    console.table([...row('luteal between 1.1', narrowLuteal), ...row('luteal between 2.0', wideLuteal), ...row('window 12', window12)]);
  }

  it('the calendar ovulation 80% range holds the true ovulation at least 80% of the time, at every history length', () => {
    for (const table of [narrowLuteal, wideLuteal]) for (const h of H) expect(mean(table[h] as Row[], (r) => (r.ovIn ? 1 : 0))).toBeGreaterThanOrEqual(0.8);
  });
  it('period 80% ranges stay calibrated on long histories (75-95% held)', () => {
    for (const h of H) {
      const cov = mean(narrowLuteal[h] as Row[], (r) => (r.periodIn ? 1 : 0));
      expect(cov).toBeGreaterThanOrEqual(0.75);
      expect(cov).toBeLessThanOrEqual(0.95);
    }
  });
  it('regular users with a long history reach a better grade than with 12 cycles, and ovulation ranges narrow', () => {
    const reg = (t: Record<number, Row[]>) => (t[78] as Row[]).filter((r) => r.regular);
    expect(mean(reg(narrowLuteal), (r) => (r.graded ? 1 : 0))).toBeGreaterThan(mean(reg(window12), (r) => (r.graded ? 1 : 0)) + 0.1);
    expect(mean(narrowLuteal[78] as Row[], (r) => r.ovWidth)).toBeLessThan(mean(window12[78] as Row[], (r) => r.ovWidth));
  });
  it('slow drift with age: the longer window costs at most 2% period accuracy at 78 cycles', () => {
    const long = run(1.1, WINDOW_CYCLES, DRIFT_PER_CYCLE);
    const short = run(1.1, 12, DRIFT_PER_CYCLE);
    expect(mean(long[78] as Row[], (r) => r.periodErr)).toBeLessThanOrEqual(mean(short[78] as Row[], (r) => r.periodErr) * 1.02);
  }, 60_000);
});
