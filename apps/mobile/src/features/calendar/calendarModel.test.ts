import { addDays, type EngineSettings, type History, type ISODate, predict } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { buildMonth, monthOf, shiftMonth } from './calendarModel';

const S: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };
const today = '2026-10-10';
function hist(lengths: number[], last: ISODate, bleed = 4): History {
  const starts: ISODate[] = [last];
  for (let i = lengths.length - 1; i >= 0; i--) starts.unshift(addDays(starts[0] as ISODate, -(lengths[i] as number)));
  return { cycles: starts.map((s, i) => ({ id: `c${i}`, start: s, end: addDays(s, bleed - 1), quality: 'valid' as const })), temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
}
const typical = hist([28, 29], '2026-09-30'); // 4 Aug, 1 Sep, 30 Sep
const periodDays = (h: History) => new Set(h.cycles.flatMap((c) => Array.from({ length: 4 }, (_, i) => addDays(c.start, i))));
const month = (m: string, over: Partial<Parameters<typeof buildMonth>[0]> = {}) =>
  buildMonth({ month: m, today, periodDays: periodDays(typical), loggedDays: new Set(['2026-10-01', '2026-10-10']), prediction: predict(typical, S, today), showEstimate: true, ...over });
const cell = (m: ReturnType<typeof buildMonth>, d: ISODate) => m.cells.find((c) => c.date === d) as NonNullable<(typeof m.cells)[number]>;

describe('month helpers', () => {
  it('monthOf and shiftMonth', () => {
    expect(monthOf('2026-10-10')).toBe('2026-10');
    expect(shiftMonth('2026-10', 1)).toBe('2026-11');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('grid', () => {
  it('is six Monday-first weeks: October 2026 starts on a Thursday', () => {
    const m = month('2026-10');
    expect(m.cells).toHaveLength(42);
    expect(m.cells[0]?.date).toBe('2026-09-28');
    expect(m.cells[3]?.date).toBe('2026-10-01');
    expect(m.cells[0]?.inMonth).toBe(false);
    expect(cell(m, '2026-10-01').inMonth).toBe(true);
    expect(m.title).toBe('October 2026');
  });
  it('flags today', () => {
    const m = month('2026-10');
    expect(m.cells.filter((c) => c.isToday).map((c) => c.date)).toEqual([today]);
  });
});

describe('period, predicted range and logged marks', () => {
  it('logged period days are solid; other days are not', () => {
    const m = month('2026-10');
    for (const d of ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']) expect(cell(m, d).period).toBe(true);
    expect(cell(m, '2026-10-04').period).toBe(false);
  });
  it('the 80% range is hatched and the 95% extension is only an outline', () => {
    const m = month('2026-10');
    const p = predict(typical, S, today).nextPeriod;
    expect(p).toBeDefined();
    const lo80 = p?.i80.lo as string;
    const hi80 = p?.i80.hi as string;
    expect(cell(m, lo80).predicted80).toBe(true);
    expect(cell(m, hi80).predicted80).toBe(true);
    const before = addDays(lo80, -1);
    expect(cell(m, before).predicted80).toBe(false);
    expect(cell(m, before).predicted95Edge).toBe(before >= (p?.i95.lo as string));
  });
  it('predicted days are not drawn over logged period days', () => {
    const early = hist([28, 29], '2026-10-02');
    const m = month('2026-10', { periodDays: periodDays(early), prediction: predict(early, S, '2026-10-02') });
    expect(m.cells.filter((c) => c.period && c.predicted80)).toEqual([]);
  });
  it('log dots mark days with anything logged', () => {
    const m = month('2026-10');
    expect(cell(m, '2026-10-01').logged).toBe(true);
    expect(cell(m, '2026-10-05').logged).toBe(false);
  });
});

describe('fertile band and ovulation marker (§8.5)', () => {
  it('a graded band: many days, opacity = p clamped to 0.1-1, never a single day', () => {
    const m = month('2026-10');
    const band = m.cells.filter((c) => c.fertile !== undefined);
    expect(band.length).toBeGreaterThanOrEqual(8);
    for (const c of band) {
      expect(c.fertile).toBeGreaterThanOrEqual(0.1);
      expect(c.fertile).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...band.map((c) => c.fertile as number))).toBeGreaterThan(Math.min(...band.map((c) => c.fertile as number)));
  });
  it('is hidden when the estimate is hidden', () => {
    const m = month('2026-10', { showEstimate: false });
    expect(m.cells.some((c) => c.fertile !== undefined || c.ovulation !== undefined)).toBe(false);
    expect(m.ovulationUncertain).toBe(false);
  });
  it('a wide calendar-only range shows the uncertain caption and no point marker', () => {
    const m = month('2026-10');
    expect(m.ovulationUncertain).toBe(true);
    expect(m.cells.some((c) => c.ovulation === 'point')).toBe(false);
  });
  it('a precise (LH) estimate shows a point marker with arms over the 80% range', () => {
    const h = hist([28, 29], '2026-09-30');
    h.lh = [{ date: '2026-10-12', result: 'negative', provenance: 'manual' }, { date: '2026-10-13', result: 'positive', provenance: 'manual' }];
    const p = predict(h, S, '2026-10-14');
    const m = buildMonth({ month: '2026-10', today: '2026-10-14', periodDays: periodDays(h), loggedDays: new Set(), prediction: p, showEstimate: true });
    expect(m.ovulationUncertain).toBe(false);
    expect(cell(m, '2026-10-14').ovulation).toBe('point');
    expect(m.cells.filter((c) => c.ovulation === 'range').length).toBe(2);
  });
});

describe('accessibility labels', () => {
  it('say the date and the state in words, not opacity', () => {
    const m = month('2026-10');
    expect(cell(m, '2026-10-01').label).toContain('Thursday 1 October');
    expect(cell(m, '2026-10-01').label).toContain('period');
    expect(cell(m, '2026-10-01').label).toContain('something logged');
    expect(cell(m, today).label).toContain('today');
    const fertileCell = m.cells.find((c) => c.fertile !== undefined && c.fertile > 0.45) as NonNullable<(typeof m.cells)[number]>;
    expect(fertileCell.label).toMatch(/(moderate|high) likelihood of being in the fertile window/);
    expect(fertileCell.label).not.toMatch(/opacity|0\.\d/);
    const predicted = m.cells.find((c) => c.predicted80) as NonNullable<(typeof m.cells)[number]>;
    expect(predicted.label).toContain('predicted period, 80% range');
  });
});

describe('months without a prediction', () => {
  it('a past month shows logged marks only', () => {
    const m = month('2026-08');
    expect(m.cells.some((c) => c.predicted80 || c.fertile !== undefined)).toBe(false);
    expect(cell(m, '2026-08-04').period).toBe(true);
  });
  it('no prediction at all is fine', () => {
    const m = buildMonth({ month: '2026-10', today, periodDays: new Set(), loggedDays: new Set(), prediction: undefined, showEstimate: true });
    expect(m.cells).toHaveLength(42);
  });
});
