import { describe, expect, it } from 'vitest';
import { dueRangeText, pregnancyModel } from './pregnancyModel';

describe('pregnancyModel (P8-5)', () => {
  it('counts from the last period start before the pregnancy, due range 37 to 42 weeks', () => {
    expect(pregnancyModel({ since: '2026-09-01', cycleStarts: ['2026-07-14', '2026-08-11'], today: '2026-10-10' }))
      .toEqual({ week: 8, day: 4, from: 'period', due: { lo: '2027-04-27', hi: '2027-06-01' } });
  });
  it('a due date the user entered wins over the period start', () => {
    expect(pregnancyModel({ since: '2026-09-01', cycleStarts: ['2026-08-11'], dueDate: '2027-05-25', today: '2026-10-10' }))
      .toEqual({ week: 7, day: 4, from: 'due', due: { lo: '2027-05-04', hi: '2027-06-08' } });
  });
  it('a period start after the pregnancy began is not used', () => {
    expect(pregnancyModel({ since: '2026-09-01', cycleStarts: ['2026-09-20'], today: '2026-10-10' })).toBeUndefined();
  });
  it('without a period start or a due date there is no week count', () => {
    expect(pregnancyModel({ since: '2026-09-01', cycleStarts: [], today: '2026-10-10' })).toBeUndefined();
  });
  it('a count outside 0 to 44 weeks is not shown (stale or mistyped dates)', () => {
    expect(pregnancyModel({ since: '2025-01-01', cycleStarts: ['2024-12-01'], today: '2026-10-10' })).toBeUndefined();
    expect(pregnancyModel({ since: '2026-09-01', cycleStarts: [], dueDate: '2027-09-01', today: '2026-10-10' })).toBeUndefined();
  });
});

describe('dueRangeText (the due date range carries the year when it is not this year)', () => {
  it('this year: no year', () => expect(dueRangeText({ lo: '2026-12-02', hi: '2026-12-20' }, '2026-11-02')).toBe('2–20 Dec'));
  it('next year: the year once, after the range', () => expect(dueRangeText({ lo: '2027-05-31', hi: '2027-07-05' }, '2026-11-02')).toBe('31 May – 5 Jul 2027'));
  it('across new year: a year on each end', () => expect(dueRangeText({ lo: '2026-12-20', hi: '2027-01-14' }, '2026-11-02')).toBe('20 Dec 2026 – 14 Jan 2027'));
});
