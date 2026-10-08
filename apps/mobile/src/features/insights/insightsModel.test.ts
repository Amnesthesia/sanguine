import { addDays, type CycleRecord, type DailyLog, type ISODate, studentTQuantile } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { accuracyText, cycleLengthSeries, historyRows, phaseBars } from './insightsModel';

const cyc = (id: string, start: ISODate, length: number | undefined, over: Partial<CycleRecord> = {}): CycleRecord => ({
  id, start, quality: 'valid', end: addDays(start, 3), bleedDays: 4, ...(length ? { length, nextStart: addDays(start, length) } : {}), ...over,
});
const cycles: CycleRecord[] = [cyc('a', '2026-08-04', 28), cyc('b', '2026-09-01', 29), cyc('c', '2026-09-30', undefined)];

describe('historyRows (§8.3 Insights history)', () => {
  it('newest first, with length, bleed days, ovulation basis and a current marker', () => {
    const rows = historyRows(cycles, '2026-10-10');
    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(rows[0]).toMatchObject({ start: '30 Sep', current: true, lengthDays: undefined, dayOfCycle: 11, bleedDays: 4, basis: 'calendar', quality: 'valid' });
    expect(rows[1]).toMatchObject({ start: '1 Sep', lengthDays: 29, current: false });
  });
  it('carries a biomarker basis and flags a possibly-missed log with its two actions', () => {
    const rows = historyRows([cyc('x', '2026-05-01', 56, { quality: 'suspect_skip', ovulation: { point: '2026-05-20', sd: 1, basis: 'lh' } }), cyc('y', '2026-06-26', undefined)], '2026-07-01');
    expect(rows[1]).toMatchObject({ basis: 'lh', quality: 'suspect_skip', offerMissedLog: true, midDay: '2026-05-29' });
    expect(rows[0]?.offerMissedLog).toBe(false);
  });
});

describe('cycleLengthSeries', () => {
  it('plots the valid closed cycles oldest first, capped at 12, with the 80% band from the model', () => {
    const many = Array.from({ length: 15 }, (_, i) => cyc(`c${i}`, addDays('2026-01-01', i * 28), 28));
    many.push(cyc('open', addDays('2026-01-01', 15 * 28), undefined));
    const s = cycleLengthSeries(many, { mean: 28, nu: 10, scale: 2 });
    expect(s.points).toHaveLength(12);
    expect(s.points.at(-1)?.start).toBe(addDays('2026-01-01', 14 * 28));
    const q = studentTQuantile(0.9, 10) * 2;
    expect(s.band).toEqual({ lo: 28 - q, hi: 28 + q });
  });
  it('leaves out excluded and suspect cycles, and says when there is too little to plot', () => {
    const s = cycleLengthSeries([cyc('a', '2026-01-01', 28), cyc('b', '2026-01-29', 56, { quality: 'suspect_skip' }), cyc('c', '2026-03-26', 30), cyc('d', '2026-04-25', 29), cyc('e', '2026-05-24', undefined)], { mean: 29, nu: 8, scale: 2.4 });
    expect(s.points.map((p) => p.length)).toEqual([28, 30, 29]);
    expect(cycleLengthSeries([cyc('a', '2026-01-01', 28)], undefined).points).toHaveLength(1);
    expect(cycleLengthSeries([cyc('a', '2026-01-01', 28)], undefined).band).toBeUndefined();
  });
});

describe('phaseBars (§8.3 symptom-by-phase)', () => {
  const log = (date: ISODate, codes: string[]): DailyLog => ({ date, symptoms: codes.map((code) => ({ code, intensity: 2 as const })) });
  const cs = [cyc('a', '2026-09-01', 28, { ovulation: { point: '2026-09-15', sd: 1, basis: 'lh' } }), cyc('b', '2026-09-29', undefined)];
  it('shares of logged days with each of the two most frequent symptoms, per phase', () => {
    const logs: DailyLog[] = [
      log('2026-09-01', ['cramps']), log('2026-09-02', ['cramps']), // menstrual, 2 of 3 logged days
      log('2026-09-03', []), // menstrual, none
      log('2026-09-08', ['headache']), log('2026-09-09', []), log('2026-09-10', ['headache']), // follicular: 2 of 3
      log('2026-09-20', ['cramps']), log('2026-09-21', []), log('2026-09-22', []), log('2026-09-23', []), // luteal: 1 of 4
      log('2026-09-25', ['bloating']), // luteal: top-2 excludes bloating
    ];
    const bars = phaseBars(cs, logs, '2026-10-10');
    expect(bars.map((b) => b.code)).toEqual(['cramps', 'headache']);
    expect(bars[0]?.share).toEqual({ menstrual: 2 / 3, follicular: 0, luteal: 1 / 5 });
    expect(bars[1]?.share).toEqual({ menstrual: 0, follicular: 2 / 3, luteal: 0 });
  });
  it('empty when nothing is logged', () => expect(phaseBars(cs, [], '2026-10-10')).toEqual([]));
  it('ignores days before the first cycle and in suspect cycles', () => {
    const bars = phaseBars([cyc('s', '2026-09-01', 56, { quality: 'suspect_skip' })], [log('2026-09-02', ['cramps'])], '2026-10-10');
    expect(bars).toEqual([]);
  });
});

describe('accuracyText', () => {
  it('uses the ledger counts', () => {
    expect(accuracyText({ total: 9, in80: 7, in95: 9, meanAbsError: 2.14 })).toEqual({ summary: { hits: 7, total: 9 }, missDays: '2.1' });
    expect(accuracyText({ total: 0, in80: 0, in95: 0, meanAbsError: 0 })).toBeUndefined();
  });
});
