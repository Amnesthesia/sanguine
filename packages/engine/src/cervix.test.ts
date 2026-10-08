import { describe, expect, it } from 'vitest';
import { detectCervixPeak } from './cervix';
import { addDays } from './dates';
import type { CervixObs } from './types';

const START = '2026-10-01';
const d = (n: number) => addDays(START, n);
const fertile = (n: number): CervixObs => ({ date: d(n), position: 'high', firmness: 'soft', opening: 'open' });
const closed = (n: number): CervixObs => ({ date: d(n), position: 'low', firmness: 'firm', opening: 'closed' });

describe('detectCervixPeak (§4.6, V-07)', () => {
  it('high/soft/open for >= 2 days then low/firm/closed: ovulation = last high day, SD 2.5', () => {
    const r = detectCervixPeak([fertile(11), fertile(12), fertile(13), closed(14)], START);
    expect(r?.point).toBe(d(13));
    expect(r?.sd).toBe(2.5);
    expect(r?.basis).toBe('cervix');
    expect(r?.confidence).toBe('medium');
  });
  it('a single high day is not enough', () => expect(detectCervixPeak([fertile(13), closed(14)], START)).toBeNull());
  it('needs the closed observation afterwards, within 3 days of the last high day', () => {
    expect(detectCervixPeak([fertile(12), fertile(13)], START)).toBeNull();
    expect(detectCervixPeak([fertile(12), fertile(13), closed(17)], START)).toBeNull();
    expect(detectCervixPeak([fertile(12), fertile(13), closed(16)], START)?.point).toBe(d(13));
  });
  it('partially open or medium firmness does not count as fertile', () => {
    const half: CervixObs = { date: d(13), position: 'high', firmness: 'soft', opening: 'partial' };
    expect(detectCervixPeak([fertile(12), half, closed(14)], START)).toBeNull();
  });
  it('returns null on no observations', () => expect(detectCervixPeak([], START)).toBeNull());
});
