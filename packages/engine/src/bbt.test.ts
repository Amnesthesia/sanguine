import { describe, expect, it } from 'vitest';
import { detectBbtShift, detectWearableShift } from './bbt';
import { addDays } from './dates';
import type { TemperatureReading } from './types';

const START = '2026-10-01';
const d = (n: number) => addDays(START, n);
const WIGGLE = [0, 0.04, -0.03, 0.02, -0.04, 0.03, -0.02];

function series(spec: Array<[number, number]>, extra: Partial<TemperatureReading> = {}): TemperatureReading[] {
  return spec.map(([day, v]) => ({ date: d(day), valueC: v, timeOfDay: '06:30', source: 'oral' as const, provenance: 'manual' as const, ...extra }));
}
/** low phase on days [0, high), then `high` value on [high, last]. */
function stepSeries(high: number, last: number, low = 36.3, hi = 36.65, extra: Partial<TemperatureReading> = {}): TemperatureReading[] {
  const spec: Array<[number, number]> = [];
  for (let day = 0; day <= last; day++) spec.push([day, day < high ? low + (WIGGLE[day % 7] as number) : hi]);
  return series(spec, extra);
}

describe('three-over-six (§4.6)', () => {
  it('detects a clean shift: first high day 14, ovulation the day before, SD 1.5, coverline = six-day max', () => {
    const r = detectBbtShift(stepSeries(14, 18), START);
    expect(r?.firstHighDate).toBe(d(14));
    expect(r?.ovulation.point).toBe(d(13));
    expect(r?.ovulation.offset).toBe(13);
    expect(r?.ovulation.sd).toBe(1.5);
    expect(r?.ovulation.basis).toBe('bbt');
    expect(r?.ovulation.confidence).toBe('medium');
    // preceding six readings are days 8..13: wiggle indices 1..6 and 0 -> max +0.04
    expect(r?.coverlineC).toBeCloseTo(36.34, 6);
  });
  it('returns null while fewer than three high readings exist', () => {
    expect(detectBbtShift(stepSeries(14, 15), START)).toBeNull();
    expect(detectBbtShift(stepSeries(14, 16), START)?.firstHighDate).toBe(d(14));
  });
  it('needs the third high to be >= 0.2 above the coverline', () => {
    expect(detectBbtShift(stepSeries(14, 20, 36.3, 36.5), START)).toBeNull(); // +0.16 over the 36.34 coverline
    expect(detectBbtShift(stepSeries(14, 20, 36.3, 36.55), START)?.firstHighDate).toBe(d(14));
  });
  it('all three must exceed the six-day maximum', () => {
    const s = stepSeries(14, 20);
    (s[15] as TemperatureReading).valueC = 36.3; // second high falls back
    expect(detectBbtShift(s, START)?.firstHighDate).not.toBe(d(14));
  });
  it('returns null with no shift', () => expect(detectBbtShift(stepSeries(99, 25), START)).toBeNull());
  it('returns null with fewer than seven valid readings', () => expect(detectBbtShift(series([[0, 36.3], [1, 36.3], [2, 36.3], [3, 36.7], [4, 36.7], [5, 36.7]]), START)).toBeNull());
  it('ignores readings before the cycle start', () => {
    const s = [...series([[-5, 37.2], [-4, 37.2], [-3, 37.2]]), ...stepSeries(14, 18)];
    expect(detectBbtShift(s, START)?.firstHighDate).toBe(d(14));
  });
  it('is order independent', () => {
    const s = stepSeries(14, 18);
    expect(detectBbtShift([...s].reverse(), START)).toEqual(detectBbtShift(s, START));
  });
});

describe('exclusions (§4.6)', () => {
  it('a disturbed reading is dropped; one dropped day does not break the count', () => {
    const s = stepSeries(14, 18);
    (s[10] as TemperatureReading).disturbed = true; // inside the six preceding days
    (s[15] as TemperatureReading).disturbed = true; // inside the three high days
    expect(detectBbtShift(s, START)?.firstHighDate).toBe(d(14));
  });
  it('two consecutive missing days break the run', () => {
    const s = stepSeries(14, 19).filter((x) => x.date !== d(15) && x.date !== d(16));
    const r = detectBbtShift(s, START);
    expect(r?.firstHighDate === d(14)).toBe(false);
  });
  it('readings outside 35.0 - 37.5 C are dropped (oral)', () => {
    const s = stepSeries(14, 18);
    (s[3] as TemperatureReading).valueC = 38.9;
    (s[4] as TemperatureReading).valueC = 34.1;
    expect(detectBbtShift(s, START)?.coverlineC).toBeCloseTo(36.34, 6);
  });
  it('readings more than 60 minutes from the median time are dropped', () => {
    const s = stepSeries(14, 18);
    (s[12] as TemperatureReading).timeOfDay = '09:00';
    (s[12] as TemperatureReading).valueC = 36.9; // would raise the coverline if kept
    expect(detectBbtShift(s, START)?.coverlineC).toBeCloseTo(36.34, 6);
  });
  it('exactly 60 minutes off is kept', () => {
    const s = stepSeries(14, 18);
    (s[12] as TemperatureReading).timeOfDay = '07:30';
    (s[12] as TemperatureReading).valueC = 36.9;
    expect(detectBbtShift(s, START)).toBeNull(); // 36.9 on day 12 lifts the coverline to 36.9, shift no longer 0.2 above... and ends the run
  });
  it('needs valid readings on >= 50% of cycle days to date', () => {
    // one reading in three before day 14, then every day: 12 of 17 days to date is above 50%, so thin the tail too
    const sparse = stepSeries(14, 18).filter((_, i) => i % 3 === 0 || i >= 14);
    expect(detectBbtShift(sparse, START)).toBeNull();
    // the same shape with every day present is detected
    expect(detectBbtShift(stepSeries(14, 18), START)).not.toBeNull();
  });
  it('vaginal and other sources count with oral; wrist and finger do not', () => {
    expect(detectBbtShift(stepSeries(14, 18, 36.3, 36.65, { source: 'vaginal' }), START)?.firstHighDate).toBe(d(14));
    expect(detectBbtShift(stepSeries(14, 18, 36.3, 36.65, { source: 'wrist' }), START)).toBeNull();
  });
});

describe('provenance (§4.7)', () => {
  it('untimed manual readings widen the SD by 1.3', () => {
    const s = stepSeries(14, 18).map((x) => ({ ...x, timeOfDay: undefined }) as TemperatureReading);
    expect(detectBbtShift(s, START)?.ovulation.sd).toBeCloseTo(1.5 * 1.3, 6);
  });
  it('imported readings widen the SD by 1.5', () => {
    expect(detectBbtShift(stepSeries(14, 18, 36.3, 36.65, { provenance: 'imported' }), START)?.ovulation.sd).toBeCloseTo(2.25, 6);
  });
});

describe('CUSUM secondary detector (§4.6)', () => {
  it('agrees with the primary on a clean step: SD stays 1.5', () => {
    expect(detectBbtShift(stepSeries(14, 20), START)?.ovulation.sd).toBe(1.5);
  });
  it('disagreement of more than 2 days: SD 2.5 and confidence low', () => {
    // a slow +0.15 bump from day 7 (too small for three-over-six) then the real step on day 17
    const spec: Array<[number, number]> = [];
    for (let day = 0; day <= 21; day++) {
      const base = 36.3 + (WIGGLE[day % 7] as number);
      spec.push([day, day >= 17 ? 36.7 : day >= 7 && day <= 16 ? base + 0.15 : base]);
    }
    const r = detectBbtShift(series(spec), START);
    expect(r?.firstHighDate).toBe(d(17));
    expect(r?.ovulation.sd).toBe(2.5);
    expect(r?.ovulation.confidence).toBe('low');
  });
});

describe('wearable series (own coverline, 0.3 C, SD 2.0)', () => {
  const wrist = (hi: number) => stepSeries(14, 18, 36.0, hi, { source: 'wrist', provenance: 'sensor' });
  it('detects a 0.4 C rise with SD 2.0 and basis wearable', () => {
    const r = detectWearableShift(wrist(36.4), START);
    expect(r?.firstHighDate).toBe(d(14));
    expect(r?.ovulation.sd).toBe(2);
    expect(r?.ovulation.basis).toBe('wearable');
    expect(r?.ovulation.confidence).toBe('medium');
  });
  it('a 0.25 C rise is below the wearable threshold', () => expect(detectWearableShift(wrist(36.29), START)).toBeNull());
  it('ignores oral readings and the 35.0-37.5 range check', () => {
    expect(detectWearableShift(stepSeries(14, 18), START)).toBeNull();
    const delta = stepSeries(14, 18, 0.0, 0.4, { source: 'finger', provenance: 'sensor' }); // deltas from a baseline
    expect(detectWearableShift(delta, START)?.firstHighDate).toBe(d(14));
  });
});
