// PLAN.md §4.3: Normal-Inverse-Gamma cycle-length model with a population prior.
import {
  AGE_BAND_MEANS, CONFORMAL_MIN_ERRORS, CONFORMAL_MIN_HALFWIDTH, CONFORMAL_MIN_HISTORY, CONFORMAL_WINDOW, CYCLE_PRIOR_ALPHA0,
  CYCLE_PRIOR_BETA0, CYCLE_PRIOR_KAPPA0, POPULATION_MEAN, RECENCY_KAPPA0_GRID, RECENCY_LAMBDA_GRID, RECENCY_SELECT_MIN_CYCLES, WINDOW_CYCLES,
} from './params';
import { studentTQuantile } from './studentT';
import type { NigPosterior, NigPrior } from './types';

/** Population prior; age-banded mean when the birth year is known (Bull 2019 Table 2). */
export function cyclePrior(birthYear?: number, today?: number | string, opts: { varianceScale?: number } = {}): NigPrior {
  let m0 = POPULATION_MEAN;
  if (birthYear !== undefined && today !== undefined) {
    const year = typeof today === 'number' ? today : Number(today.slice(0, 4));
    const age = year - birthYear;
    // Bull 2019 bands start at 18; under 18 (teen mode, §8.6) the population mean applies
    if (age >= 18) m0 = AGE_BAND_MEANS.find((b) => age <= b.maxAge)?.mean ?? POPULATION_MEAN;
  }
  return { m0, kappa0: CYCLE_PRIOR_KAPPA0, alpha0: CYCLE_PRIOR_ALPHA0, beta0: CYCLE_PRIOR_BETA0 * (opts.varianceScale ?? 1) };
}

/** Posterior from weighted observations (conjugate update, §4.3). */
export function fitWeighted(obs: Array<{ x: number; w: number }>, prior: NigPrior): NigPosterior {
  const W = obs.reduce((s, o) => s + o.w, 0);
  if (obs.length === 0 || W === 0) {
    return { m: prior.m0, kappa: prior.kappa0, alpha: prior.alpha0, beta: prior.beta0, weight: 0, n: 0 };
  }
  const xbar = obs.reduce((s, o) => s + o.w * o.x, 0) / W;
  const S = obs.reduce((s, o) => s + o.w * (o.x - xbar) ** 2, 0);
  const kappa = prior.kappa0 + W;
  return {
    m: (prior.kappa0 * prior.m0 + W * xbar) / kappa,
    kappa,
    alpha: prior.alpha0 + W / 2,
    beta: prior.beta0 + S / 2 + (prior.kappa0 * W * (xbar - prior.m0) ** 2) / (2 * kappa),
    weight: W,
    n: obs.length,
  };
}

/** `lengths` oldest first. Weight of the i-th of n is lambda^(n-1-i); only the last `window` are used. */
export function fitCycleLength(lengths: number[], prior: NigPrior, lambda: number, window: number = WINDOW_CYCLES): NigPosterior {
  const used = lengths.slice(-window);
  const n = used.length;
  return fitWeighted(used.map((x, i) => ({ x, w: lambda ** (n - 1 - i) })), prior);
}

/** Scale of the Student-t predictive distribution for the next observation. */
export function predictiveScale(p: NigPosterior): number {
  return Math.sqrt((p.beta * (p.kappa + 1)) / (p.alpha * p.kappa));
}
/** Variance of the predictive Student-t (needs nu > 2, always true since alpha0 >= 2.5). */
export function predictiveVariance(p: NigPosterior): number {
  const nu = 2 * p.alpha;
  return (predictiveScale(p) ** 2 * nu) / (nu - 2);
}

/** Central predictive interval in the model's own unit (days). */
export function predictiveInterval(p: NigPosterior, level: 0.8 | 0.95): [number, number] {
  const q = studentTQuantile(0.5 + level / 2, 2 * p.alpha);
  const s = predictiveScale(p);
  return [p.m - q * s, p.m + q * s];
}

export interface Recency { lambda: number; kappa0: number }

/** D-094: the recency weight (at most `maxLambda`) and prior strength that best forecast her own kept cycles, each from the
 *  cycles before it only. `lengths` oldest first. Ties keep the earlier grid entry, so the defaults win a tie. */
export function selectRecency(lengths: number[], prior: NigPrior, maxLambda: number, window: number = WINDOW_CYCLES): Recency {
  const lambdas = RECENCY_LAMBDA_GRID.filter((l) => l <= maxLambda);
  const fallback = { lambda: maxLambda, kappa0: prior.kappa0 };
  if (lengths.length < RECENCY_SELECT_MIN_CYCLES || lambdas.length === 0) return fallback;
  let best = { err: Number.POSITIVE_INFINITY, ...fallback };
  for (const lambda of lambdas) for (const kappa0 of RECENCY_KAPPA0_GRID) {
    let err = 0;
    for (let j = CONFORMAL_MIN_HISTORY; j < lengths.length; j++)
      err += Math.abs(fitCycleLength(lengths.slice(0, j), { ...prior, kappa0 }, lambda, window).m - (lengths[j] as number));
    if (err < best.err - 1e-9) best = { err, lambda, kappa0 };
  }
  return { lambda: best.lambda, kappa0: best.kappa0 };
}

/** D-094: split-conformal half-widths from her own one-step forecast errors on the last CONFORMAL_WINDOW kept cycles, each
 *  forecast as the engine would have made it then (recency chosen from the cycles before it). Undefined until there are
 *  CONFORMAL_MIN_ERRORS errors. */
export function conformalHalfWidths(lengths: number[], prior: NigPrior, maxLambda: number, window: number = WINDOW_CYCLES): { q80: number; q95: number } | undefined {
  const errs: number[] = [];
  for (let j = Math.max(CONFORMAL_MIN_HISTORY, lengths.length - CONFORMAL_WINDOW); j < lengths.length; j++) {
    const past = lengths.slice(0, j);
    const r = selectRecency(past, prior, maxLambda, window);
    errs.push(Math.abs(fitCycleLength(past, { ...prior, kappa0: r.kappa0 }, r.lambda, window).m - (lengths[j] as number)));
  }
  if (errs.length < CONFORMAL_MIN_ERRORS) return undefined;
  errs.sort((a, b) => a - b);
  // conformal quantile with the finite-sample correction
  const q = (level: number) => Math.max(CONFORMAL_MIN_HALFWIDTH, errs[Math.min(errs.length - 1, Math.ceil((errs.length + 1) * level) - 1)] as number);
  return { q80: q(0.8), q95: q(0.95) };
}
