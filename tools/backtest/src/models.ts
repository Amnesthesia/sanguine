// Models A-C from the prototype and the engine itself. Each returns a point and 80% / 95% intervals in days.
import { cyclePrior, fitCycleLength, predict, predictiveInterval, studentTQuantile } from '@sanguine/engine';
import type { CycleRecord, EngineSettings, History } from '@sanguine/engine';

export interface Forecast { point: number; i80: [number, number]; i95: [number, number] }
export type Model = (hist: number[]) => Forecast;
const POP_MEAN = 29.3;
const POP_SD = 5.2;

export const naive: Model = (h) => {
  const p = h.length ? (h.at(-1) as number) : 28;
  return { point: p, i80: [p - 2, p + 2], i95: [p - 4, p + 4] };
};

export const ewma: Model = (hist, k = 6, decay = 0.75) => {
  let p = POP_MEAN;
  let sd = POP_SD;
  if (hist.length > 0) {
    const h = hist.slice(-k);
    const w = h.map((_, i) => decay ** (h.length - 1 - i));
    const ws = w.reduce((a, b) => a + b, 0);
    p = h.reduce((s, x, i) => s + (w[i] as number) * x, 0) / ws;
    sd = h.length >= 2 ? Math.max(Math.sqrt(h.reduce((s, x, i) => s + (w[i] as number) * (x - p) ** 2, 0) / ws), 2.0) : 4.0;
  }
  return { point: p, i80: [p - 1.2816 * sd, p + 1.2816 * sd], i95: [p - 1.96 * sd, p + 1.96 * sd] };
};

const intervals = (post: ReturnType<typeof fitCycleLength>): Forecast => ({
  point: post.m, i80: predictiveInterval(post, 0.8), i95: predictiveInterval(post, 0.95),
});

/** C: Bayesian NIG with the population prior, unweighted. */
export const bayes: Model = (h) => intervals(fitCycleLength(h, cyclePrior(), 1, 999));

// ---- the real engine ----
const START = '2026-01-01';
function historyFor(lengths: number[]): History {
  const t0 = Date.UTC(2026, 0, 1);
  let t = t0;
  const cycles: CycleRecord[] = [{ id: 'c1', start: START, quality: 'valid' }];
  lengths.forEach((l, i) => {
    t += l * 86_400_000;
    cycles.push({ id: `c${i + 2}`, start: new Date(t).toISOString().slice(0, 10), quality: 'valid' });
  });
  return { cycles, temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
}

/** The shipped engine: robust exclusion + NIG, with a given recency lambda. */
export function engineModel(lambda: number): Model {
  const settings: EngineSettings = { lifeStates: [], recencyLambda: lambda, window: 12 };
  return (lengths) => {
    const h = historyFor(lengths);
    const today = h.cycles.at(-1)?.start as string;
    const { cycleLength: c } = predict(h, settings, today);
    const q80 = studentTQuantile(0.9, c.nu) * c.scale;
    const q95 = studentTQuantile(0.975, c.nu) * c.scale;
    return { point: c.mean, i80: [c.mean - q80, c.mean + q80], i95: [c.mean - q95, c.mean + q95] };
  };
}
