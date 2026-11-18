import { addDays, type CycleRecord, type DailyLog, type ISODate, type PastOvulation, type Prediction, studentTQuantile } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { accuracyText, cycleLengthSeries, cycleOvulation, historyRows, lengthAxisLabels, ovulationWords, phaseBars } from './insightsModel';

const cyc = (id: string, start: ISODate, length: number | undefined, over: Partial<CycleRecord> = {}): CycleRecord => ({
  id, start, quality: 'valid', end: addDays(start, 3), bleedDays: 4, ...(length ? { length, nextStart: addDays(start, length) } : {}), ...over,
});
const past = (cycleId: string, lo: ISODate, hi: ISODate, basis: PastOvulation['basis'] = 'calendar'): PastOvulation =>
  ({ cycleId, cycleStart: lo, point: lo, i80: { lo, hi }, basis, confidence: 'medium' });
const cycles: CycleRecord[] = [cyc('a', '2026-08-04', 28), cyc('b', '2026-09-01', 29), cyc('c', '2026-09-30', undefined)];

describe('historyRows (§8.3 Insights history)', () => {
  it('newest first, with length, bleed days, the ovulation estimate and a current marker', () => {
    const rows = historyRows(cycles, '2026-10-10', { pastOv: [past('b', '2026-09-13', '2026-09-17', 'lh')], prediction: { ovulation: { i80: { lo: '2026-10-12', hi: '2026-10-16' }, basis: 'calendar' } } as Prediction });
    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(rows[0]).toMatchObject({ start: '30 Sep', current: true, lengthDays: undefined, dayOfCycle: 11, bleedDays: 4, quality: 'valid', ovulation: { i80: { lo: '2026-10-12', hi: '2026-10-16' }, basis: 'calendar', past: false } });
    expect(rows[1]?.ovulation).toEqual({ i80: { lo: '2026-09-13', hi: '2026-09-17' }, basis: 'lh', past: true });
    // no engine estimate for the cycle (left out, hormonal IUD): no ovulation at all
    expect(rows[2]?.ovulation).toBeUndefined();
    expect(rows[1]).toMatchObject({ start: '1 Sep', lengthDays: 29, current: false });
  });
  it('flags an unusually long cycle with its three actions (incl. "I was pregnant", which needs the next start)', () => {
    const rows = historyRows([cyc('x', '2026-05-01', 56, { quality: 'suspect_skip', ovulation: { point: '2026-05-20', sd: 1, basis: 'lh' } }), cyc('y', '2026-06-26', undefined)], '2026-07-01');
    expect(rows[1]).toMatchObject({ quality: 'suspect_skip', offerMissedLog: true, midDay: '2026-05-29', nextStartISO: '2026-06-26' });
    expect(rows[0]?.offerMissedLog).toBe(false);
  });
});

describe('cycleOvulation: the engine estimate behind a cycle row and the cycle screen', () => {
  const pred = { ovulation: { point: '2026-10-14', i80: { lo: '2026-10-12', hi: '2026-10-16' }, sd: 1.5, confidence: 'medium', basis: 'bbt' } } as Prediction;
  it('a closed cycle takes its pastOvulations row, the open cycle the prediction', () => {
    expect(cycleOvulation({ id: 'b', nextStart: '2026-09-30' }, [past('b', '2026-09-13', '2026-09-17', 'lh')], pred)).toEqual({ i80: { lo: '2026-09-13', hi: '2026-09-17' }, basis: 'lh', past: true });
    expect(cycleOvulation({ id: 'c', nextStart: undefined }, [], pred)).toEqual({ i80: { lo: '2026-10-12', hi: '2026-10-16' }, basis: 'bbt', past: false });
  });
  it('nothing when the engine gives no estimate or the prediction is suspended (past cycles included)', () => {
    expect(cycleOvulation({ id: 'a', nextStart: '2026-09-01' }, [past('b', '2026-09-13', '2026-09-17')], pred)).toBeUndefined();
    expect(cycleOvulation({ id: 'c', nextStart: undefined }, [], {} as Prediction)).toBeUndefined();
    expect(cycleOvulation({ id: 'b', nextStart: '2026-09-30' }, [past('b', '2026-09-13', '2026-09-17')], { suspended: { reason: 'x' } } as Prediction)).toBeUndefined();
  });
});

describe('ovulationWords (owner, real device: "calendar" meant nothing)', () => {
  const tr = i18n.t.bind(i18n) as (k: string, p?: Record<string, string>) => string;
  const on = { show: true, includeUncertain: false };
  const est = (lo: ISODate, hi: ISODate, basis: PastOvulation['basis'] = 'calendar', isPast = true) => ({ i80: { lo, hi }, basis, past: isPast });
  it('the 80% range, and no basis words for a calendar estimate', () => {
    expect(ovulationWords(est('2026-10-13', '2026-10-17'), on, tr)).toEqual({ line: 'Ovulation estimate 13\u201317 Oct', basis: undefined });
  });
  it('the basis in plain words when a signal dated it', () => {
    expect(ovulationWords(est('2026-10-13', '2026-10-15', 'lh'), on, tr)?.basis).toBe('from your LH tests');
    expect(ovulationWords(est('2026-10-13', '2026-10-15', 'bbt'), on, tr)?.basis).toBe('from your temperature readings');
    expect(ovulationWords(est('2026-10-13', '2026-10-15', 'mucus'), on, tr)?.basis).toBe('from your cervical mucus notes');
    expect(ovulationWords(est('2026-10-13', '2026-10-15', 'combined'), on, tr)?.basis).toBe('from your tests and readings');
    // every engine basis has words, never a raw key
    for (const b of ['wearable', 'cervix'] as const) expect(ovulationWords(est('2026-10-13', '2026-10-15', b), on, tr)?.basis).toMatch(/^from your /);
  });
  it('a range over 12 days: only the word uncertain, never a date, unless she opted in to uncertain estimates', () => {
    const wide = est('2026-10-05', '2026-10-18');
    expect(ovulationWords(wide, on, tr)?.line).toBe('Ovulation estimate uncertain');
    expect(ovulationWords(wide, { show: true, includeUncertain: true }, tr)?.line).toBe('Ovulation estimate uncertain: could have fallen 5\u201318 Oct');
    expect(ovulationWords({ ...wide, past: false }, { show: true, includeUncertain: true }, tr)?.line).toBe('Ovulation estimate uncertain: could fall 5\u201318 Oct');
    // exactly 12 days is not wide (an arm of 6 days, D-098)
    expect(ovulationWords(est('2026-10-05', '2026-10-17'), on, tr)?.line).toBe('Ovulation estimate 5\u201317 Oct');
  });
  it('nothing when the estimate is hidden (teen mode, the setting) or there is none', () => {
    expect(ovulationWords(est('2026-10-13', '2026-10-17'), { show: false, includeUncertain: true }, tr)).toBeUndefined();
    expect(ovulationWords(undefined, on, tr)).toBeUndefined();
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

// D-093: a chart that spans New Year names the year, or "Dec … Jan … Dec" is ambiguous (U-22)
describe('lengthAxisLabels', () => {
  it('month only within one year', () => expect(lengthAxisLabels(['2026-03-02', '2026-04-01', '2026-05-01'])).toEqual(['Mar', 'Apr', 'May']));
  it('month and year when the points span years', () => expect(lengthAxisLabels(['2025-12-01', '2026-01-01'])).toEqual(['Dec 2025', 'Jan 2026']));
  it('day and month when a month repeats', () => expect(lengthAxisLabels(['2026-07-05', '2026-08-02', '2026-08-30'])).toEqual(['5 Jul', '2 Aug', '30 Aug']));
});
