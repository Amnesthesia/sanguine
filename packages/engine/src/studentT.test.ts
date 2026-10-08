import { describe, expect, it } from 'vitest';
import { normalCdf, studentTCdf, studentTQuantile } from './studentT';

// SciPy 1.x: scipy.stats.t.ppf(p, nu)
const SCIPY: Array<[number, number, number]> = [
  [5, 0.9, 1.475884048824481], [5, 0.975, 2.5705818356363146],
  [6, 0.9, 1.4397557472651485], [6, 0.975, 2.446911851144979],
  [8, 0.9, 1.396815309743865], [8, 0.975, 2.306004135204166],
  [10, 0.9, 1.372183641110336], [10, 0.975, 2.228138851986274],
  [11, 0.9, 1.3634303180205405], [11, 0.975, 2.2009851600916384],
  [13, 0.9, 1.3501712887800552], [13, 0.975, 2.1603686564627913],
  // non-integer and extreme nu (the posterior has nu = 2*alpha_n with fractional weights)
  [7, 0.95, 1.8945786050900058], [3, 0.6, 0.2766706623326898], [2.5, 0.995, 7.163728138948783],
  [4.5, 0.9, 1.5008853175085572], [20, 0.975, 2.0859634472658644], [100, 0.9, 1.290074761346516],
  [13.5, 0.9, 1.3475008774730548], [5, 0.1, -1.4758840488244809],
];

describe('studentTQuantile', () => {
  for (const [nu, p, expected] of SCIPY)
    it(`nu=${nu} p=${p}`, () => expect(studentTQuantile(p, nu)).toBeCloseTo(expected, 8));
  it('is 0 at p = 0.5', () => expect(studentTQuantile(0.5, 7)).toBe(0));
  it('is antisymmetric', () => expect(studentTQuantile(0.2, 9)).toBeCloseTo(-studentTQuantile(0.8, 9), 12));
  it('rejects p outside (0,1) and nu <= 0', () => {
    expect(() => studentTQuantile(0, 5)).toThrow();
    expect(() => studentTQuantile(1, 5)).toThrow();
    expect(() => studentTQuantile(0.9, 0)).toThrow();
    expect(() => studentTQuantile(Number.NaN, 5)).toThrow();
  });
  it('cdf inverts quantile', () => {
    for (const nu of [1.5, 5, 11.25, 40]) for (const p of [0.01, 0.2, 0.5, 0.8, 0.99])
      expect(studentTCdf(studentTQuantile(p, nu), nu)).toBeCloseTo(p, 10);
  });
});

describe('normalCdf', () => {
  it('known values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 12);
    expect(normalCdf(1.959963984540054)).toBeCloseTo(0.975, 9);
    expect(normalCdf(-1)).toBeCloseTo(0.15865525393145707, 10);
  });
});
