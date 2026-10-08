import type { Model } from './models';
import { Rng } from './rng';
import { sampleCycle, sampleHistory, sampleUsers, type Population } from './synth';

export interface Score { n: number; mae: number; cov80: number; cov95: number; width80: number }
export const HORIZONS = [0, 1, 2, 3, 5, 8, 12] as const;

function score(rows: Array<[number, boolean, boolean, number]>): Score {
  const n = rows.length;
  const mean = (f: (r: [number, boolean, boolean, number]) => number) => rows.reduce((s, r) => s + f(r), 0) / n;
  return { n, mae: mean((r) => r[0]), cov80: mean((r) => (r[1] ? 1 : 0)), cov95: mean((r) => (r[2] ? 1 : 0)), width80: mean((r) => r[3]) };
}

/** Prototype protocol (§4.13): history of h cycles, target = a fresh clean draw from the same user. */
export function evaluate(models: Record<string, Model>, pop: Population, pSkip: number, users: number, seed: number): Record<string, Record<number, Score>> {
  const rng = new Rng(seed);
  const us = sampleUsers(rng, users, pop);
  const acc: Record<string, Record<number, Array<[number, boolean, boolean, number]>>> = {};
  for (const m of Object.keys(models)) acc[m] = Object.fromEntries(HORIZONS.map((h) => [h, []]));
  for (const u of us) {
    const L = sampleHistory(rng, u, 14, pop, pSkip);
    const truth = sampleCycle(rng, u.mu, u.sig, pop.pLong);
    for (const h of HORIZONS) {
      if (h > L.length) continue;
      const hist = L.slice(0, h);
      for (const [name, f] of Object.entries(models)) {
        const p = f(hist);
        (acc[name] as Record<number, Array<[number, boolean, boolean, number]>>)[h]?.push([
          Math.abs(p.point - truth), p.i80[0] <= truth && truth <= p.i80[1], p.i95[0] <= truth && truth <= p.i95[1], p.i80[1] - p.i80[0],
        ]);
      }
    }
  }
  return Object.fromEntries(Object.entries(acc).map(([m, byH]) => [m, Object.fromEntries(Object.entries(byH).map(([h, r]) => [h, score(r)]))]));
}

/** §4.15 λ acceptance: a step change of `shift` days in the user's mean after cycle 8. Score cycles 9-14 as rolling one-step forecasts. */
export function stepScenario(model: Model, pop: Population, users: number, seed: number, shift: number | null): number {
  const rng = new Rng(seed);
  const us = sampleUsers(rng, users, pop);
  let sum = 0;
  let n = 0;
  for (const u of us) {
    const L = sampleHistory(rng, u, 14, pop, 0, shift === null ? undefined : { at: 8, by: shift });
    for (let t = 8; t < 14; t++) { sum += Math.abs(model(L.slice(0, t)).point - (L[t] as number)); n++; }
  }
  return sum / n;
}

export function format(label: string, table: Record<string, Record<number, Score>>): string {
  const lines = [`\n=== ${label} ===`, `${'model'.padEnd(18)} ${'hist'.padStart(4)} ${'MAE'.padStart(6)} ${'cov80'.padStart(6)} ${'cov95'.padStart(6)} ${'w80'.padStart(6)}`];
  for (const [m, byH] of Object.entries(table))
    for (const [h, s] of Object.entries(byH)) lines.push(`${m.padEnd(18)} ${h.padStart(4)} ${s.mae.toFixed(2).padStart(6)} ${s.cov80.toFixed(2).padStart(6)} ${s.cov95.toFixed(2).padStart(6)} ${s.width80.toFixed(1).padStart(6)}`);
  return lines.join('\n');
}
