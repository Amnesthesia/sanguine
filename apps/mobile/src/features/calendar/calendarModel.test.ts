import { addDays, diffDays, type EngineSettings, type History, type ISODate, type PastOvulation, pastOvulations, type Prediction, predict } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { buildMonth, cycleDayOf, dayEstimates, monthOf, monthRows, pastFertileDays, shiftMonth, showCycleDay, swipeMonthDelta } from './calendarModel';

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
  buildMonth({ month: m, today, periodDays: periodDays(typical), loggedDays: new Set(['2026-10-01', '2026-10-10']), prediction: predict(typical, S, today), showEstimate: true, includeUncertain: false, pastOv: [], symptomDays: new Set(), cycleStarts: typical.cycles.map((c) => c.start), ...over });
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
    expect(cell(m, lo80).periodEstimate).toBe('core');
    expect(cell(m, hi80).periodEstimate).toBe('core');
    const before = addDays(lo80, -1);
    expect(cell(m, before).periodEstimate).toBe(before >= (p?.i95.lo as string) ? 'edge' : undefined);
  });
  it('predicted days are not drawn over logged period days', () => {
    const early = hist([28, 29], '2026-10-02');
    const m = month('2026-10', { periodDays: periodDays(early), prediction: predict(early, S, '2026-10-02') });
    expect(m.cells.filter((c) => c.period && c.periodEstimate)).toEqual([]);
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
    const m = buildMonth({ month: '2026-10', today: '2026-10-14', periodDays: periodDays(h), loggedDays: new Set(), prediction: p, showEstimate: true, includeUncertain: false, pastOv: [], symptomDays: new Set() });
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
    const predicted = m.cells.find((c) => c.periodEstimate === 'core') as NonNullable<(typeof m.cells)[number]>;
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
    expect(buildMonth({ month: '2026-10', today, periodDays: new Set(), loggedDays: new Set(), prediction: undefined, showEstimate: true, includeUncertain: false, pastOv: [], symptomDays: new Set() }).cells.every((c) => c.cycleDay === undefined)).toBe(true);
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
    expect(m.cells.some((c) => c.periodEstimate || c.fertile !== undefined)).toBe(false);
    expect(cell(m, '2026-08-04').period).toBe(true);
  });
  it('no prediction at all is fine', () => {
    const m = buildMonth({ month: '2026-10', today, periodDays: new Set(), loggedDays: new Set(), prediction: undefined, showEstimate: true, includeUncertain: false, pastOv: [], symptomDays: new Set() });
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
    const base = { month: '2026-10', today: '2026-10-10', periodDays: new Set<string>(), loggedDays: new Set<string>(), prediction: undefined, showEstimate: true, includeUncertain: false, pastOv: [], symptomDays: new Set<string>() };
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
  const est = (d: ISODate, showEstimate = true, period = false) => dayEstimates(d, { prediction: p, pastOv: [], showEstimate, includeUncertain: false, period });
  const m = month('2026-10');
  it('says what every mark on a day means, and only the marks the grid draws', () => {
    for (const c of m.cells) {
      const lines = est(c.date, true, c.period);
      expect(lines.some((l) => l.startsWith('Period likely to start'))).toBe(c.periodEstimate === 'core');
      expect(lines.some((l) => l.startsWith('Period possible'))).toBe(c.periodEstimate === 'edge');
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
    const plain = m.cells.find((c) => !c.period && !c.periodEstimate && c.fertile === undefined && c.ovulation === undefined) as (typeof m.cells)[number];
    expect(est(plain.date)).toEqual([]);
    const next = p.nextPeriod as NonNullable<typeof p.nextPeriod>;
    expect(est(next.i80.lo, true, true).some((l) => l.startsWith('Period'))).toBe(false);
    expect(dayEstimates('2026-10-25', { pastOv: [], showEstimate: true, includeUncertain: false, period: false })).toEqual([]);
  });
});

describe('an uncertain ovulation estimate, in words only (D-106)', () => {
  const irregular = hist([24, 38, 31, 45, 27, 36], '2026-10-01');
  const p = predict(irregular, S, today);
  const ov = p.ovulation as NonNullable<typeof p.ovulation>;
  it('days inside the wide range say the estimate is uncertain and where it could fall; the grid still draws nothing', () => {
    const m = month('2026-10', { prediction: p, periodDays: periodDays(irregular) });
    expect(m.ovulationUncertain).toBe(true);
    const lines = dayEstimates(ov.point, { prediction: p, pastOv: [], showEstimate: true, includeUncertain: false, period: false });
    expect(lines.some((l) => /^Ovulation estimate uncertain: could fall .+–.+ · rough estimate$/.test(l))).toBe(true);
    expect(dayEstimates(ov.i80.lo, { prediction: p, pastOv: [], showEstimate: true, includeUncertain: false, period: false }).some((l) => l.startsWith('Ovulation estimate uncertain'))).toBe(true);
    expect(dayEstimates(addDays(ov.i80.lo, -1), { prediction: p, pastOv: [], showEstimate: true, includeUncertain: false, period: false }).some((l) => l.startsWith('Ovulation'))).toBe(false);
    for (const c of m.cells) expect(dayEstimates(c.date, { prediction: p, pastOv: [], showEstimate: true, includeUncertain: false, period: c.period }).some((l) => l.startsWith('Fertile window'))).toBe(false);
  });
  it('says nothing about ovulation while the estimate is hidden (teen)', () => {
    expect(dayEstimates(ov.point, { prediction: p, pastOv: [], showEstimate: false, includeUncertain: false, period: false }).some((l) => l.startsWith('Ovulation'))).toBe(false);
  });
});

// ---- P8-20: period-end estimate, past ovulation, symptom marks, month list ----
const base = (over: Partial<Prediction> = {}): Prediction => ({
  engineVersion: 'test', asOf: '2026-11-02', cycleLength: { mean: 29, sd: 2, nu: 5, scale: 2, nCyclesUsed: 3 }, flags: [], cycleQuality: [], ...over,
});
const bleed = { point: '2026-11-04', i80: { lo: '2026-11-03', hi: '2026-11-05' }, confidence: 'medium' as const };
const novPeriod = new Set<ISODate>(['2026-10-31', '2026-11-01', '2026-11-02']);
const novPrediction = base({
  currentPhase: { phase: 'menstrual', dayOfCycle: 3 },
  currentBleed: bleed,
  nextPeriod: { point: '2026-11-28', i80: { lo: '2026-11-26', hi: '2026-11-30' }, i95: { lo: '2026-11-24', hi: '2026-12-02' }, confidence: 'medium', daysOfDataUsed: 90 },
  ovulation: { point: '2026-11-14', i80: { lo: '2026-11-10', hi: '2026-11-18' }, sd: 2, confidence: 'medium', basis: 'calendar' },
  fertileDays: Array.from({ length: 15 }, (_, k) => ({ date: addDays('2026-11-06', k), pInWindow: k >= 4 && k <= 9 ? 0.8 : 0.3 })),
});
const novArgs = { month: '2026-11', today: '2026-11-02' as ISODate, periodDays: novPeriod, prediction: novPrediction, showEstimate: true, includeUncertain: false, pastOv: [] as PastOvulation[], symptomDays: new Set<ISODate>(), cycleStarts: ['2026-10-31' as ISODate] };
const novCell = (over: Partial<Parameters<typeof buildMonth>[0]>, d: ISODate) => cell(buildMonth({ ...novArgs, loggedDays: new Set(), ...over }), d);

// October 2026 has a closed cycle (2 Oct - 31 Oct); its estimate sits in October
const oct = hist([28, 28], '2026-10-31'); // 6 Sep, 3 Oct, 31 Oct... lengths from the helper
const octPast = pastOvulations(oct, S);
const octMonth = (over: Partial<Parameters<typeof buildMonth>[0]> = {}) => buildMonth({ month: '2026-10', today: '2026-11-10', periodDays: periodDays(oct), loggedDays: new Set(), prediction: predict(oct, S, '2026-11-10'), showEstimate: true, includeUncertain: false, pastOv: octPast, symptomDays: new Set(), cycleStarts: oct.cycles.map((c) => c.start), ...over });
// days of the shown month only: the spill-over days of November legitimately carry the current cycle's band
const marked = (m: ReturnType<typeof buildMonth>) => m.cells.filter((c) => c.inMonth && (c.ovulation !== undefined || c.fertile !== undefined));

describe('rest of a period in progress (currentBleed)', () => {
  it('core up to the point, edge to i80.hi, never over a logged day', () => {
    expect(novCell({}, '2026-11-02').periodEstimate).toBeUndefined();
    expect(novCell({}, '2026-11-03').periodEstimate).toBe('core');
    expect(novCell({}, '2026-11-04').periodEstimate).toBe('core');
    expect(novCell({}, '2026-11-05').periodEstimate).toBe('edge');
    expect(novCell({}, '2026-11-06').periodEstimate).toBeUndefined();
    expect(novCell({}, '2026-11-01').periodEstimate).toBeUndefined();
  });
  it('a past month keeps no estimated period days once today passes the range', () => {
    // without the stale guard the range would be counted back from today (6 Nov, cycle day 3) and still mark 4 and 5 Nov
    const stale = { ...novPrediction, asOf: '2026-11-06' as ISODate };
    for (const d of ['2026-11-03', '2026-11-04', '2026-11-05'] as ISODate[]) {
      expect(novCell({ today: '2026-11-06', prediction: stale }, d).periodEstimate).toBeUndefined();
      const lines = dayEstimates(d, { prediction: stale, pastOv: [], showEstimate: true, includeUncertain: false, period: false });
      expect(lines.some((l) => l.startsWith('Period likely to end'))).toBe(false);
    }
    const m = buildMonth({ ...novArgs, today: '2026-11-06', prediction: stale, loggedDays: new Set() });
    expect(m.cells.filter((c) => c.date < '2026-11-23' && c.periodEstimate !== undefined)).toEqual([]);
  });
  it('dayEstimates counts the period end against the `today` it is given, and against asOf when it is not given one', () => {
    const at = (today?: ISODate) => dayEstimates('2026-11-04', { prediction: { ...novPrediction, asOf: '2026-11-02' }, pastOv: [], showEstimate: true, includeUncertain: false, period: false, ...(today ? { today } : {}) });
    expect(at().some((l) => l.startsWith('Period likely to end'))).toBe(true);
    expect(at('2026-11-02' as ISODate).some((l) => l.startsWith('Period likely to end'))).toBe(true);
    expect(at('2026-11-06' as ISODate).some((l) => l.startsWith('Period likely to end'))).toBe(false);
  });
  it('nothing while suspended', () => {
    expect(novCell({ prediction: { ...novPrediction, suspended: { reason: 'pregnant' } } }, '2026-11-03').periodEstimate).toBeUndefined();
  });
  it('is worded as an estimate with the range of its last day', () => {
    const lines = dayEstimates('2026-11-03', { prediction: novPrediction, pastOv: [], showEstimate: true, includeUncertain: false, period: false });
    expect(lines).toContain('Period likely to end 3–5 Nov · fair estimate');
    expect(novCell({}, '2026-11-03').label).toContain('estimated period day');
  });
});

describe('the spoken label follows the drawn mark', () => {
  // the next period's 80% range starts on 5 Nov, inside the unlikely tail of the period in progress: the mark is core, so the words say estimated, not possible
  const overlap = { ...novPrediction, nextPeriod: { ...(novPrediction.nextPeriod as NonNullable<Prediction['nextPeriod']>), i80: { lo: '2026-11-05', hi: '2026-11-09' }, i95: { lo: '2026-11-03', hi: '2026-11-11' } } } as Prediction;
  it('a day that is both an edge bleed day and in the next 80% range is core and labelled estimated', () => {
    const c = novCell({ prediction: overlap }, '2026-11-05');
    expect(c.periodEstimate).toBe('core');
    expect(c.label).toContain('estimated period day');
    expect(c.label).not.toContain('possible period day');
  });
  it('a plain edge day still says possible, a plain next-period day says predicted', () => {
    expect(novCell({}, '2026-11-05').label).toContain('possible period day, estimate');
    expect(novCell({}, '2026-11-27').label).toContain('predicted period, 80% range');
  });
});

describe('a single fertile day is never drawn or worded (§8.5)', () => {
  const oneDay = { ...novPrediction, fertileDays: [{ date: '2026-11-10' as ISODate, pInWindow: 0.9 }, { date: '2026-11-11' as ISODate, pInWindow: 0.05 }] };
  it('one shown day leaves no band, no estimate line and no row', () => {
    const m = buildMonth({ ...novArgs, prediction: oneDay, loggedDays: new Set() });
    expect(m.cells.some((c) => c.fertile !== undefined)).toBe(false);
    expect(dayEstimates('2026-11-10', { prediction: oneDay, pastOv: [], showEstimate: true, includeUncertain: false, period: false }).some((l) => l.startsWith('Fertile window'))).toBe(false);
    expect(monthRows({ ...novArgs, prediction: oneDay, loggedText: new Map() }).some((r) => r.kind === 'fertile')).toBe(false);
  });
  it('a range of two days is still drawn', () => {
    const two = { ...novPrediction, fertileDays: [{ date: '2026-11-10' as ISODate, pInWindow: 0.9 }, { date: '2026-11-11' as ISODate, pInWindow: 0.6 }] };
    expect(buildMonth({ ...novArgs, prediction: two, loggedDays: new Set() }).cells.filter((c) => c.fertile !== undefined)).toHaveLength(2);
    expect(monthRows({ ...novArgs, prediction: two, loggedText: new Map() }).filter((r) => r.kind === 'fertile')).toHaveLength(1);
  });
});

describe('past ovulation on the grid', () => {
  it('marks the October cycle, one point with a range around it', () => {
    expect(octPast.length).toBeGreaterThan(0);
    const m = octMonth();
    expect(m.cells.filter((c) => c.inMonth && c.ovulation === 'point')).toHaveLength(1);
    expect(m.cells.filter((c) => c.inMonth && c.ovulation === 'range').length).toBeGreaterThan(0);
  });
  it('draws the past cycle\'s fertile window as a graded band of at least two days ending around its ovulation estimate (owner, P8-23)', () => {
    const r = octPast.find((x) => monthOf(x.point) === '2026-10') as PastOvulation;
    const band = octMonth().cells.filter((c) => c.inMonth && c.fertile !== undefined);
    expect(band.length).toBeGreaterThanOrEqual(2);
    expect(band.map((c) => c.date)).toContain(r.point);
    for (const c of band) {
      expect(c.fertile).toBeGreaterThanOrEqual(0.1);
      expect(c.fertile).toBeLessThanOrEqual(1);
      expect(c.date <= r.i80.hi).toBe(true);
      expect(c.label).toMatch(/likelihood of being in the fertile window/);
    }
    expect(Math.max(...band.map((c) => c.fertile as number))).toBeGreaterThan(Math.min(...band.map((c) => c.fertile as number)));
    expect(dayEstimates(r.point, { pastOv: octPast, showEstimate: true, includeUncertain: false, period: false }).some((l) => /^Fertile window: (low|moderate|high) likelihood$/.test(l))).toBe(true);
  });
  it('a past row with no width still gives a window of several days, never one day and never NaN', () => {
    const days = pastFertileDays({ cycleId: 'x', cycleStart: '2026-10-01', point: '2026-10-15', i80: { lo: '2026-10-15', hi: '2026-10-15' }, basis: 'lh', confidence: 'high' });
    expect(days.length).toBeGreaterThan(1);
    for (const d of days) expect(Number.isFinite(d.pInWindow)).toBe(true);
  });
  it('draws none when the estimate gate is off, even with the uncertain setting on', () => {
    const wide = octPast.map((r) => ({ ...r, i80: { lo: addDays(r.point, -9), hi: addDays(r.point, 9) } }));
    expect(marked(octMonth({ showEstimate: false }))).toEqual([]);
    expect(marked(octMonth({ showEstimate: false, includeUncertain: true, pastOv: wide }))).toEqual([]);
  });
  it('a wide past range is drawn only when the uncertain setting is on', () => {
    const wide = octPast.map((r) => ({ ...r, i80: { lo: addDays(r.point, -9), hi: addDays(r.point, 9) } }));
    expect(marked(octMonth({ pastOv: wide }))).toEqual([]);
    expect(marked(octMonth({ pastOv: wide, includeUncertain: true })).length).toBeGreaterThan(0);
    expect(octMonth({ pastOv: wide, includeUncertain: true }).cells.some((c) => c.inMonth && c.fertile !== undefined)).toBe(true);
    // teen mode (the gate off) with the uncertain setting on: no past band either
    expect(octMonth({ pastOv: wide, includeUncertain: true, showEstimate: false }).cells.some((c) => c.fertile !== undefined)).toBe(false);
  });
  it('nothing past while suspended', () => {
    const p = { ...predict(oct, S, '2026-11-10'), suspended: { reason: 'pregnant' } };
    expect(marked(octMonth({ prediction: p }))).toEqual([]);
    const point = (octPast[0] as PastOvulation).point;
    expect(dayEstimates(point, { prediction: p, pastOv: octPast, showEstimate: true, includeUncertain: true, period: false })).toEqual([]);
    expect(monthRows({ ...novArgs, month: '2026-10', today: '2026-11-10', prediction: p, pastOv: octPast, loggedText: new Map(), includeUncertain: true }).some((r) => r.kind === 'ovulation')).toBe(false);
  });
});

describe('uncertain setting never overrides the estimate gate', () => {
  const irregular = hist([24, 38, 31, 45, 27, 36], '2026-10-01');
  const p = predict(irregular, S, today);
  it('includeUncertain with showEstimate false: no marks, no ovulation words, no rows', () => {
    const past = pastOvulations(irregular, S);
    const m = month('2026-10', { prediction: p, periodDays: periodDays(irregular), showEstimate: false, includeUncertain: true, pastOv: past });
    expect(m.cells.some((c) => c.ovulation !== undefined || c.fertile !== undefined)).toBe(false);
    for (const c of m.cells) {
      const lines = dayEstimates(c.date, { prediction: p, pastOv: past, showEstimate: false, includeUncertain: true, period: c.period });
      expect(lines.filter((l) => /vulation|ertile/.test(l))).toEqual([]);
    }
    const rows = monthRows({ ...novArgs, month: '2026-10', today, prediction: p, pastOv: past, showEstimate: false, includeUncertain: true, loggedText: new Map() });
    expect(rows.some((r) => r.kind === 'ovulation' || r.kind === 'fertile')).toBe(false);
  });
  it('includeUncertain with the gate on draws the wide estimate and words it uncertain', () => {
    const m = month('2026-10', { prediction: p, periodDays: periodDays(irregular), includeUncertain: true });
    expect(m.cells.filter((c) => c.ovulation === 'point')).toHaveLength(1);
    expect(m.cells.some((c) => c.fertile !== undefined)).toBe(true);
    expect(m.ovulationUncertain).toBe(true);
    expect(m.ovulationHidden).toBe(false);
    const point = (p.ovulation as NonNullable<typeof p.ovulation>).point;
    expect(dayEstimates(point, { prediction: p, pastOv: [], showEstimate: true, includeUncertain: true, period: false }).some((l) => l.startsWith('Ovulation estimate uncertain'))).toBe(true);
    expect(month('2026-10', { prediction: p, periodDays: periodDays(irregular) }).ovulationHidden).toBe(true);
  });
});

describe('dayEstimates words a past ovulation with its basis', () => {
  const row = (basis: PastOvulation['basis']): PastOvulation => ({ cycleId: 'x', cycleStart: '2026-10-01', point: '2026-10-15', i80: { lo: '2026-10-13', hi: '2026-10-17' }, basis, confidence: 'medium' });
  const words = (basis: PastOvulation['basis'], d: ISODate) => dayEstimates(d, { pastOv: [row(basis)], showEstimate: true, includeUncertain: false, period: false });
  it('names the range and where it came from', () => {
    // the past window is drawn too, so its days also say the band in words (owner, P8-23)
    expect(words('calendar', '2026-10-15')).toEqual(['Fertile window: high likelihood', 'Ovulation estimate 13–17 Oct, most likely this day · worked out from your cycle lengths']);
    expect(words('lh', '2026-10-13')).toEqual(['Fertile window: high likelihood', 'Ovulation estimate 13–17 Oct · from your LH tests']);
    expect(words('lh', '2026-10-18')).toEqual([]);
  });
});

describe('symptom marks', () => {
  it('flags days with a symptom; other logged days keep only `logged`', () => {
    const m = month('2026-10', { symptomDays: new Set<ISODate>(['2026-10-10']) });
    expect(cell(m, '2026-10-10').symptoms).toBe(true);
    expect(cell(m, '2026-10-10').logged).toBe(true);
    expect(cell(m, '2026-10-10').label).toContain('symptoms logged');
    expect(cell(m, '2026-10-01').symptoms).toBe(false);
    expect(cell(m, '2026-10-01').label).toContain('something logged');
  });
  it('cycleDayPast is true up to today and false after', () => {
    const m = month('2026-10');
    expect(cell(m, today).cycleDayPast).toBe(true);
    expect(cell(m, addDays(today, 1)).cycleDayPast).toBe(false);
    expect(cell(m, '2026-10-05').cycleDayPast).toBe(true);
  });
});

describe('monthRows', () => {
  const loggedText = new Map<ISODate, string[]>([['2026-11-01', ['Cramps', 'Headache']], ['2026-11-02', ['Cramps', 'Energy: low (2 of 5)']]]);
  const rows = monthRows({ ...novArgs, loggedText });
  it('lists logged days, the period end, the fertile window once, ovulation and the next period in date order', () => {
    expect(rows.map((r) => [r.label, r.kind])).toEqual([
      ['1', 'logged'], ['2', 'logged'], ['3–5', 'periodEstimate'], ['6–20', 'fertile'], ['14', 'ovulation'], ['26–30', 'nextPeriod'],
    ]);
    expect(rows.map((r) => [r.from, r.to])).toEqual([
      ['2026-11-01', '2026-11-01'], ['2026-11-02', '2026-11-02'], ['2026-11-03', '2026-11-05'], ['2026-11-06', '2026-11-20'], ['2026-11-14', '2026-11-14'], ['2026-11-26', '2026-11-30'],
    ]);
    expect(rows.map((r) => r.estimate)).toEqual([false, false, true, true, true, true]);
  });
  it('words each row', () => {
    expect(rows.map((r) => r.text)).toEqual([
      'Period day 2 · Cramps · Headache',
      'Period day 3 · Cramps · Energy: low (2 of 5)',
      'Period likely ends · estimate from your usual length',
      'Fertile window, estimate · most likely 10–15',
      'Ovulation estimate, range 10–18 · medium confidence',
      'Next period likely · at most 24 Nov – 2 Dec · medium confidence',
    ]);
  });
  it('a past cycle row says where its estimate came from; an empty month says nothing is there', () => {
    const past = monthRows({ ...novArgs, month: '2026-10', today: '2026-11-10', prediction: undefined, periodDays: new Set(), pastOv: [{ cycleId: 'x', cycleStart: '2026-10-01', point: '2026-10-15', i80: { lo: '2026-10-13', hi: '2026-10-17' }, basis: 'lh', confidence: 'medium' }], loggedText: new Map() });
    expect(past.map((r) => [r.label, r.kind, r.text])).toEqual([
      ['8–17', 'fertile', 'Fertile window, estimate · most likely 10–15'],
      ['15', 'ovulation', 'Ovulation estimate, range 13–17 · from your LH tests'],
    ]);
    expect(monthRows({ ...novArgs, month: '2027-03', today: '2026-11-10', prediction: undefined, periodDays: new Set(), loggedText: new Map() })).toEqual([]);
  });
  it('a range that runs into another month carries the month names', () => {
    const r = monthRows({ ...novArgs, prediction: base({ nextPeriod: { point: '2026-11-30', i80: { lo: '2026-11-28', hi: '2026-12-02' }, i95: { lo: '2026-11-26', hi: '2026-12-04' }, confidence: 'low', daysOfDataUsed: 30 } }), periodDays: new Set(), loggedText: new Map() });
    expect(r[0]).toMatchObject({ label: '28 Nov – 2 Dec', from: '2026-11-28', to: '2026-11-30' });
  });
});
