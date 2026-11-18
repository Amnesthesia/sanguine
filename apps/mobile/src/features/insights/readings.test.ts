// Plain-language readings under the Insights charts, the length summary shown when cycles vary, and the cycle timeline.
import type { CycleRecord } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { cycleTimeline, lengthReading, lengthSummary, phaseReading, tempReading } from './readings';

const c = (start: string, length: number | undefined, over: Partial<CycleRecord> = {}): CycleRecord => ({ id: start, start, quality: 'valid', ...(length ? { length } : {}), ...over });

describe('lengthSummary', () => {
  const six = [24, 38, 31, 45, 27, 36].map((n, i) => c(`2026-0${i + 1}-01`, n));
  it('lists the last cycle lengths oldest first with their range and spread', () => {
    expect(lengthSummary(six, 'low')).toEqual({ min: 24, max: 45, spread: 21, lengths: [24, 38, 31, 45, 27, 36], confidence: 'low' });
  });
  it('appears only at low confidence with three closed cycles; the open cycle does not count', () => {
    expect(lengthSummary(six, 'medium')).toBeUndefined();
    expect(lengthSummary(six, undefined)).toBeUndefined();
    expect(lengthSummary([c('2026-01-01', 30), c('2026-02-01', 40), c('2026-03-01', undefined)], 'low')).toBeUndefined();
  });
  it('keeps an excluded cycle in the list: the list shows every length, the estimate leaves it out', () => {
    const withExcluded = [c('2026-01-01', 24), c('2026-02-01', 45, { quality: 'user_excluded' }), c('2026-03-01', 31)];
    expect(lengthSummary(withExcluded, 'low')?.lengths).toEqual([24, 45, 31]);
  });
  it('caps at the six most recent', () => {
    expect(lengthSummary([...six, c('2026-07-01', 29)], 'low')?.lengths).toEqual([38, 31, 45, 27, 36, 29]);
  });
});

describe('lengthReading', () => {
  it('names one length when they all match, else the range', () => {
    expect(lengthReading([28, 28, 28])).toEqual({ key: 'same', n: 3, len: 28 });
    expect(lengthReading([27, 29, 28])).toEqual({ key: 'range', n: 3, min: 27, max: 29 });
  });
});

describe('tempReading', () => {
  it('says the last three readings are above or below the coverline, else nothing', () => {
    expect(tempReading([36.3, 36.4, 36.6, 36.7, 36.6], 36.5)).toBe('above');
    expect(tempReading([36.6, 36.7, 36.4, 36.3, 36.2], 36.5)).toBe('below');
    expect(tempReading([36.3, 36.6, 36.4], 36.5)).toBeUndefined();
    expect(tempReading([36.6, 36.7, 36.6], undefined)).toBeUndefined();
  });
});

describe('phaseReading', () => {
  it('names the single phase with the highest share, nothing on a tie or when none', () => {
    expect(phaseReading({ menstrual: 0.75, follicular: 0, luteal: 0.25 })).toBe('menstrual');
    expect(phaseReading({ menstrual: 0.25, follicular: 0.25, luteal: 0 })).toBeUndefined();
    expect(phaseReading({ menstrual: 0, follicular: 0, luteal: 0 })).toBeUndefined();
  });
});

describe('cycleTimeline', () => {
  const rec = c('2026-10-03', 28, { end: '2026-10-06', nextStart: '2026-10-31' });
  const lh = [{ date: '2026-10-13', result: 'positive' as const }, { date: '2026-11-02', result: 'positive' as const }];
  it('lists start, bleeding, first positive LH test, temperature rise and next period in order', () => {
    expect(cycleTimeline(rec, lh, '2026-10-18', true).map((e) => e.kind)).toEqual(['started', 'bleeding', 'lh', 'rise', 'next']);
    expect(cycleTimeline(rec, lh, '2026-10-18', true).find((e) => e.kind === 'lh')?.from).toBe('2026-10-13');
  });
  it('drops the fertility rows when the gate is off, and rows without data', () => {
    expect(cycleTimeline(rec, lh, '2026-10-18', false).map((e) => e.kind)).toEqual(['started', 'bleeding', 'next']);
    expect(cycleTimeline(c('2026-10-31', undefined), [], undefined, true).map((e) => e.kind)).toEqual(['started']);
  });
});
