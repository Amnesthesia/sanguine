// Port of tools/backtest/proto.py: synthetic users and cycle histories from Bull et al. 2019 distributions.
import type { Rng } from './rng';

export interface Population { betweenSd: number; pLong: number }
export const WIDE: Population = { betweenSd: 4.5, pLong: 0.04 };
export const TIGHT: Population = { betweenSd: 3.6, pLong: 0.03 };
const POP_MEAN = 29.3;
const USER_SD_MEAN = 2.6;
const USER_SD_SD = 2.5;

export interface User { mu: number; sig: number }

export function sampleUsers(rng: Rng, n: number, pop: Population): User[] {
  const s2 = Math.log(1 + (USER_SD_SD / USER_SD_MEAN) ** 2);
  return Array.from({ length: n }, () => ({
    mu: rng.normal(POP_MEAN, pop.betweenSd),
    sig: Math.min(9, Math.max(0.8, rng.lognormal(Math.log(USER_SD_MEAN) - s2 / 2, Math.sqrt(s2)))),
  }));
}

const clip = (x: number) => Math.min(90, Math.max(15, Math.round(x)));

/** One cycle length from the physiological process (with sporadic late ovulation). */
export function sampleCycle(rng: Rng, mu: number, sig: number, pLong: number): number {
  let l = rng.normal(mu, sig);
  if (rng.random() < pLong) l += rng.uniform(8, 25);
  return clip(l);
}

/** Observed history; with `pSkip` a missed log merges two cycles into one. */
export function sampleHistory(rng: Rng, u: User, n: number, pop: Population, pSkip = 0, shiftAfter?: { at: number; by: number }): number[] {
  const raw = Array.from({ length: n }, (_, i) => sampleCycle(rng, u.mu + (shiftAfter && i >= shiftAfter.at ? shiftAfter.by : 0), u.sig, pop.pLong));
  if (pSkip <= 0) return raw;
  const out: number[] = [];
  for (let i = 0; i < n; ) {
    if (rng.random() < pSkip && i + 1 < n) { out.push((raw[i] as number) + (raw[i + 1] as number)); i += 2; } else { out.push(raw[i] as number); i++; }
  }
  return out;
}

/** Luteal spreads for ovulation ground truth (D-161). Within a woman: SD 1.7 d (Henry 2024: median within-woman variance
 *  3.0 d²), weakly tied to that cycle's length (corr 0.15, implied by Henry's cycle, follicular and luteal variances).
 *  Between women: the SD of each woman's own mean, 1.1 d (Henry 2024: overall 4.3 d² minus within 3.0 d²) or 2.0 d (older
 *  Fertil Steril figure, 4.0 d²); population mean 12.4 d (Bull 2019). */
export const LUTEAL_WITHIN_SD = 1.7;
const LUTEAL_LENGTH_CORR = 0.15;

/** Cycle lengths and, per cycle, the true ovulation offset from its start (length - luteal - 1, as `lutealLengths` measures). */
export function sampleOvulationHistory(rng: Rng, u: User, n: number, pop: Population, lutealBetweenSd: number, driftPerCycle = 0): { lengths: number[]; ovulation: number[] } {
  const own = Math.min(17, Math.max(8, rng.normal(12.4, lutealBetweenSd)));
  const lengths: number[] = [];
  const ovulation: number[] = [];
  for (let i = 0; i < n; i++) {
    const l = sampleCycle(rng, u.mu + driftPerCycle * i, u.sig, pop.pLong);
    const z = Math.max(-3, Math.min(3, (l - u.mu - driftPerCycle * i) / u.sig));
    const lut = Math.round(own + LUTEAL_WITHIN_SD * (LUTEAL_LENGTH_CORR * z + Math.sqrt(1 - LUTEAL_LENGTH_CORR ** 2) * rng.normal()));
    lengths.push(l);
    ovulation.push(l - Math.min(Math.max(6, lut), l - 8) - 1); // at least 7 follicular days
  }
  return { lengths, ovulation };
}
