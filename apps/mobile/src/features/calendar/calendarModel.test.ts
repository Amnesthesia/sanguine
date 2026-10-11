import { addDays, diffDays, type EngineSettings, type History, type ISODate, predict } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { buildMonth, cycleDayOf, dayEstimates, showCycleDay, monthOf, shiftMonth, swipeMonthDelta } from './calendarModel';

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
  buildMonth({ month: m, today, periodDays: periodDays(typical), loggedDays: new Set(['2026-10-01', '2026-10-10']), prediction: predict(typical, S, today), showEstimate: true, cycleStarts: typical.cycles.map((c) => c.start), ...over });
const cell = (m: ReturnType<typeof buildMonth>, d: ISODate) => m.cells.find((c) => c.date === d) as NonNullable<(typeof m.cells)[number]>;

describe('swipeMonthDelta', () => {
  it('a drag past 30% of the width or a flick changes the month; a short slow drag springs back', () => {
    expect(swipeMonthDelta(-120, 0, 360)).toBe(1); // left: next month
    expect(swipeMonthDelta(120, 0, 360)).toBe(-1); // right: previous month
    expect(swipeMonthDelta(-60, -100, 360)).toBe(0);
    expect(swipeMonthDelta(-30, -900, 360)).toBe(1);
    expect(swipeMonthDelta(30, 900, 360)).toBe(-1);
    // a flick against the drag direction cancels instead of flipping the other way
    expect(swipeMonthDelta(-150, 900, 360)).toBe(0);
    expect(swipeMonthDelta(-200, 0, 0)).toBe(0); // not laid out yet
  });
});

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
  it('a typical calendar-only estimate (arms within 6 days) draws the band and a point marker (D-098)', () => {
    const m = month('2026-10');
    expect(m.ovulationUncertain).toBe(false);
    expect(m.cells.filter((c) => c.ovulation === 'point')).toHaveLength(1);
  });
  it('an irregular history (arms over 6 days) shows the uncertain caption, no marker and no fertile band (§9.8, D-098)', () => {
    const irregular = hist([24, 38, 31, 45, 27, 36], '2026-10-01');
    const m = month('2026-10', { prediction: predict(irregular, S, today), periodDays: periodDays(irregular) });
    expect(m.ovulationUncertain).toBe(true);
    expect(m.cells.some((c) => c.ovulation !== undefined || c.fertile !== undefined)).toBe(false);
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

describe('cycle day on each cell (D-100)', () => {
  const starts = typical.cycles.map((c) => c.start); // 4 Aug, 1 Sep, 30 Sep
  it('counts from the latest logged start on or before the day', () => {
    expect(cycleDayOf(starts, '2026-09-30')).toBe(1);
    expect(cycleDayOf(starts, '2026-10-10')).toBe(11);
    expect(cycleDayOf(starts, '2026-09-29')).toBe(29);
    expect(cycleDayOf(starts, '2026-08-03')).toBeUndefined();
    expect(cycleDayOf([], '2026-10-10')).toBeUndefined();
  });
  it('keeps counting past the predicted start (never a predicted day 1) and stops after day 90', () => {
    const lo = predict(typical, S, today).nextPeriod?.i80.lo as ISODate;
    expect(cycleDayOf(starts, lo)).toBe(diffDays(lo, '2026-09-30') + 1);
    expect(cycleDayOf(starts, addDays('2026-09-30', 89))).toBe(90);
    expect(cycleDayOf(starts, addDays('2026-09-30', 90))).toBeUndefined();
  });
  it('the grid carries it and VoiceOver hears it', () => {
    const m = month('2026-10');
    expect(cell(m, '2026-09-30').cycleDay).toBe(1);
    expect(cell(m, today).cycleDay).toBe(11);
    expect(cell(m, today).label).toContain('cycle day 11');
    expect(buildMonth({ month: '2026-10', today, periodDays: new Set(), loggedDays: new Set(), prediction: undefined, showEstimate: true }).cells.every((c) => c.cycleDay === undefined)).toBe(true);
  });
  it('every day of the shown month carries a badge (D-101); days outside the month do not', () => {
    const m = month('2026-10');
    const drawn = m.cells.filter((c) => showCycleDay(c)).map((c) => c.cycleDay);
    expect(drawn).toEqual(Array.from({ length: 31 }, (_, k) => k + 2)); // 1 Oct is day 2; 30 Sep (day 1) is outside October
    expect(cell(m, '2026-10-02').label).toContain('cycle day 3');
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

describe('week start', () => {
  it('Monday-first is the default and starts the grid on a Monday', () => {
    const m = month('2026-10');
    expect(m.cells[0]?.date).toBe('2026-09-28'); // 1 Oct 2026 is a Thursday
    expect(month('2026-10', { weekStart: 'mon' }).cells[0]?.date).toBe('2026-09-28');
  });
  it('Sunday-first starts the grid on the Sunday before', () => {
    const m = month('2026-10', { weekStart: 'sun' });
    expect(m.cells[0]?.date).toBe('2026-09-27');
    expect(m.cells).toHaveLength(42);
    expect(m.cells.filter((c) => c.inMonth)).toHaveLength(31);
  });
  it('a month starting on a Sunday has no leading days Sunday-first and six Monday-first', () => {
    expect(month('2026-11', { weekStart: 'sun' }).cells[0]?.date).toBe('2026-11-01');
    expect(month('2026-11').cells[0]?.date).toBe('2026-10-26');
  });
});

describe('moon phases on the month (D-089)', () => {
  it('a day with a principal phase carries it and says it to VoiceOver; other days and no map carry nothing', () => {
    const base = { month: '2026-10', today: '2026-10-10', periodDays: new Set<string>(), loggedDays: new Set<string>(), prediction: undefined, showEstimate: true };
    const m = buildMonth({ ...base, moon: new Map([['2026-10-26', 'full' as const]]) });
    const cell = m.cells.find((c) => c.date === '2026-10-26');
    expect(cell?.moon).toBe('full');
    expect(cell?.label).toContain('full moon');
    expect(m.cells.find((c) => c.date === '2026-10-25')?.moon).toBeUndefined();
    expect(buildMonth(base).cells.every((c) => c.moon === undefined)).toBe(true);
  });
});

describe('the day estimates spelled out (D-104)', () => {
  const p = predict(typical, S, today);
  const est = (d: ISODate, showEstimate = true, period = false) => dayEstimates(d, p, showEstimate, period);
  const m = month('2026-10');
  it('says what every mark on a day means, and only the marks the grid draws', () => {
    for (const c of m.cells) {
      const lines = est(c.date, true, c.period);
      expect(lines.some((l) => l.startsWith('Period likely'))).toBe(c.predicted80);
      expect(lines.some((l) => l.startsWith('Period possible'))).toBe(c.predicted95Edge);
      expect(lines.some((l) => l.startsWith('Fertile window'))).toBe(c.fertile !== undefined);
      expect(lines.some((l) => l.startsWith('Ovulation estimate'))).toBe(c.ovulation !== undefined);
    }
  });
  it('a predicted period day names the range and the confidence word', () => {
    const next = p.nextPeriod as NonNullable<typeof p.nextPeriod>;
    const [line] = est(next.i80.lo);
    expect(line).toMatch(/^Period likely to start .+–.+ · (confident|fair estimate|rough estimate)$/);
  });
  it('the ovulation day says it is the most likely day inside the range; the fertile band is graded, not a fertile day', () => {
    const point = m.cells.find((c) => c.ovulation === 'point') as (typeof m.cells)[number];
    const lines = est(point.date);
    expect(lines.some((l) => /^Ovulation estimate .+–.+, most likely this day/.test(l))).toBe(true);
    expect(lines.some((l) => /^Fertile window: (low|moderate|high) likelihood/.test(l))).toBe(true);
  });
  it('names no fertile window or ovulation while the estimate is hidden (teen)', () => {
    for (const c of m.cells) expect(est(c.date, false, c.period).every((l) => l.startsWith('Period'))).toBe(true);
  });
  it('nothing for a day without marks, a logged period day, or no prediction', () => {
    const plain = m.cells.find((c) => !c.period && !c.predicted80 && !c.predicted95Edge && c.fertile === undefined && c.ovulation === undefined) as (typeof m.cells)[number];
    expect(est(plain.date)).toEqual([]);
    const next = p.nextPeriod as NonNullable<typeof p.nextPeriod>;
    expect(est(next.i80.lo, true, true).some((l) => l.startsWith('Period'))).toBe(false);
    expect(dayEstimates('2026-10-25', undefined, true, false)).toEqual([]);
  });
});
