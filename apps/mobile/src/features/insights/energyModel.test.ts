import { addDays, type ISODate } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import type { GuideDay, GuidePhase } from '@/features/guidance/guidance';
import { energyInsight, lowPhaseOf } from './energyModel';

const TODAY = '2026-10-14';
// a stub phase map: day i before today -> phase by a fixed pattern, so tests do not depend on phaseOn
const series = (spec: Array<[GuidePhase | 'none', number, number]>) => {
  // [phase, level, count], laid out backwards from today, one day each
  const points: Array<{ day: ISODate; level: number }> = [];
  const phases = new Map<ISODate, GuidePhase>();
  let i = 0;
  for (const [ph, level, count] of spec) for (let k = 0; k < count; k++, i++) {
    const day = addDays(TODAY, -i);
    points.push({ day, level });
    if (ph !== 'none') phases.set(day, ph);
  }
  const phaseOf = (d: ISODate): GuideDay | undefined => (phases.has(d) ? { phase: phases.get(d) as GuidePhase, expected: false } : undefined);
  return { points: points.reverse(), phaseOf };
};

describe('energyInsight', () => {
  it('averages per phase in cycle order, one decimal, and finds the lowest and highest phase', () => {
    const { points, phaseOf } = series([['premenstrual', 2, 5], ['menstrual', 3, 5], ['follicular', 4, 10]]);
    const r = energyInsight(points, TODAY, phaseOf);
    expect(r.byPhase).toEqual([
      { phase: 'menstrual', mean: 3, n: 5 }, { phase: 'follicular', mean: 4, n: 10 }, { phase: 'premenstrual', mean: 2, n: 5 },
    ]);
    // overall (10 + 15 + 40) / 20 = 3.25 -> 3.3 (rounded half up at one decimal)
    expect(r.suggestions).toEqual([
      { kind: 'lowPhase', phase: 'premenstrual', mean: 2, overall: 3.3, n: 5 },
      { kind: 'highPhase', phase: 'follicular', mean: 4, overall: 3.3, n: 10 },
    ]);
    expect(lowPhaseOf(r.suggestions)).toBe('premenstrual');
  });
  it('general and unknown days count in no phase', () => {
    const { points, phaseOf } = series([['general', 1, 6], ['none', 1, 6], ['follicular', 4, 4]]);
    expect(energyInsight(points, TODAY, phaseOf).byPhase).toEqual([{ phase: 'follicular', mean: 4, n: 4 }]);
  });
  it('no phase suggestion below 10 logged days, with a phase under 4 days, or with one qualifying phase', () => {
    expect(energyInsight(...withToday(series([['premenstrual', 1, 4], ['follicular', 5, 5]]))).suggestions).toEqual([]); // 9 days
    expect(energyInsight(...withToday(series([['premenstrual', 1, 3], ['follicular', 5, 10]]))).suggestions).toEqual([]); // premenstrual has 3
  });
  it('no phase suggestion when no phase is half a point away from the overall average', () => {
    expect(energyInsight(...withToday(series([['luteal', 3, 6], ['follicular', 3.4 as number, 6]]))).suggestions).toEqual([]);
  });
  it('lowOverall: 10 or more logs in the last 4 weeks averaging 2 or less; older logs do not count', () => {
    const low = series([['none', 2, 10]]);
    expect(energyInsight(low.points, TODAY, low.phaseOf).suggestions).toEqual([{ kind: 'lowOverall', mean: 2, n: 10 }]);
    const nine = series([['none', 2, 9]]);
    expect(energyInsight(nine.points, TODAY, nine.phaseOf).suggestions).toEqual([]);
    const old = series([['none', 4, 28], ['none', 1, 20]]); // the 20 low days are older than 28 days
    expect(energyInsight(old.points, TODAY, old.phaseOf).suggestions).toEqual([]);
  });
  it('the window holds only the last 84 days', () => {
    const { points, phaseOf } = series([['none', 3, 100]]);
    const w = energyInsight(points, TODAY, phaseOf).window;
    expect(w).toHaveLength(84);
    expect(w[0]?.day).toBe(addDays(TODAY, -83));
  });
});

function withToday(s: { points: Array<{ day: ISODate; level: number }>; phaseOf: (d: ISODate) => GuideDay | undefined }) {
  return [s.points, TODAY, s.phaseOf] as const;
}
