// P8-12 (D-091): candidate next-period models, measured against the engine in the backtests and never shipped.
// Each is built from engine exports and falls back to the engine wherever its idea does not apply.
import {
  addDays, analyzeCycles, cyclePrior, diffDays, fitLuteal, fitWeighted, lutealLengths, predict, predictiveInterval, predictiveVariance, Z80, Z95,
} from '@sanguine/engine';
import type { EngineSettings, History, Interval, ISODate, NigPosterior } from '@sanguine/engine';

export interface DateForecast { point: ISODate; i80: Interval; i95: Interval }
export type DateModel = (h: History, s: EngineSettings, today: ISODate) => DateForecast | undefined;

export const engine: DateModel = (h, s, today) => {
  const n = predict(h, s, today).nextPeriod;
  return n && { point: n.point, i80: n.i80, i95: n.i95 };
};

const around = (start: ISODate, mean: number, sd: number): DateForecast => ({
  point: addDays(start, mean),
  i80: { lo: addDays(start, mean - Z80 * sd), hi: addDays(start, mean + Z80 * sd) },
  i95: { lo: addDays(start, mean - Z95 * sd), hi: addDays(start, mean + Z95 * sd) },
});
const fromPosterior = (start: ISODate, p: NigPosterior): DateForecast => {
  const [l80, h80] = predictiveInterval(p, 0.8);
  const [l95, h95] = predictiveInterval(p, 0.95);
  return { point: addDays(start, p.m), i80: { lo: addDays(start, l80), hi: addDays(start, h80) }, i95: { lo: addDays(start, l95), hi: addDays(start, h95) } };
};
const validLengths = (h: History, s: EngineSettings) =>
  analyzeCycles(h, s).map((c) => c.record).filter((c) => c.quality === 'valid' && c.length !== undefined).map((c) => c.length as number);

/** Once a test or temperature shift has dated this cycle's ovulation: next period = ovulation + her luteal length + 1. */
export const luteal: DateModel = (h, s, today) => {
  const p = predict(h, s, today);
  if (!p.ovulation || p.ovulation.basis === 'calendar' || !p.nextPeriod) return engine(h, s, today);
  const lut = fitLuteal(lutealLengths(analyzeCycles(h, s).map((c) => c.record)));
  const open = h.cycles.reduce((a, c) => (c.start > a ? c.start : a), '');
  const ovOffset = diffDays(p.ovulation.point, open);
  return around(open, ovOffset + 1 + lut.m, Math.sqrt(predictiveVariance(lut) + p.ovulation.sd ** 2));
};

const LAMBDAS = [0.8, 0.9, 0.92, 1];
const KAPPAS = [0.5, 1, 2];
/** Per user, the recency weight and prior strength that best forecast her own past cycles (each from the cycles before it only). */
export const empiricalBayes: DateModel = (h, s, today) => {
  const base = predict(h, s, today);
  const L = validLengths(h, s);
  if (base.suspended || !base.nextPeriod || L.length < 6) return engine(h, s, today);
  const prior = (k: number) => ({ ...cyclePrior(s.birthYear, today), kappa0: k });
  const fit = (xs: number[], lambda: number, k: number) => fitWeighted(xs.slice(-s.window).map((x, i, a) => ({ x, w: lambda ** (a.length - 1 - i) })), prior(k));
  let best = { err: Number.POSITIVE_INFINITY, lambda: 1, k: prior(0.5).kappa0 };
  for (const lambda of LAMBDAS) for (const k of KAPPAS) {
    let err = 0;
    for (let j = 3; j < L.length; j++) err += Math.abs(fit(L.slice(0, j), lambda, k).m - (L[j] as number));
    if (err < best.err - 1e-9) best = { err, lambda, k };
  }
  const open = h.cycles.reduce((a, c) => (c.start > a ? c.start : a), '');
  return fromPosterior(open, fit(L, best.lambda, best.k));
};

/** Lag-1 autoregression on her valid cycles, used only with 20 or more; the interval width stays the engine's. */
export const ar1: DateModel = (h, s, today) => {
  const e = engine(h, s, today);
  const L = validLengths(h, s);
  if (!e || L.length < 20) return e;
  const m = L.reduce((a, b) => a + b, 0) / L.length;
  const num = L.slice(1).reduce((a, x, i) => a + (x - m) * ((L[i] as number) - m), 0);
  const den = L.reduce((a, x) => a + (x - m) ** 2, 0);
  const phi = den > 0 ? Math.max(-0.9, Math.min(0.9, num / den)) : 0;
  const shift = Math.round(phi * ((L.at(-1) as number) - m));
  const mv = (d: ISODate) => addDays(d, shift);
  return { point: mv(e.point), i80: { lo: mv(e.i80.lo), hi: mv(e.i80.hi) }, i95: { lo: mv(e.i95.lo), hi: mv(e.i95.hi) } };
};

/** After a marked pregnancy loss, keep the cycles from before the pregnancy (no postpartum warm-up); the pregnancy stays paused. */
export const lossKeep: DateModel = (h, s, today) =>
  engine(h, { ...s, lifeStates: s.lifeStates.filter((l) => l.kind !== 'postpartum') }, today);

export const CHALLENGERS: Record<string, DateModel> = { engine, luteal, empiricalBayes, ar1, lossKeep };

export interface Tally { n: number; mae: number; medianAe: number; cov80: number; cov95: number; width80: number }
/** Score forecasts against actual starts. */
export function tally(rows: Array<{ f: DateForecast; actual: ISODate }>): Tally {
  const n = rows.length;
  if (n === 0) return { n, mae: 0, medianAe: 0, cov80: 0, cov95: 0, width80: 0 };
  const ae = rows.map(({ f, actual }) => Math.abs(diffDays(actual, f.point))).sort((a, b) => a - b);
  const frac = (ok: (r: (typeof rows)[number]) => boolean) => rows.filter(ok).length / n;
  return {
    n, mae: ae.reduce((a, b) => a + b, 0) / n, medianAe: ae[n >> 1] as number,
    cov80: frac(({ f, actual }) => f.i80.lo <= actual && actual <= f.i80.hi),
    cov95: frac(({ f, actual }) => f.i95.lo <= actual && actual <= f.i95.hi),
    width80: rows.reduce((a, { f }) => a + diffDays(f.i80.hi, f.i80.lo), 0) / n,
  };
}
