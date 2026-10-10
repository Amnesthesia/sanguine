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
  it('a recency lambda below 1 (0.92, rejected as default in D-021) is applied through the settings below the per-user selection (D-094)', () => {
    const s: EngineSettings = { ...FIXTURE_SETTINGS, recencyLambda: 0.92 };
    const p = predict(historyFromLengths([34, 34, 28, 28, 28]), s, TODAY);
    expect(p.cycleLength.mean).toBeLessThan(predict(historyFromLengths([34, 34, 28, 28, 28]), FIXTURE_SETTINGS, TODAY).cycleLength.mean);
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

describe('ranges from her own forecast errors (D-094)', () => {
  const regular = [28, 29, 28, 28, 27, 28, 29, 28, 28, 27, 28, 29, 28, 28];
  const irregular = [24, 35, 27, 40, 22, 31, 37, 25, 33, 29, 41, 23, 30, 36];
  const halfWidth = (p: ReturnType<typeof predict>) => (Date.parse(p.nextPeriod?.i80.hi as string) - Date.parse(p.nextPeriod?.i80.lo as string)) / 864e5 / 2;
  it('a long regular history gets a range no wider than the model gives, and still at least a day either side', () => {
    const p = predict(historyFromLengths(regular), FIXTURE_SETTINGS, TODAY);
    expect(halfWidth(p)).toBeLessThanOrEqual(2);
    expect(halfWidth(p)).toBeGreaterThanOrEqual(1);
    expect((p.nextPeriod?.i80.lo as string) <= (p.nextPeriod?.point as string) && (p.nextPeriod?.point as string) <= (p.nextPeriod?.i80.hi as string)).toBe(true);
  });
  it('the 95% range contains the 80% range', () => {
    for (const L of [regular, irregular]) {
      const n = predict(historyFromLengths(L), FIXTURE_SETTINGS, TODAY).nextPeriod;
      expect((n?.i95.lo as string) <= (n?.i80.lo as string) && (n?.i80.hi as string) <= (n?.i95.hi as string)).toBe(true);
    }
  });
  it('while a life state shapes the model the range only widens', () => {
    const s: EngineSettings = { ...FIXTURE_SETTINGS, lifeStates: [{ kind: 'known_irregular', reason: 'other', since: '2020-01-01' }] };
    const narrowing = predict(historyFromLengths(regular), FIXTURE_SETTINGS, TODAY);
    const widenOnly = predict(historyFromLengths(regular), s, TODAY);
    expect(halfWidth(widenOnly)).toBeGreaterThanOrEqual(halfWidth(narrowing));
  });
});

describe('analyzeCycles', () => {
  it('returns classified cycles with derived fields and retrospective biomarker ovulation', async () => {
    const { analyzeCycles } = await import('./predict');
    const h = historyFromLengths([28, 30, 29]);
    h.lh = [
      { date: addDays(h.cycles[0]?.start as string, 12), result: 'negative', provenance: 'manual' },
      { date: addDays(h.cycles[0]?.start as string, 13), result: 'positive', provenance: 'manual' },
    ];
    const out = analyzeCycles(h, FIXTURE_SETTINGS);
    expect(out.map((c) => c.record.length)).toEqual([28, 30, 29, undefined]);
    expect(out[0]?.record.ovulation?.basis).toBe('lh');
    expect(out[0]?.record.ovulation?.offset).toBe(14);
    expect(out[1]?.record.ovulation).toBeUndefined();
  });
});
