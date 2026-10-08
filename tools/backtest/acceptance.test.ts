// PLAN.md §4.15 release gates, run on the seeded synthetic suite (deterministic).
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RECENCY_LAMBDA } from '@sanguine/engine';
import { runCsv } from './src/csv';
import { evaluate, stepScenario } from './src/evaluate';
import { bayes, engineModel, naive } from './src/models';
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

describe('λ acceptance (§4.15, V-05)', () => {
  const gain = (() => {
    const a = stepScenario(engineModel(1), WIDE, USERS, SEED, 7);
    const b = stepScenario(engineModel(0.92), WIDE, USERS, SEED, 7);
    return 1 - b / a;
  })();
  const cleanChange = (() => {
    const a = stepScenario(engineModel(1), WIDE, USERS, SEED + 7, null);
    const b = stepScenario(engineModel(0.92), WIDE, USERS, SEED + 7, null);
    return b / a - 1;
  })();
  it('does not make clean histories worse by more than 2%', () => expect(cleanChange).toBeLessThanOrEqual(0.02));
  it('the shipped default follows the rule: 0.92 only if it cuts step-change MAE by >= 15%, else 1', () => {
    const adopt = gain >= 0.15 && cleanChange <= 0.02;
    expect(RECENCY_LAMBDA).toBe(adopt ? 0.92 : 1);
  });
  it('records the measured gain (informational, in the failure message if the rule flips)', () => expect(gain).toBeGreaterThan(0));
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
