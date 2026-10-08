import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { detectMucusPeak } from './mucus';
import type { MucusObs } from './types';

const START = '2026-10-01';
const d = (n: number) => addDays(START, n);
const m = (n: number, quality: MucusObs['quality'], provenance: MucusObs['provenance'] = 'manual'): MucusObs => ({ date: d(n), quality, provenance });

describe('detectMucusPeak (§4.6, C-04)', () => {
  it('peak = last eggwhite/watery day before 3 days of sticky/dry; ovulation = peak, SD 1.5', () => {
    const r = detectMucusPeak([m(10, 'creamy'), m(11, 'watery'), m(12, 'eggwhite'), m(13, 'eggwhite'), m(14, 'sticky'), m(15, 'sticky'), m(16, 'dry')], START);
    expect(r?.point).toBe(d(13));
    expect(r?.offset).toBe(13);
    expect(r?.sd).toBe(1.5);
    expect(r?.basis).toBe('mucus');
    expect(r?.confidence).toBe('medium');
  });
  it('the change must persist for 3 days', () => {
    expect(detectMucusPeak([m(12, 'eggwhite'), m(13, 'eggwhite'), m(14, 'sticky'), m(15, 'sticky')], START)).toBeNull();
    expect(detectMucusPeak([m(12, 'eggwhite'), m(13, 'sticky'), m(14, 'creamy'), m(15, 'sticky'), m(16, 'sticky')], START)).toBeNull();
  });
  it('the three days must be consecutive observations', () => {
    expect(detectMucusPeak([m(13, 'eggwhite'), m(14, 'sticky'), m(16, 'sticky'), m(17, 'sticky')], START)).toBeNull();
  });
  it('with two fertile patches the last confirmed one wins', () => {
    const r = detectMucusPeak([m(6, 'eggwhite'), m(7, 'dry'), m(8, 'dry'), m(9, 'dry'), m(13, 'watery'), m(14, 'dry'), m(15, 'dry'), m(16, 'sticky')], START);
    expect(r?.point).toBe(d(13));
  });
  it('imported observations widen the SD by 2.0', () => {
    const obs = [m(13, 'eggwhite', 'imported'), m(14, 'sticky'), m(15, 'sticky'), m(16, 'sticky')];
    expect(detectMucusPeak(obs, START)?.sd).toBe(3);
  });
  it('ignores observations before the cycle start; null when no fertile mucus', () => {
    expect(detectMucusPeak([m(-5, 'eggwhite'), m(-4, 'dry'), m(-3, 'dry'), m(-2, 'dry')], START)).toBeNull();
    expect(detectMucusPeak([m(3, 'dry'), m(4, 'sticky'), m(5, 'creamy')], START)).toBeNull();
  });
});
