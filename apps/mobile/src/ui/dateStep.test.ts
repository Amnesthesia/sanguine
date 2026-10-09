import { describe, expect, it } from 'vitest';
import { stepDate } from './dateStep';

const MIN = '2020-01-01';
const MAX = '2026-10-10';
describe('stepDate', () => {
  it('days roll over month and year', () => {
    expect(stepDate('2026-10-01', 'day', -1, MIN, MAX)).toBe('2026-09-30');
    expect(stepDate('2026-01-01', 'day', -1, MIN, MAX)).toBe('2025-12-31');
  });
  it('months keep the day when possible and clamp it otherwise', () => {
    expect(stepDate('2026-03-31', 'month', -1, MIN, MAX)).toBe('2026-02-28');
    expect(stepDate('2024-03-31', 'month', -1, MIN, MAX)).toBe('2024-02-29');
    expect(stepDate('2026-01-15', 'month', -1, MIN, MAX)).toBe('2025-12-15');
    expect(stepDate('2025-12-15', 'month', 1, MIN, MAX)).toBe('2026-01-15');
  });
  it('a year jump of ten steps ten years and still clamps', () => {
    expect(stepDate('2000-06-15', 'year', -1, '1900-01-01', MAX, 10)).toBe('1990-06-15');
    expect(stepDate('2000-02-29', 'year', 1, '1900-01-01', '2030-01-01', 10)).toBe('2010-02-28');
    expect(stepDate('1905-06-15', 'year', -1, '1900-01-01', MAX, 10)).toBe('1900-01-01');
  });
  it('years clamp the leap day', () => expect(stepDate('2024-02-29', 'year', 1, MIN, MAX)).toBe('2025-02-28'));
  it('never leaves [min, max]', () => {
    expect(stepDate(MAX, 'day', 1, MIN, MAX)).toBe(MAX);
    expect(stepDate('2026-09-30', 'month', 1, MIN, MAX)).toBe(MAX);
    expect(stepDate(MIN, 'day', -1, MIN, MAX)).toBe(MIN);
  });
});
