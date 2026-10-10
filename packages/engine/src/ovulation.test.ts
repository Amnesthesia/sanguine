import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { cyclePrior, fitCycleLength } from './cycleLength';
import { LAST_START } from './fixtures';
import { fertileDayProbabilities } from './fertile';
import { confidenceGrade, fitLuteal, lutealLengths, ovulationInterval } from './ovulation';
import { calendarOvulation } from './ovulation';
import type { CycleRecord } from './types';

const P = cyclePrior();
const cyc = (l: number[], prior = P) => fitCycleLength(l, prior, 1);
const near = (a: number | undefined, b: number, tol = 0.05) => expect(Math.abs((a as number) - b)).toBeLessThanOrEqual(tol);

describe('lutealLengths', () => {
  it('nextStart - ovulation - 1, only for cycles with a biomarker ovulation', () => {
    const cycles: CycleRecord[] = [
      { id: 'a', start: '2026-01-01', nextStart: '2026-01-29', length: 28, quality: 'valid', ovulation: { point: '2026-01-17', sd: 1, basis: 'lh' } },
      { id: 'b', start: '2026-01-29', nextStart: '2026-02-28', length: 30, quality: 'valid' },
      { id: 'c', start: '2026-02-28', nextStart: '2026-03-29', length: 29, quality: 'valid', ovulation: { point: '2026-03-12', sd: 1, basis: 'bbt' } },
    ];
    expect(lutealLengths(cycles)).toEqual([11, 16]);
  });
  it('ignores calendar-basis estimates (they would be circular) and non-valid cycles', () => {
    const cycles: CycleRecord[] = [
      { id: 'a', start: '2026-01-01', nextStart: '2026-01-29', length: 28, quality: 'valid', ovulation: { point: '2026-01-15', sd: 3, basis: 'calendar' } },
      { id: 'b', start: '2026-01-29', nextStart: '2026-02-28', length: 30, quality: 'life_state', ovulation: { point: '2026-02-12', sd: 1, basis: 'lh' } },
    ];
    expect(lutealLengths(cycles)).toEqual([]);
  });
});

describe('calendarOvulation (§4.5)', () => {
  it('round trip: a luteal length measured by lutealLengths gives back the ovulation day it came from (D-098)', () => {
    // 28-day cycles, ovulation on offset 14 -> luteal 28 - 14 - 1 = 13; the estimate must land on 14, not 15
    const cycles: CycleRecord[] = Array.from({ length: 60 }, (_, k) => ({
      id: `c${k}`, start: addDays(LAST_START, 28 * k), nextStart: addDays(LAST_START, 28 * (k + 1)), length: 28, quality: 'valid' as const,
      ovulation: { point: addDays(LAST_START, 28 * k + 14), sd: 1, basis: 'lh' as const },
    }));
    const o = calendarOvulation(cyc(Array(60).fill(28)), fitLuteal(lutealLengths(cycles)), LAST_START);
    near(o.offset, 14, 0.4); // the cycle and luteal priors shrink it a little; the -1 slip was a whole day
  });
  it('A: day 15.64, SD 3.95 (D-098)', () => {
    const o = calendarOvulation(cyc([28, 30, 29]), fitLuteal([]), LAST_START);
    near(o.offset, 15.64);
    near(o.sd, 3.95);
    expect(o.point).toBe(addDays(LAST_START, 16));
    expect(o.basis).toBe('calendar');
    expect(o.confidence).toBe('low');
  });
  it('F: luteal update moves ovulation to 15.81, SD 3.68', () => {
    const o = calendarOvulation(cyc([28, 30, 29]), fitLuteal([11, 12, 12]), LAST_START);
    near(o.offset, 15.81);
    near(o.sd, 3.68, 0.06);
  });
  it('B/C/D formula values (D-015)', () => {
    near(calendarOvulation(cyc([27, 29, 28, 30, 28]), fitLuteal([]), LAST_START).sd, 3.71);
    near(calendarOvulation(cyc([], cyclePrior(1989, 2026)), fitLuteal([]), LAST_START).sd, 6.46);
    near(calendarOvulation(cyc([24, 38, 31, 45, 27, 36]), fitLuteal([]), LAST_START).sd, 7.17);
  });
});

describe('confidenceGrade (§4.8)', () => {
  it('thresholds', () => {
    expect(confidenceGrade(1.0)).toBe('high');
    expect(confidenceGrade(1.5)).toBe('high');
    expect(confidenceGrade(1.51)).toBe('medium');
    expect(confidenceGrade(3)).toBe('medium');
    expect(confidenceGrade(3.01)).toBe('low');
  });
});

describe('ovulationInterval', () => {
  it('80% = offset +/- 1.2816 SD rounded to dates (A: day 11 to day 21)', () => {
    const o = calendarOvulation(cyc([28, 30, 29]), fitLuteal([]), LAST_START);
    expect(ovulationInterval(o, LAST_START)).toEqual({ lo: addDays(LAST_START, 11), hi: addDays(LAST_START, 21) });
  });
});

describe('fertileDayProbabilities (§4.8)', () => {
  const o = calendarOvulation(cyc([28, 30, 29]), fitLuteal([]), LAST_START);
  const rows = fertileDayProbabilities(o, LAST_START, 40);
  const at = (d: number) => rows.find((r) => r.date === addDays(LAST_START, d))?.pInWindow;
  it('matches the plan table for fixture A', () => {
    for (const [d, p] of Object.entries({ 7: 0.2, 9: 0.35, 11: 0.49, 13: 0.55, 15: 0.5, 17: 0.37, 19: 0.22, 21: 0.11 })) near(at(Number(d)), p, 0.01);
  });
  it('is a graded band: peaks mid-window and is never a single day', () => {
    const above = rows.filter((r) => r.pInWindow >= 0.2).length;
    expect(above).toBeGreaterThanOrEqual(10);
    expect(Math.max(...rows.map((r) => r.pInWindow))).toBeLessThan(0.6);
  });
  it('a precise estimate (LH: day 15, SD 1) is >= 0.93 on days 11 to 14 and 0.69 at the ends', () => {
    const lh = { point: addDays(LAST_START, 15), offset: 15, sd: 1, basis: 'lh' as const };
    const r = fertileDayProbabilities(lh, LAST_START, 40);
    const p = (d: number) => r.find((x) => x.date === addDays(LAST_START, d))?.pInWindow;
    for (const d of [11, 12, 13, 14]) expect(p(d)).toBeGreaterThanOrEqual(0.93);
    near(p(10), 0.6915, 0.001);
    near(p(15), 0.6915, 0.001);
  });
  it('uses the rounded point when no fractional offset is supplied', () => {
    const r = fertileDayProbabilities({ point: addDays(LAST_START, 15), sd: 1, basis: 'lh' }, LAST_START, 40);
    near(r.find((x) => x.date === addDays(LAST_START, 12))?.pInWindow, 0.9936, 0.001);
  });
  it('drops negligible probabilities, stays in the horizon and is ordered', () => {
    expect(rows.every((r) => r.pInWindow >= 0.01)).toBe(true);
    expect(rows.map((r) => r.date)).toEqual([...rows.map((r) => r.date)].sort());
    expect(rows.every((r) => r.date >= LAST_START && r.date <= addDays(LAST_START, 40))).toBe(true);
  });
  it('probabilities are in [0, 1]', () => expect(rows.every((r) => r.pInWindow > 0 && r.pInWindow <= 1)).toBe(true));
});
