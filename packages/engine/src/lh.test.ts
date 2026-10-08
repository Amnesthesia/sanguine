import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { detectLhSurge } from './lh';
import type { LhTest } from './types';

const START = '2026-10-01';
const d = (n: number) => addDays(START, n);
const t = (n: number, result: LhTest['result'], provenance: LhTest['provenance'] = 'manual'): LhTest => ({ date: d(n), result, provenance });

describe('detectLhSurge (§4.6, C-03)', () => {
  it('negative then positive: ovulation = positive day + 1, SD 1.0 (fixture G)', () => {
    const r = detectLhSurge([t(13, 'negative'), t(14, 'positive')], START);
    expect(r?.point).toBe(d(15));
    expect(r?.offset).toBe(15);
    expect(r?.sd).toBe(1);
    expect(r?.basis).toBe('lh');
    expect(r?.confidence).toBe('high');
    expect(r?.indeterminate).toBeUndefined();
  });
  it('a peak result counts as positive', () => expect(detectLhSurge([t(12, 'negative'), t(13, 'peak')], START)?.point).toBe(d(14)));
  it('high and indeterminate results are not a surge', () => expect(detectLhSurge([t(12, 'high'), t(13, 'indeterminate'), t(14, 'negative')], START)).toBeNull());
  it('no negative within the 2 days before: SD 1.5', () => {
    expect(detectLhSurge([t(14, 'positive')], START)?.sd).toBe(1.5);
    expect(detectLhSurge([t(9, 'negative'), t(14, 'positive')], START)?.sd).toBe(1.5);
    expect(detectLhSurge([t(12, 'negative'), t(14, 'positive')], START)?.sd).toBe(1);
    expect(detectLhSurge([t(13, 'negative'), t(14, 'positive')], START)?.sd).toBe(1);
  });
  it('uses the first positive; a run of up to 3 positives is a normal surge', () => {
    const r = detectLhSurge([t(13, 'negative'), t(14, 'positive'), t(15, 'positive'), t(16, 'positive'), t(17, 'negative')], START);
    expect(r?.point).toBe(d(15));
    expect(r?.sd).toBe(1);
  });
  it('positives for more than 3 days are indeterminate: SD 2.5, no override', () => {
    const r = detectLhSurge([t(13, 'negative'), t(14, 'positive'), t(15, 'positive'), t(16, 'positive'), t(17, 'positive')], START);
    expect(r?.sd).toBe(2.5);
    expect(r?.indeterminate).toBe(true);
    expect(r?.confidence).toBe('low');
  });
  it('ignores tests before the cycle start and is order independent', () => {
    const tests = [t(14, 'positive'), t(13, 'negative'), t(-3, 'positive')];
    expect(detectLhSurge(tests, START)?.point).toBe(d(15));
  });
  it('imported tests widen the SD by 1.5', () => expect(detectLhSurge([t(13, 'negative', 'imported'), t(14, 'positive', 'imported')], START)?.sd).toBe(1.5));
  it('returns null with no positive', () => expect(detectLhSurge([t(13, 'negative')], START)).toBeNull());
});
