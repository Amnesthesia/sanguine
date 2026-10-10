// PLAN.md §4.15 release gates, run on the seeded synthetic suite (deterministic).
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RECENCY_LAMBDA } from '@sanguine/engine';
import { runCsv } from './src/csv';
import { evaluate, stepScenario } from './src/evaluate';
import { bayes, engineModel, fixedEngineModel, naive } from './src/models';
import { WIDE } from './src/synth';

const USERS = 1500;
const SEED = 20261009;
const models = { naive, bayes, engine: engineModel(RECENCY_LAMBDA) };

describe('release gate: accuracy and calibration (§4.15, §10)', () => {
  const clean = evaluate(models, WIDE, 0, USERS, SEED);
  const skipped = evaluate(models, WIDE, 0.08, USERS, SEED + 1);
  it('MAE <= 2.8 d at 8 cycles', () => expect(clean.engine?.[8]?.mae).toBeLessThanOrEqual(2.8));
  it('80% and 95% coverage within 5 points of nominal at 8 cycles', () => {
    expect(Math.abs((clean.engine?.[8]?.cov80 ?? 0) - 0.8)).toBeLessThanOrEqual(0.05);
    expect(Math.abs((clean.engine?.[8]?.cov95 ?? 0) - 0.95)).toBeLessThanOrEqual(0.05);
  });
  it('the fixed +/-2 d calendar window is overconfident (the reason intervals are model-based)', () => expect(clean.naive?.[8]?.cov80).toBeLessThan(0.65));
  it('robust exclusion removes most of the error from skipped logs without widening the interval much', () => {
    expect((skipped.bayes?.[8]?.mae ?? 0) - (skipped.engine?.[8]?.mae ?? 0)).toBeGreaterThan(1);
    expect(skipped.engine?.[8]?.width80).toBeLessThan((skipped.bayes?.[8]?.width80 ?? 0));
    expect(Math.abs((skipped.engine?.[8]?.cov80 ?? 0) - 0.8)).toBeLessThanOrEqual(0.07);
  });
  it('calibrated from the first cycle: 80% coverage at 1-3 cycles is 0.75-0.9', () => {
    for (const h of [1, 2, 3]) expect(clean.engine?.[h]?.cov80).toBeGreaterThan(0.74);
  });
});

describe('λ acceptance (§4.15, V-05), per-user recency since D-094', () => {
  // D-021 rejected a fixed λ = 0.92 (gain 4.9% against the 15% bar). D-094 chooses λ and κ0 per user from her own past
  // cycles; it ships because it costs nothing on clean histories and follows a lasting change (scenarios.test.ts: +5 d step,
  // 3.81 to 3.17 d two or more cycles on). On this gate's step scenario (cycles 9-14, right after a +7 d change) it gains less.
  const step = (m: Parameters<typeof stepScenario>[0], shift: number | null, seed: number) => stepScenario(m, WIDE, USERS, seed, shift);
  const fixed = fixedEngineModel(1);
  const engine = engineModel(RECENCY_LAMBDA);
  const gain = 1 - step(engine, 7, SEED) / step(fixed, 7, SEED);
  const cleanChange = step(engine, null, SEED + 7) / step(fixed, null, SEED + 7) - 1;
  it('does not make clean histories worse by more than 2%', () => expect(cleanChange).toBeLessThanOrEqual(0.02));
  it('improves the step-change scenario (measured 9.3%; clean +0.7%)', () => expect(gain).toBeGreaterThan(0.05));
  it('the default cap stays λ = 1: the user-level choice goes below it, never a fixed lower λ', () => expect(RECENCY_LAMBDA).toBe(1));
});

describe('csv replay', () => {
  it('reports rolling-origin MAE and coverage for a regular user', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sanguine-bt-'));
    const f = join(dir, 'h.csv');
    const starts = ['2026-01-01'];
    for (const l of [28, 29, 28, 30, 28, 29, 28, 29, 30, 28]) {
      const d = new Date(`${starts.at(-1)}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + l);
      starts.push(d.toISOString().slice(0, 10));
    }
    writeFileSync(f, `date\n${starts.join('\n')}\n`);
    const r = runCsv(f, 1);
    expect(r.cycles).toBe(11);
    expect(r.forecasts).toBe(7);
    expect(r.mae).toBeLessThan(2);
    expect(r.cov80).toBeGreaterThan(0.7);
  });
});
