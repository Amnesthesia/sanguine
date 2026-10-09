import type { CycleRecord, DailyLog } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { cyclePattern, inPatternState, PATTERN_SYMPTOMS } from './patternModel';

const c = (start: string, length?: number, quality: CycleRecord['quality'] = 'valid'): CycleRecord => ({ id: start, start, ...(length ? { length } : {}), quality });
const log = (date: string, ...codes: string[]): DailyLog => ({ date, symptoms: codes.map((code) => ({ code, intensity: 1 as const })) });

describe('cyclePattern (P8-4)', () => {
  it('counts the published markers over the last 10 closed cycles and the days since the last start', () => {
    const cycles = [c('2025-09-01', 26), c('2025-09-27', 27), c('2025-10-24', 38), c('2025-12-01', 25), c('2025-12-26', 64), c('2026-02-28', 30), c('2026-03-30', 22), c('2026-04-21', 61), c('2026-06-21', 28), c('2026-07-19', 29), c('2026-08-17', 27), c('2026-09-13')];
    const p = cyclePattern(cycles, [], '2026-10-10');
    expect(p.lengths).toEqual([27, 38, 25, 64, 30, 22, 61, 28, 29, 27]); // the oldest closed cycle falls outside the 10
    expect(p.spread).toEqual({ min: 22, max: 64 });
    expect(p.longCycles).toBe(2); // 64 and 61: 60 days or more
    expect(p.changes7).toBe(7); // 27→38, 38→25, 25→64, 64→30, 30→22, 22→61, 61→28
    expect(p.daysSinceStart).toBe(27);
  });
  it('an open cycle already 60 days long counts as days since the start, never as a closed long cycle', () => {
    const p = cyclePattern([c('2026-05-01', 28), c('2026-05-29', 29), c('2026-06-27')], [], '2026-10-10');
    expect(p.daysSinceStart).toBe(105);
    expect(p.longCycles).toBe(0);
    expect(p.changes7).toBe(0);
  });
  it('without cycles there is nothing to count', () => {
    expect(cyclePattern([], [], '2026-10-10')).toEqual({ lengths: [], spread: undefined, longCycles: 0, changes7: 0, daysSinceStart: undefined, symptoms: PATTERN_SYMPTOMS.map((code) => ({ code, last4w: 0, last12w: 0 })) });
  });
  it('counts days with hot flushes, night sweats and sleep problems in the last 4 and 12 weeks', () => {
    const logs = [log('2026-10-10', 'hot_flushes', 'insomnia'), log('2026-09-20', 'hot_flushes'), log('2026-08-01', 'hot_flushes', 'night_sweats'), log('2026-07-01', 'hot_flushes'), log('2026-10-09', 'cramps')];
    expect(cyclePattern([], logs, '2026-10-10').symptoms).toEqual([
      { code: 'hot_flushes', last4w: 2, last12w: 3 },
      { code: 'night_sweats', last4w: 0, last12w: 1 },
      { code: 'insomnia', last4w: 1, last12w: 1 },
    ]);
  });
});

describe('inPatternState', () => {
  it('is true only while the perimenopause life state is open on today', () => {
    expect(inPatternState([{ kind: 'perimenopause', since: '2026-01-01' }], '2026-10-10')).toBe(true);
    expect(inPatternState([{ kind: 'perimenopause', since: '2026-01-01', until: '2026-05-01' }], '2026-10-10')).toBe(false);
    expect(inPatternState([{ kind: 'none' }], '2026-10-10')).toBe(false);
  });
});
