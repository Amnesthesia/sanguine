import { describe, expect, it } from 'vitest';
import type { Prediction } from '@sanguine/engine';
import { ovulationDrawable, ovulationUncertain, shownFertileDays } from './fertileShown';

const prediction = (hi = '2026-11-14'): Prediction => ({
  engineVersion: 'test', asOf: '2026-11-03', flags: [], cycleQuality: [],
  cycleLength: { mean: 28, sd: 2, nu: 5, scale: 2, nCyclesUsed: 2 },
  ovulation: { point: '2026-11-08', i80: { lo: '2026-11-01', hi }, sd: 5, confidence: 'low', basis: 'calendar' },
  fertileDays: [{ date: '2026-11-02', pInWindow: 0.09 }, { date: '2026-11-03', pInWindow: 0.1 }, { date: '2026-11-04', pInWindow: 0.4 }],
});

describe('estimate drawing gates', () => {
  it('includeUncertain draws a wide estimate, retaining the probability floor', () => {
    const p = prediction();
    expect(shownFertileDays(p)).toEqual([]);
    expect(shownFertileDays(p, { includeUncertain: false })).toEqual([]);
    expect(shownFertileDays(p, { includeUncertain: true })).toEqual(p.fertileDays!.slice(1));
    expect(ovulationDrawable(p, false)).toBe(false);
    expect(ovulationDrawable(p, true)).toBe(true);
    expect(ovulationUncertain(p)).toBe(true);
  });
  it('a 12-day range is drawable without opting in', () => {
    const p = prediction('2026-11-13');
    expect(ovulationUncertain(p)).toBe(false);
    expect(ovulationDrawable(p, false)).toBe(true);
    expect(shownFertileDays(p)).toEqual(p.fertileDays!.slice(1));
  });
  it('missing predictions or ovulation cannot draw an ovulation mark', () => {
    const p = prediction();
    delete p.ovulation;
    delete p.fertileDays;
    for (const includeUncertain of [false, true]) {
      expect(ovulationDrawable(undefined, includeUncertain)).toBe(false);
      expect(ovulationDrawable(p, includeUncertain)).toBe(false);
      expect(shownFertileDays(undefined, { includeUncertain })).toEqual([]);
      expect(shownFertileDays(p, { includeUncertain })).toEqual([]);
    }
  });
});
