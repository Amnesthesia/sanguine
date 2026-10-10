// P8-12 (D-091): small learned models for the next period, measured against the engine and never shipped.
// Deterministic: closed-form ridge regression, and a tiny neural network trained with a seeded RNG. All work on the cycles
// the engine keeps (its outlier rules stay in front) and predict the next length's deviation from her mean.
import { addDays, analyzeCycles, diffDays } from '@sanguine/engine';
import type { EngineSettings, History, ISODate } from '@sanguine/engine';
import { type DateForecast, type DateModel, engine } from './challengers';
import { EVENTS, historyFrom, timeline } from './events';
import { Rng } from './rng';
import { sampleUsers, WIDE } from './synth';

const POP_MEAN = 29.3;
const openStart = (h: History) => h.cycles.reduce((a, c) => (c.start > a ? c.start : a), '');
export const keptLengths = (h: History, s: EngineSettings) =>
  analyzeCycles(h, s).map((c) => c.record).filter((c) => c.quality === 'valid' && c.length !== undefined).map((c) => c.length as number);

/** Features from her kept cycle lengths (oldest first): deviations of the last three from her mean, her spread, 1/n. */
export function features(L: number[]): { x: number[]; mean: number } {
  const n = L.length;
  const mean = n ? L.reduce((a, b) => a + b, 0) / n : POP_MEAN;
  const sd = n > 1 ? Math.sqrt(L.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 3;
  const lag = (k: number) => (n >= k ? (L[n - k] as number) - mean : 0);
  return { x: [1, lag(1), lag(2), lag(3), sd / 5, 1 / (n + 1)], mean };
}

/** Ridge regression, closed form: (X'X + lambda I) w = X'y, the intercept not penalised. */
export function ridge(X: number[][], y: number[], lambda: number): number[] {
  const d = (X[0] ?? []).length;
  const A = Array.from({ length: d }, (_, i) => Array.from({ length: d + 1 }, (_, j) =>
    j === d ? X.reduce((s, r, k) => s + (r[i] as number) * (y[k] as number), 0)
      : X.reduce((s, r) => s + (r[i] as number) * (r[j] as number), 0) + (i === j && i > 0 ? lambda : 0)));
  for (let c = 0; c < d; c++) { // Gauss-Jordan with partial pivoting
    let p = c;
    for (let r = c + 1; r < d; r++) if (Math.abs((A[r] as number[])[c] as number) > Math.abs((A[p] as number[])[c] as number)) p = r;
    [A[c], A[p]] = [A[p] as number[], A[c] as number[]];
    const piv = (A[c] as number[])[c] as number;
    if (Math.abs(piv) < 1e-12) continue;
    for (let r = 0; r < d; r++) {
      if (r === c) continue;
      const f = ((A[r] as number[])[c] as number) / piv;
      for (let j = c; j <= d; j++) (A[r] as number[])[j] = ((A[r] as number[])[j] as number) - f * ((A[c] as number[])[j] as number);
    }
  }
  return A.map((r, i) => { const piv = r[i] as number; return Math.abs(piv) < 1e-12 ? 0 : (r[d] as number) / piv; });
}
const dot = (w: number[], x: number[]) => w.reduce((s, v, i) => s + v * (x[i] as number), 0);

/** Tiny network 6 -> 8 tanh -> 1, trained by SGD on squared error. */
export class Mlp {
  w1: number[][]; b1: number[]; w2: number[]; b2 = 0;
  constructor(rng: Rng, private readonly hidden = 8) {
    this.w1 = Array.from({ length: hidden }, () => Array.from({ length: 6 }, () => rng.normal(0, 0.3)));
    this.b1 = Array(hidden).fill(0);
    this.w2 = Array.from({ length: hidden }, () => rng.normal(0, 0.3));
  }
  forward(x: number[]): { h: number[]; y: number } {
    const h = this.w1.map((w, i) => Math.tanh(dot(w, x) + (this.b1[i] as number)));
    return { h, y: dot(this.w2, h) + this.b2 };
  }
  train(X: number[][], y: number[], rng: Rng, epochs = 30, lr = 0.01): void {
    const idx = X.map((_, i) => i);
    for (let e = 0; e < epochs; e++) {
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng.random() * (i + 1)); [idx[i], idx[j]] = [idx[j] as number, idx[i] as number]; }
      for (const k of idx) {
        const x = X[k] as number[];
        const { h, y: out } = this.forward(x);
        const g = out - (y[k] as number);
        for (let i = 0; i < this.hidden; i++) {
          const gh = g * (this.w2[i] as number) * (1 - (h[i] as number) ** 2);
          this.w2[i] = (this.w2[i] as number) - lr * g * (h[i] as number);
          this.b1[i] = (this.b1[i] as number) - lr * gh;
          const row = this.w1[i] as number[];
          for (let j = 0; j < row.length; j++) row[j] = (row[j] as number) - lr * gh * (x[j] as number);
        }
        this.b2 -= lr * g;
      }
    }
  }
}

const BASE: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };
const TARGET_CLIP = 12; // a skipped log or a long cycle should not dominate squared error

/** Training rows from seeded synthetic users with every kind of event (a different seed from any evaluation). */
export function trainingSet(seed: number, users: number): { X: number[][]; y: number[] } {
  const rng = new Rng(seed);
  const X: number[][] = [];
  const y: number[] = [];
  sampleUsers(rng, users, WIDE).forEach((u, i) => {
    const t = timeline(rng, u, 14, EVENTS[i % EVENTS.length] as (typeof EVENTS)[number]);
    for (let k = 3; k < t.observed.length; k++) {
      const today = t.observed[k - 1] as ISODate;
      const L = keptLengths(historyFrom(t.observed, today), BASE);
      const { x, mean } = features(L);
      X.push(x);
      y.push(Math.max(-TARGET_CLIP, Math.min(TARGET_CLIP, diffDays(t.observed[k] as ISODate, today) - mean)));
    }
  });
  return { X, y };
}

/** A point model centred on its own point, with the engine's interval width. */
function withEngineWidth(e: DateForecast | undefined, h: History, point: number): DateForecast | undefined {
  if (!e) return e;
  const start = openStart(h);
  const shift = Math.round(point) - diffDays(e.point, start);
  const mv = (d: ISODate) => addDays(d, shift);
  return { point: mv(e.point), i80: { lo: mv(e.i80.lo), hi: mv(e.i80.hi) }, i95: { lo: mv(e.i95.lo), hi: mv(e.i95.hi) } };
}

export interface Trained { popRidge: number[]; mlp: Mlp }
export function train(seed = 424242, users = 1200): Trained {
  const { X, y } = trainingSet(seed, users);
  const mlp = new Mlp(new Rng(seed + 1));
  mlp.train(X, y, new Rng(seed + 2));
  return { popRidge: ridge(X, y, 1), mlp };
}

/** The learned models as DateModels. Each falls back to the engine while estimates are paused or history is short. */
export function mlModels(t: Trained): Record<string, DateModel> {
  const guard = (f: (h: History, s: EngineSettings, today: ISODate, L: number[], e: DateForecast) => DateForecast | undefined): DateModel =>
    (h, s, today) => {
      const e = engine(h, s, today);
      if (!e) return e;
      const L = keptLengths(h, s);
      return L.length < 3 ? e : f(h, s, today, L, e);
    };
  const point = (L: number[], w: (x: number[]) => number) => { const { x, mean } = features(L); return mean + w(x); };

  return {
    /** ridge trained on her own past cycles only (each target from the cycles before it); needs 8 */
    userRidge: guard((h, _s, _t, L, e) => {
      if (L.length < 8) return e;
      const X: number[][] = [];
      const y: number[] = [];
      for (let j = 3; j < L.length; j++) { const { x, mean } = features(L.slice(0, j)); X.push(x); y.push((L[j] as number) - mean); }
      const w = ridge(X, y, 5);
      return withEngineWidth(e, h, point(L, (x) => dot(w, x)));
    }),
    /** ridge trained once on the synthetic population */
    popRidge: guard((h, _s, _t, L, e) => withEngineWidth(e, h, point(L, (x) => dot(t.popRidge, x)))),
    /** tiny network trained once on the synthetic population */
    mlp: guard((h, _s, _t, L, e) => withEngineWidth(e, h, point(L, (x) => t.mlp.forward(x).y))),
    /** combination: the mean of the engine's point and the network's */
    engineMlp: guard((h, _s, _t, L, e) => {
      const start = openStart(h);
      return withEngineWidth(e, h, (diffDays(e.point, start) + point(L, (x) => t.mlp.forward(x).y)) / 2);
    }),
    /** combination: the engine's point with an interval from her own past forecast errors (split-conformal), once she has 8 */
    conformal: guard((h, s, today, _L, e) => {
      const starts = h.cycles.map((c) => c.start).filter((d) => d <= today).sort();
      // calibrate only on cycles the engine keeps: a skipped log or a pregnancy is not forecast error to plan for
      const kept = new Set(analyzeCycles(h, s).filter((c) => c.record.quality === 'valid' && c.record.nextStart).map((c) => c.record.nextStart));
      const errs: number[] = [];
      for (let k = Math.max(3, starts.length - 13); k < starts.length; k++) {
        if (!kept.has(starts[k] as ISODate)) continue;
        const past = { ...h, cycles: h.cycles.filter((c) => c.start < (starts[k] as ISODate)) };
        const f = engine(past, s, starts[k - 1] as ISODate);
        if (f) errs.push(diffDays(starts[k] as ISODate, f.point));
      }
      if (errs.length < 8) return e;
      const abs = errs.map(Math.abs).sort((a, b) => a - b);
      // conformal quantile with finite-sample correction, never narrower than +/-1 day
      const q = (level: number) => Math.max(1, abs[Math.min(abs.length - 1, Math.ceil((abs.length + 1) * level) - 1)] as number);
      const p = e.point;
      return { point: p, i80: { lo: addDays(p, -q(0.8)), hi: addDays(p, q(0.8)) }, i95: { lo: addDays(p, -q(0.95)), hi: addDays(p, q(0.95)) } };
    }),
  };
}

