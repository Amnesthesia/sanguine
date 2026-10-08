import { describe, expect, it } from 'vitest';
import { addDays, diffDays, isoWeekday, parseISO } from './dates';

describe('dates', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-01', 29)).toBe('2026-10-30');
    expect(addDays('2026-10-01', 31)).toBe('2026-11-01');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-10-10', -9)).toBe('2026-10-01');
  });
  it('diffs days', () => {
    expect(diffDays('2026-10-10', '2026-10-01')).toBe(9);
    expect(diffDays('2026-10-01', '2026-10-10')).toBe(-9);
    expect(diffDays('2027-01-01', '2026-01-01')).toBe(365);
  });
  it('parses strictly', () => {
    expect(() => parseISO('2026-13-01')).toThrow();
    expect(() => parseISO('2026-02-30')).toThrow();
    expect(() => parseISO('26-1-1')).toThrow();
  });
  it('weekday (1=Mon..7=Sun)', () => {
    expect(isoWeekday('2026-10-09')).toBe(5);
    expect(isoWeekday('2026-10-11')).toBe(7);
  });
});
