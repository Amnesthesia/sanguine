import { describe, expect, it } from 'vitest';
import { cyclePrior, fitCycleLength, fitWeighted, predictiveInterval, predictiveScale } from './cycleLength';
import { CYCLE_PRIOR_BETA0 } from './params';
import { LUTEAL_PRIOR } from './params';

const P = cyclePrior();
const close = (a: number, b: number, tol = 0.05) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('cyclePrior', () => {
  it('population prior when age unknown', () => expect(P).toEqual({ m0: 29.3, kappa0: 0.5, alpha0: 2.5, beta0: CYCLE_PRIOR_BETA0 }));
  it('beta0 = alpha0 * 2.6^2 = 16.9', () => close(P.beta0, 16.9, 1e-9));
  it('age bands (Bull 2019 Table 2)', () => {
    const m = (age: number) => cyclePrior(2026 - age, 2026).m0;
    expect([m(20), m(24), m(25), m(29), m(30), m(34), m(35), m(37), m(39), m(40), m(45)]).toEqual([30.3, 30.3, 29.9, 29.9, 29.2, 29.2, 28.2, 28.2, 28.2, 27.4, 27.4]);
    expect(m(50)).toBe(29.3); // outside the published bands: population mean
    expect(m(16)).toBe(29.3);
  });
  it('perimenopause doubles the variance prior', () => close(cyclePrior(undefined, undefined, { varianceScale: 2 }).beta0, 33.8, 1e-9));
});

describe('fitCycleLength (PLAN.md §4.12, lambda = 1)', () => {
  it('A: 28, 30, 29', () => {
    const p = fitCycleLength([28, 30, 29], P, 1);
    close(p.m, 29.04);
    expect(2 * p.alpha).toBe(8);
    close(predictiveScale(p), 2.4);
    const [lo, hi] = predictiveInterval(p, 0.8);
    close(lo, 25.7, 0.06);
    close(hi, 32.4, 0.06);
    expect(p.n).toBe(3);
  });
  it('B (56 removed): 27, 29, 28, 30, 28', () => {
    const p = fitCycleLength([27, 29, 28, 30, 28], P, 1);
    close(p.m, 28.48);
    expect(2 * p.alpha).toBe(10);
    close(predictiveScale(p), 2.16);
    const [lo, hi] = predictiveInterval(p, 0.8);
    close(lo, 25.5, 0.06);
    close(hi, 31.4, 0.06);
  });
  it('C: no data, age 37', () => {
    const p = fitCycleLength([], cyclePrior(1989, 2026), 1);
    close(p.m, 28.2);
    expect(2 * p.alpha).toBe(5);
    close(predictiveScale(p), 4.5);
    const [lo, hi] = predictiveInterval(p, 0.8);
    close(lo, 21.6, 0.06);
    close(hi, 34.8, 0.06);
  });
  it('D: 24, 38, 31, 45, 27, 36', () => {
    const p = fitCycleLength([24, 38, 31, 45, 27, 36], P, 1);
    close(p.m, 33.18);
    expect(2 * p.alpha).toBe(11);
    close(predictiveScale(p), 5.97);
    const [lo, hi] = predictiveInterval(p, 0.8);
    close(lo, 25.0, 0.06);
    close(hi, 41.3, 0.06);
  });
  it('E: single 31-day cycle gets two thirds of the weight', () => {
    const p = fitCycleLength([31], P, 1);
    close(p.m, 30.43);
    expect(2 * p.alpha).toBe(6);
    close(predictiveScale(p), 3.11);
  });
  it('F: luteal prior with 11, 12, 12', () => {
    const p = fitCycleLength([11, 12, 12], LUTEAL_PRIOR, 1);
    close(p.m, 12.23);
    expect(2 * p.alpha).toBe(13);
    close(predictiveScale(p), 2.22);
  });
});

describe('recency weighting', () => {
  it('lambda < 1 weights recent cycles more', () => {
    const lengths = [34, 34, 34, 28, 28, 28];
    expect(fitCycleLength(lengths, P, 0.92).m).toBeLessThan(fitCycleLength(lengths, P, 1).m);
  });
  it('weights sum to sum of lambda^k', () => {
    const p = fitCycleLength([29, 29, 29], P, 0.92);
    close(p.weight, 1 + 0.92 + 0.92 ** 2, 1e-12);
    close(2 * p.alpha, 5 + p.weight, 1e-12);
  });
  it('window keeps only the last N cycles', () => {
    const lengths = [40, 40, 28, 28, 28];
    const w3 = fitCycleLength(lengths, P, 1, 3);
    expect(w3.n).toBe(3);
    expect(w3.m).toBeCloseTo(fitCycleLength([28, 28, 28], P, 1).m, 12);
  });
  it('a usual-length observation of weight 0.5 is blended, not trusted', () => {
    const p = fitWeighted([{ x: 35, w: 0.5 }], P);
    expect(p.m).toBeGreaterThan(29.3);
    expect(p.m).toBeLessThan(35);
    close(p.weight, 0.5, 1e-12);
  });
});

describe('predictiveInterval', () => {
  it('95% contains 80% and both contain the mean', () => {
    const p = fitCycleLength([28, 31, 29, 33], P, 0.92);
    const [a, b] = predictiveInterval(p, 0.8);
    const [c, d] = predictiveInterval(p, 0.95);
    expect(c).toBeLessThan(a);
    expect(d).toBeGreaterThan(b);
    expect(a).toBeLessThan(p.m);
    expect(b).toBeGreaterThan(p.m);
  });
});
