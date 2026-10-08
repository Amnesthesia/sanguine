import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { FIXTURE_SETTINGS, historyFromLengths, LAST_START, TODAY } from './fixtures';
import { predict } from './predict';
import { ENGINE_VERSION } from './params';
import type { EngineSettings } from './types';

const A = () => historyFromLengths([28, 30, 29]);

describe('predict', () => {
  it('is deterministic and does not mutate its inputs', () => {
    const h = A();
    const before = JSON.stringify([h, FIXTURE_SETTINGS]);
    const a = predict(h, FIXTURE_SETTINGS, TODAY);
    expect(JSON.stringify(predict(h, FIXTURE_SETTINGS, TODAY))).toBe(JSON.stringify(a));
    expect(JSON.stringify([h, FIXTURE_SETTINGS])).toBe(before);
    expect(a.engineVersion).toBe(ENGINE_VERSION);
    expect(a.asOf).toBe(TODAY);
  });
  it('next-period confidence: low with < 2 cycles, medium for a regular 3-cycle user, high needs 6 tight cycles', () => {
    expect(predict(historyFromLengths([31]), FIXTURE_SETTINGS, TODAY).nextPeriod?.confidence).toBe('low');
    expect(predict(A(), FIXTURE_SETTINGS, TODAY).nextPeriod?.confidence).toBe('medium');
    expect(predict(historyFromLengths([28, 28, 29, 28, 28, 29]), FIXTURE_SETTINGS, TODAY).nextPeriod?.confidence).toBe('high');
    expect(predict(historyFromLengths([24, 38, 31, 45, 27, 36]), FIXTURE_SETTINGS, TODAY).nextPeriod?.confidence).toBe('low');
  });
  it('daysOfDataUsed is the total length of the cycles in the model', () =>
    expect(predict(A(), FIXTURE_SETTINGS, TODAY).nextPeriod?.daysOfDataUsed).toBe(87));
  it('the 95% interval contains the 80% interval contains the point', () => {
    const n = predict(A(), FIXTURE_SETTINGS, TODAY).nextPeriod;
    expect(n && n.i95.lo <= n.i80.lo && n.i80.lo <= n.point && n.point <= n.i80.hi && n.i80.hi <= n.i95.hi).toBe(true);
  });
  it('phase follows the cycle: menstrual, follicular, ovulatory, luteal, late', () => {
    const phase = (d: number) => predict(A(), FIXTURE_SETTINGS, addDays(LAST_START, d)).currentPhase?.phase;
    expect([phase(2), phase(9), phase(17), phase(24), phase(45)]).toEqual(['menstrual', 'follicular', 'ovulatory', 'luteal', 'late']);
  });
  it('the default recency lambda 0.92 is applied through the settings', () => {
    const s: EngineSettings = { ...FIXTURE_SETTINGS, recencyLambda: 0.92 };
    const p = predict(historyFromLengths([34, 34, 34, 28, 28, 28]), s, TODAY);
    expect(p.cycleLength.mean).toBeLessThan(predict(historyFromLengths([34, 34, 34, 28, 28, 28]), FIXTURE_SETTINGS, TODAY).cycleLength.mean);
  });
  it('a usual cycle length counts as one half-weight observation, not truth', () => {
    const none = predict(historyFromLengths([]), FIXTURE_SETTINGS, TODAY).cycleLength;
    const usual = predict(historyFromLengths([]), { ...FIXTURE_SETTINGS, usualCycleLength: 35 }, TODAY).cycleLength;
    expect(usual.mean).toBeGreaterThan(none.mean);
    expect(usual.mean).toBeLessThan(35);
  });
  it('known-irregular and perimenopause states cap or widen as specified', () => {
    const irregular: EngineSettings = { ...FIXTURE_SETTINGS, lifeStates: [{ kind: 'known_irregular', reason: 'other', since: '2020-01-01' }] };
    expect(predict(historyFromLengths([28, 28, 29, 28, 28, 29]), irregular, TODAY).nextPeriod?.confidence).toBe('medium');
    const peri: EngineSettings = { ...FIXTURE_SETTINGS, lifeStates: [{ kind: 'perimenopause', since: '2020-01-01' }] };
    const p = predict(A(), peri, TODAY);
    expect(p.ovulation).toBeUndefined(); // biomarker-only band
    expect(p.fertileDays).toBeUndefined();
    expect(p.cycleLength.scale).toBeGreaterThan(predict(A(), FIXTURE_SETTINGS, TODAY).cycleLength.scale);
  });
  it('the cycle quality list reports every cycle with reasons for the excluded one', () => {
    const q = predict(historyFromLengths([27, 29, 56, 28, 30, 28]), FIXTURE_SETTINGS, TODAY).cycleQuality;
    expect(q).toHaveLength(7);
    expect(q[2]?.reason).toBeTruthy();
  });
});
