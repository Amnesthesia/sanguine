import type { CycleRecord } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { lunarAligned, moonPhaseDays, phaseInstant, southernRegion } from './moon';

const HOUR = 3_600_000;
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

describe('phaseInstant (Meeus ch. 49)', () => {
  it.each([
    ['new moon, total solar eclipse', '2024-04-08T18:21:00Z', 0],
    ['full moon, total lunar eclipse', '2025-03-14T06:55:00Z', 0.5],
    ['full moon', '2024-01-25T17:54:00Z', 0.5],
    ['first quarter', '2024-01-18T03:53:00Z', 0.25],
    ['last quarter', '2024-01-04T03:30:00Z', 0.75],
  ])('%s at %s within an hour', (_name, iso, q) => {
    const lunation = Math.round((Date.parse(iso) - Date.UTC(2000, 0, 6)) / 86_400_000 / 29.530588861 - q) + q;
    expect(Math.abs(phaseInstant(lunation) - Date.parse(iso))).toBeLessThan(HOUR);
  });
});

describe('moonPhaseDays', () => {
  it('January 2024 in UTC: the four phases on their days, in order', () => {
    expect([...moonPhaseDays('2024-01-01', '2024-01-31', utcDay)]).toEqual([['2024-01-04', 'last'], ['2024-01-11', 'new'], ['2024-01-18', 'first'], ['2024-01-25', 'full']]);
  });
  it('the local day follows the time zone (Sydney is UTC+11 in January)', () => {
    const sydney = (ms: number) => utcDay(ms + 11 * HOUR);
    expect(moonPhaseDays('2024-01-01', '2024-01-31', sydney).get('2024-01-26')).toBe('full'); // 17:54 UTC is 04:54 the next day
  });
});

const c = (start: string, length: number, quality: CycleRecord['quality'] = 'valid'): CycleRecord => ({ id: start, start, length, quality });
const run = (lengths: number[]) => { let d = Date.UTC(2026, 0, 1); return lengths.map((l) => { const r = c(new Date(d).toISOString().slice(0, 10), l); d += l * 86_400_000; return r; }); };

describe('lunarAligned', () => {
  it('needs six typical cycles, every one 28 to 31 days, averaging within a day of 29.5', () => {
    expect(lunarAligned(run([29, 30, 29, 30, 29, 30]))).toBe(true);
    expect(lunarAligned(run([29, 30, 29, 30, 29]))).toBe(false); // five
    expect(lunarAligned(run([29, 30, 27, 30, 29, 30]))).toBe(false); // one at 27
    expect(lunarAligned(run([28, 28, 28, 28, 28, 28]))).toBe(false); // regular but mean 28: not lunar
    expect(lunarAligned(run([35, 29, 30, 29, 30, 29, 30]))).toBe(true); // only the last six count
  });
  it('ignores cycles that are not typical', () => {
    expect(lunarAligned([...run([29, 30, 29, 30, 29]), c('2026-06-01', 30, 'suspect_skip')])).toBe(false);
  });
});

describe('southernRegion', () => {
  it('AU and NZ are southern, GB and US are not, unknown is not', () => {
    expect([southernRegion('AU'), southernRegion('nz'), southernRegion('GB'), southernRegion('US'), southernRegion(null)]).toEqual([true, true, false, false, false]);
  });
});
