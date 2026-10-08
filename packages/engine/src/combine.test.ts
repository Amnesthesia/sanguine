import { describe, expect, it } from 'vitest';
import { combineOvulation } from './combine';
import { addDays } from './dates';
import type { OvulationEstimate } from './types';

const START = '2026-10-01';
const est = (basis: OvulationEstimate['basis'], offset: number, sd: number, extra: Partial<OvulationEstimate> = {}): OvulationEstimate => ({
  point: addDays(START, offset), offset, sd, basis, ...extra,
});
const near = (a: number | undefined, b: number, tol = 0.01) => expect(Math.abs((a as number) - b)).toBeLessThanOrEqual(tol);

describe('combineOvulation (§4.6)', () => {
  it('a single signal passes through with its basis; LH gives high confidence', () => {
    const r = combineOvulation([est('lh', 15, 1)]);
    expect(r?.point).toBe(addDays(START, 15));
    expect(r?.sd).toBe(1);
    expect(r?.basis).toBe('lh');
    expect(r?.confidence).toBe('high');
    expect(r?.conflict).toBeFalsy();
  });
  it('returns null for no signals, or only indeterminate ones', () => {
    expect(combineOvulation([])).toBeNull();
    expect(combineOvulation([est('lh', 15, 2.5, { indeterminate: true })])).toBeNull();
  });
  it('inverse-variance mean of agreeing signals; basis combined', () => {
    const r = combineOvulation([est('lh', 15, 1), est('bbt', 14, 1.5)]);
    near(r?.offset, (15 / 1 + 14 / 2.25) / (1 + 1 / 2.25));
    near(r?.sd, Math.sqrt(1 / (1 + 1 / 2.25)));
    expect(r?.basis).toBe('combined');
    expect(r?.confidence).toBe('high');
  });
  it('temperature alone is capped at medium (only LH or mucus give high)', () => {
    const r = combineOvulation([est('bbt', 14, 1.2)]);
    expect(r?.confidence).toBe('medium');
    expect(combineOvulation([est('wearable', 14, 2)])?.confidence).toBe('medium');
  });
  describe('temporal gate (fixture H, C-06)', () => {
    it('a shift more than 4 days after LH is discarded and the conflict is recorded', () => {
      const r = combineOvulation([est('lh', 15, 1), est('bbt', 22, 1.5)]);
      expect(r?.basis).toBe('lh');
      expect(r?.offset).toBe(15);
      expect(r?.sd).toBe(1);
      expect(r?.conflict).toBe(true);
    });
    it('boundaries: -1 and +4 days pass the gate, -2 and +5 are discarded', () => {
      expect(combineOvulation([est('lh', 15, 1), est('bbt', 14, 1.5)])?.basis).toBe('combined');
      expect(combineOvulation([est('lh', 15, 1), est('bbt', 18, 1.5)])?.basis).toBe('combined');
      // +4 passes the gate but the signals then differ by more than 3 days: LH alone, low confidence (both rules apply)
      const edge = combineOvulation([est('lh', 15, 1), est('bbt', 19, 1.5)]);
      expect([edge?.basis, edge?.confidence, edge?.conflict]).toEqual(['lh', 'low', true]);
      expect(combineOvulation([est('lh', 15, 1), est('bbt', 13, 1.5)])?.conflict).toBe(true);
      expect(combineOvulation([est('lh', 15, 1), est('bbt', 20, 1.5)])?.conflict).toBe(true);
    });
    it('the gate also applies against a mucus estimate, and to wearable shifts', () => {
      expect(combineOvulation([est('mucus', 14, 1.5), est('wearable', 21, 2)])?.conflict).toBe(true);
    });
    it('without LH or mucus the temperature shift is kept', () => expect(combineOvulation([est('bbt', 22, 1.5)])?.basis).toBe('bbt'));
  });
  it('only one temperature series is combined: oral wins over wearable', () => {
    const r = combineOvulation([est('lh', 15, 1), est('bbt', 16, 1.5), est('wearable', 16, 2)]);
    near(r?.offset, (15 + 16 / 2.25) / (1 + 1 / 2.25));
  });
  describe('disagreement (> 3 days)', () => {
    it('uses the single most precise signal, low confidence, conflict', () => {
      const r = combineOvulation([est('lh', 15, 1), est('mucus', 19.5, 1.5)]);
      expect(r?.basis).toBe('lh');
      expect(r?.offset).toBe(15);
      expect(r?.confidence).toBe('low');
      expect(r?.conflict).toBe(true);
    });
    it('3 days apart is still agreement', () => expect(combineOvulation([est('lh', 15, 1), est('mucus', 18, 1.5)])?.conflict).toBeFalsy());
  });
  describe('cervix weight is capped', () => {
    it('cannot pull a precise estimate: weight <= 25% of the other weights', () => {
      const r = combineOvulation([est('lh', 15, 1), est('cervix', 17, 0.5)]);
      // cervix raw weight 4, capped at 0.25 * 1
      near(r?.offset, (15 * 1 + 17 * 0.25) / 1.25);
    });
    it('alone it is not capped', () => expect(combineOvulation([est('cervix', 16, 2.5)])?.sd).toBe(2.5));
  });
  it('is order independent', () => {
    const a = [est('lh', 15, 1), est('bbt', 14, 1.5), est('mucus', 16, 1.5)];
    expect(combineOvulation([...a].reverse())).toEqual(combineOvulation(a));
  });
});
