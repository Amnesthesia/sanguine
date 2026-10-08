// Golden fixtures A-I (PLAN.md §4.12). Tolerance 0.05 d on every number.
// Each fixture is `it.fails` until its IMPLEMENTED flag flips; a flipped flag with a red test is a real failure.
// Plan figures that do not follow the plan's own equations are recorded in docs/DECISIONS.md (D-015) and the
// formula value is asserted, with the plan figure in a comment.
import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { emptyHistory, FIXTURE_SETTINGS, historyFromLengths, IMPLEMENTED, LAST_START, TODAY } from './fixtures';
import { fitCycleLength, predictiveInterval } from './cycleLength';
import { LUTEAL_PRIOR } from './params';
import { predict } from './predict';
import type { EngineSettings, History, ISODate, Prediction } from './types';

const TOL = 0.05;
const near = (actual: number | undefined, expected: number, tol = TOL) => {
  expect(actual, 'value present').toBeDefined();
  expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(tol);
};
const day = (offset: number): ISODate => addDays(LAST_START, offset);
// FIXTURES_STRICT=1 runs every fixture as a normal test, to see the real failures.
const fixture = (k: keyof typeof IMPLEMENTED) => (IMPLEMENTED[k] || process.env.FIXTURES_STRICT ? it : it.fails);

function expectNextPeriod(p: Prediction, point: ISODate, lo: ISODate, hi: ISODate) {
  expect(p.nextPeriod?.point).toBe(point);
  expect(p.nextPeriod?.i80).toEqual({ lo, hi });
}
function expectCycleLength(p: Prediction, mean: number, nu: number, scale: number, n: number) {
  near(p.cycleLength.mean, mean);
  expect(p.cycleLength.nu).toBeCloseTo(nu, 6);
  near(p.cycleLength.scale, scale);
  expect(p.cycleLength.nCyclesUsed).toBe(n);
}
function expectFertile(p: Prediction, expected: Record<number, number>) {
  for (const [d, v] of Object.entries(expected)) {
    const row = p.fertileDays?.find((r) => r.date === day(Number(d)));
    expect(row, `fertile row for day ${d}`).toBeDefined();
    near(row?.pInWindow, v, 0.01);
  }
}

describe('Fixture A: regular, 3 cycles (28, 30, 29)', () => {
  const run = () => predict(historyFromLengths([28, 30, 29]), FIXTURE_SETTINGS, TODAY);
  fixture('A')('cycle-length posterior and next period', () => {
    const p = run();
    expectCycleLength(p, 29.04, 8, 2.4, 3);
    expectNextPeriod(p, '2026-10-30', '2026-10-27', '2026-11-02');
    expect(p.cycleQuality.map((c) => c.quality)).toEqual(['valid', 'valid', 'valid', 'valid']);
    expect(p.flags).toEqual([]);
  });
  fixture('A')('calendar ovulation: day 16.6, SD 3.95, 80% day 12-22, low confidence', () => {
    const o = run().ovulation;
    expect(o?.point).toBe(day(17)); // round(16.64)
    near(o?.sd, 3.95);
    expect(o?.i80).toEqual({ lo: day(12), hi: day(22) });
    expect(o?.confidence).toBe('low');
    expect(o?.basis).toBe('calendar');
  });
  fixture('A')('fertile-day probabilities (plan table)', () => {
    expectFertile(run(), { 8: 0.2, 10: 0.35, 12: 0.49, 14: 0.55, 16: 0.5, 18: 0.37, 20: 0.22, 22: 0.11 });
  });
  fixture('A')('current phase on 10 Oct is day 10 of the cycle', () => {
    expect(run().currentPhase?.dayOfCycle).toBe(10);
  });
});

describe('Fixture B: one skipped log, 6 cycles (27, 29, 56, 28, 30, 28)', () => {
  const run = () => predict(historyFromLengths([27, 29, 56, 28, 30, 28]), FIXTURE_SETTINGS, TODAY);
  fixture('B')('56 is suspect_skip and excluded from the model', () => {
    const p = run();
    expect(p.cycleQuality.find((c) => c.cycleId === 'c3')?.quality).toBe('suspect_skip');
    expect(p.cycleQuality.filter((c) => c.quality !== 'valid').map((c) => c.cycleId)).toEqual(['c3']);
    expectCycleLength(p, 28.48, 10, 2.16, 5);
    expectNextPeriod(p, '2026-10-29', '2026-10-27', '2026-11-01');
  });
  fixture('B')('ovulation day 16.1; plan SD 3.9 is 3.71 by §4.5 (D-015); fertile band', () => {
    const p = run();
    expect(p.ovulation?.point).toBe(day(16));
    near(p.ovulation?.sd, 3.71);
    expect(p.ovulation?.confidence).toBe('low');
    expectFertile(p, { 8: 0.2327, 10: 0.3997, 12: 0.5408, 14: 0.5788, 16: 0.4905, 18: 0.3283, 20: 0.1727, 22: 0.0708 });
  });
  fixture('B')('a probable missed log raises no health flag', () => expect(run().flags).toEqual([]));
});

describe('Fixture C: cold start, age 37, last period date only', () => {
  const settings: EngineSettings = { ...FIXTURE_SETTINGS, birthYear: 1989 };
  const hist = (): History => ({ ...emptyHistory(), cycles: [{ id: 'c1', start: LAST_START, quality: 'valid' }] });
  fixture('C')('prior-only posterior', () => {
    const p = predict(hist(), settings, TODAY);
    expectCycleLength(p, 28.2, 5, 4.5, 0);
    expectNextPeriod(p, '2026-10-29', '2026-10-23', '2026-11-05');
  });
  fixture('C')('ovulation day 15.8, low confidence; plan SD 5.4 is 6.46 by §4.5 (D-015); fertile band', () => {
    const p = predict(hist(), settings, TODAY);
    expect(p.ovulation?.point).toBe(day(16));
    near(p.ovulation?.sd, 6.46);
    expect(p.ovulation?.confidence).toBe('low');
    expectFertile(p, { 8: 0.2615, 10: 0.3168, 12: 0.351, 14: 0.3557, 16: 0.3298, 18: 0.2796, 20: 0.2168, 22: 0.1537 });
  });
  fixture('C')('no last period at all: nothing predicted', () => {
    const p = predict(emptyHistory(), settings, TODAY);
    expect(p.nextPeriod).toBeUndefined();
    expect(p.ovulation).toBeUndefined();
    expect(p.currentPhase).toBeUndefined();
  });
});

describe('Fixture D: irregular, 6 cycles (24, 38, 31, 45, 27, 36)', () => {
  const run = () => predict(historyFromLengths([24, 38, 31, 45, 27, 36]), FIXTURE_SETTINGS, TODAY);
  fixture('D')('all valid (threshold 58); posterior and next period', () => {
    const p = run();
    expect(p.cycleQuality.every((c) => c.quality === 'valid')).toBe(true);
    expectCycleLength(p, 33.18, 11, 5.97, 6);
    expectNextPeriod(p, '2026-11-03', '2026-10-26', '2026-11-11');
  });
  fixture('D')('high-variability flag fires with a 21-day range', () => {
    const f = run().flags;
    expect(f.map((x) => x.code)).toEqual(['variability']);
    expect(f[0]?.params.range).toBe(21);
  });
  fixture('D')('ovulation day 20.8, low; plan SD 7.0 is 7.17 by §4.5 (D-015); fertile band', () => {
    const p = run();
    expect(p.ovulation?.point).toBe(day(21));
    near(p.ovulation?.sd, 7.17);
    expect(p.ovulation?.confidence).toBe('low');
    expectFertile(p, { 8: 0.1231, 10: 0.173, 12: 0.2259, 14: 0.2742, 16: 0.3092, 18: 0.324, 20: 0.3156, 22: 0.2856 });
  });
});

describe('Fixture E: single cycle (31)', () => {
  const run = () => predict(historyFromLengths([31]), FIXTURE_SETTINGS, TODAY);
  fixture('E')('posterior blends with the prior; next period 31 Oct (plan says 1 Nov, D-015)', () => {
    const p = run();
    expectCycleLength(p, 30.43, 6, 3.11, 1);
    expectNextPeriod(p, '2026-10-31', '2026-10-27', '2026-11-05');
  });
  fixture('E')('no ovulation estimate after one cycle (plan shows a dash)', () => {
    const p = run();
    expect(p.ovulation).toBeUndefined();
    expect(p.fertileDays).toBeUndefined();
  });
});

describe('Fixture F: luteal update (11, 12, 12)', () => {
  fixture('F')('luteal posterior: mean 12.23, nu 13, scale 2.22, 80% 9.2-15.2', () => {
    const post = fitCycleLength([11, 12, 12], LUTEAL_PRIOR, 1);
    near(post.m, 12.23);
    expect(2 * post.alpha).toBeCloseTo(13, 6);
    near(Math.sqrt((post.beta * (post.kappa + 1)) / (post.alpha * post.kappa)), 2.22);
    const [lo, hi] = predictiveInterval(post, 0.8);
    near(lo, 9.2, 0.06);
    near(hi, 15.2, 0.06);
  });
  fixture('F')('ovulation day 16.8; plan SD 3.6 is 3.68 by §4.5 (D-015)', () => {
    // luteal length = nextStart - ovulation - 1 (days after ovulation up to the day before the next period)
    const h = historyFromLengths([28, 30, 29]);
    const luteals = [11, 12, 12];
    h.cycles.slice(0, 3).forEach((c, i) => {
      const len = [28, 30, 29][i] as number;
      c.ovulation = { point: addDays(c.start, len - 1 - (luteals[i] as number)), sd: 1, basis: 'lh' };
    });
    const p = predict(h, FIXTURE_SETTINGS, TODAY);
    expect(p.ovulation?.point).toBe(day(17)); // round(16.81)
    near(p.ovulation?.sd, 3.68, 0.06);
  });
});

describe('Fixture G: LH override (negative day 13, positive day 14)', () => {
  const run = () => {
    const h = historyFromLengths([28, 30, 29]);
    h.lh = [
      { date: day(13), result: 'negative', provenance: 'manual' },
      { date: day(14), result: 'positive', provenance: 'manual' },
    ];
    return predict(h, FIXTURE_SETTINGS, day(20));
  };
  fixture('G')('ovulation day 15, SD 1.0, high confidence, basis lh', () => {
    const o = run().ovulation;
    expect(o?.point).toBe(day(15));
    near(o?.sd, 1.0);
    expect(o?.confidence).toBe('high');
    expect(o?.basis).toBe('lh');
  });
  fixture('G')('fertile band: p >= 0.8 on days 11-14 (plan says 10-15; 0.69 at both ends, D-015)', () => {
    const p = run();
    for (const d of [11, 12, 13, 14]) expect(p.fertileDays?.find((r) => r.date === day(d))?.pInWindow).toBeGreaterThanOrEqual(0.8);
    expectFertile(p, { 9: 0.3085, 10: 0.6915, 11: 0.9332, 12: 0.9936, 13: 0.9936, 14: 0.9332, 15: 0.6915, 16: 0.3085 });
  });
});

describe('Fixture H: conflicting signals (LH day 14, BBT shift first high day 23)', () => {
  const run = () => {
    const h = historyFromLengths([28, 30, 29]);
    h.lh = [
      { date: day(12), result: 'negative', provenance: 'manual' },
      { date: day(13), result: 'negative', provenance: 'manual' },
      { date: day(14), result: 'positive', provenance: 'manual' },
    ];
    const wiggle = [0, 0.04, -0.03, 0.02, -0.04, 0.03, -0.02];
    for (let d = 0; d <= 26; d++)
      h.temperatures.push({
        date: day(d), valueC: d < 23 ? 36.3 + (wiggle[d % 7] as number) : 36.65, timeOfDay: '06:30', source: 'oral', provenance: 'manual',
      });
    return predict(h, FIXTURE_SETTINGS, day(26));
  };
  fixture('H')('shift 8 days after LH is discarded; ovulation day 15, SD 1.0, conflict recorded', () => {
    const p = run();
    expect(p.ovulation?.point).toBe(day(15));
    near(p.ovulation?.sd, 1.0);
    expect(p.ovulation?.basis).toBe('lh');
    expect(p.cycleQuality.find((c) => c.cycleId === 'c4')?.conflict).toBe(true);
  });
});

describe('Fixture I: combined pill from 1 Oct', () => {
  const run = () => {
    const h = historyFromLengths([28, 30, 29]);
    h.logs = [0, 1, 2, 3].map((d) => ({ date: day(d), flow: 'medium' as const, flowKind: 'withdrawal_bleed' as const }));
    const settings: EngineSettings = {
      ...FIXTURE_SETTINGS,
      lifeStates: [{ kind: 'hormonal_contraception', method: 'combined_pill', since: LAST_START }],
    };
    return predict(h, settings, TODAY);
  };
  fixture('I')('prediction suspended: no period, ovulation, fertile band or phase', () => {
    const p = run();
    expect(p.suspended?.reason).toBeTruthy();
    expect(p.nextPeriod).toBeUndefined();
    expect(p.ovulation).toBeUndefined();
    expect(p.fertileDays).toBeUndefined();
    expect(p.currentPhase).toBeUndefined();
    expect(p.flags).toEqual([]);
  });
  fixture('I')('the cycle overlapping the life state is marked life_state', () => {
    expect(run().cycleQuality.find((c) => c.cycleId === 'c4')?.quality).toBe('life_state');
  });
});

describe('fixture plumbing', () => {
  it('historyFromLengths builds the expected starts', () => {
    const h = historyFromLengths([28, 30, 29]);
    expect(h.cycles.map((c) => c.start)).toEqual([addDays(LAST_START, -87), addDays(LAST_START, -59), addDays(LAST_START, -29), LAST_START]);
  });
});
