// Month grid view-model (PLAN.md §8.3, §8.5): which marks each day carries. Pure; the screen only draws it.
import { addDays, diffDays, fertileDayProbabilities, type ISODate, isoWeekday, type PastOvulation, type Prediction, Z80 } from '@sanguine/engine';
import type { MoonPhase } from './moon';
import { FERTILE_MIN_P, ovulationDrawable, ovulationUncertain, shownFertileDays, UNCERTAIN_ARM_DAYS } from '@/features/today/fertileShown';
import i18n from '@/i18n';
import type { WeekStart } from '@/i18n/locale';
import { formatLong, formatMonthYear, formatRange } from '@/ui/format';

export interface DayCell {
  date: ISODate;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  /** Day of the cycle (D-100): counted from the latest logged start, never from a predicted one; undefined before the first start or past day 90. */
  cycleDay: number | undefined;
  /** True up to and including today: the number reads semibold, future ones regular (P8-20). */
  cycleDayPast: boolean;
  period: boolean;
  /** An estimated period day, never over a logged one: `core` is the rest of a period in progress up to its likely last day and the next period's 80% range; `edge` is the 95% edge and the unlikely end of a period in progress. */
  periodEstimate: 'core' | 'edge' | undefined;
  /** Probability of being in the fertile window (0.1-1) as underline opacity; undefined = no band on this day. */
  fertile: number | undefined;
  /** The current cycle's estimate or a past cycle's retrospective one (P8-20); always an estimate. */
  ovulation: 'point' | 'range' | undefined;
  /** Anything logged that day. */
  logged: boolean;
  /** At least one symptom logged that day (an accent dot instead of the grey one). */
  symptoms: boolean;
  /** Principal moon phase on this day, only for users whose cycles run close to a lunar month (D-089). */
  moon: MoonPhase | undefined;
  label: string;
}
export interface MonthModel {
  month: string; title: string; cells: DayCell[];
  /** The month alone ("November"), for the month list's heading (calendar spec part 4). */
  monthName: string;
  /** The current ovulation estimate is too wide to be confident (D-098), whether or not it is drawn. */
  ovulationUncertain: boolean;
  /** Uncertain and not drawn: the legend should not name ovulation or the fertile window. */
  ovulationHidden: boolean;
}

export const monthOf = (d: ISODate): string => d.slice(0, 7);
/** Month change for a horizontal swipe on the grid: -1, 0 (spring back) or 1. Runs on the UI thread. */
export function swipeMonthDelta(dx: number, vx: number, width: number): -1 | 0 | 1 {
  'worklet';
  if (width <= 0) return 0;
  const far = Math.abs(dx) > width * 0.3;
  const flick = Math.abs(vx) > 500 && Math.sign(vx) === Math.sign(dx);
  if (Math.sign(vx) === -Math.sign(dx) && Math.abs(vx) > 500) return 0;
  return far || flick ? (dx < 0 ? 1 : -1) : 0;
}

export function shiftMonth(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  const idx = y * 12 + (mo - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

/** Day of the cycle that `date` falls in, counting from the latest logged start on or before it; 1-90, else undefined. */
export function cycleDayOf(starts: readonly ISODate[], date: ISODate): number | undefined {
  let start: ISODate | undefined;
  for (const s of starts) if (s <= date && (!start || s > start)) start = s;
  if (!start) return undefined;
  const n = diffDays(date, start) + 1;
  return n <= 90 ? n : undefined;
}

/** Every day of the shown month with a cycle day carries it as a small number above the date (D-101, P8-20); days outside the month do not.
 *  While estimates are paused (pregnancy, suspended) no day has one: buildMonth leaves `cycleDay` unset (fix plan C5). */
export const showCycleDay = (c: DayCell): boolean => c.inMonth && c.cycleDay !== undefined;
/** The starts the cycle day counts from: none while estimates are paused, so "Day 50 of your cycle" never shows during a pregnancy. */
export const countedStarts = (i: { prediction?: Prediction | undefined; cycleStarts?: readonly ISODate[] | undefined }): readonly ISODate[] => (i.prediction?.suspended ? [] : (i.cycleStarts ?? []));

const t = (k: string, p?: Record<string, string>) => i18n.t(k, p);
// ponytail: a month-only formatter belongs in ui/format.ts (UI kit lane); every English variant writes the month the same
const MONTH_NAME = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' });
const between = (d: ISODate, lo: ISODate, hi: ISODate) => d >= lo && d <= hi;
const wide = (r: PastOvulation) => diffDays(r.i80.hi, r.i80.lo) > 2 * UNCERTAIN_ARM_DAYS;

export interface EstimateInput { prediction?: Prediction | undefined; pastOv: readonly PastOvulation[]; showEstimate: boolean; includeUncertain: boolean }

/**
 * The estimate marks of any day: one rule for the grid, the month list, the day sheet and the day screen (D-104).
 * A suspended prediction draws and says nothing, past cycles included; the estimate gate (teen mode) outranks the uncertain setting.
 */
function estimateMarks(i: EstimateInput, today: ISODate) {
  const p = i.prediction && !i.prediction.suspended ? i.prediction : undefined;
  const next = p?.nextPeriod;
  const cb = p?.currentBleed && today <= p.currentBleed.i80.hi ? p.currentBleed : undefined; // stale once today passes its range
  // the open cycle's start: today's cycle day counted back; days from there that are not logged period days are the unlogged rest of it
  const bleedFrom = cb && p?.currentPhase ? addDays(today, -(p.currentPhase.dayOfCycle - 1)) : today;
  const ov = i.showEstimate ? p?.ovulation : undefined;
  const ovShown = i.showEstimate && ovulationDrawable(p, i.includeUncertain);
  const uncertain = Boolean(ov) && ovulationUncertain(p);
  const past = i.showEstimate && !i.prediction?.suspended ? i.pastOv.filter((r) => i.includeUncertain || !wide(r)) : [];
  const fertile = new Map<ISODate, number>();
  // a band is a range: one shown day (the rest under the opacity floor, or clipped by the engine) is never drawn or worded as a fertile day
  const shownFertile = i.showEstimate ? shownFertileDays(p, { includeUncertain: i.includeUncertain }) : [];
  if (shownFertile.length > 1) for (const f of shownFertile) fertile.set(f.date, Math.min(1, f.pInWindow));
  // past cycles get their fertile window too (owner, P8-23), on the same terms as the current one: `past` is already gated
  for (const r of past) for (const f of pastFertileDays(r)) fertile.set(f.date, Math.max(fertile.get(f.date) ?? 0, f.pInWindow));
  const ovMarks = new Map<ISODate, 'point' | 'range'>();
  const put = (d: ISODate, v: 'point' | 'range') => { if (ovMarks.get(d) !== 'point') ovMarks.set(d, v); };
  for (const r of past) for (let d = r.i80.lo; d <= r.i80.hi; d = addDays(d, 1)) put(d, d === r.point ? 'point' : 'range');
  if (ov && ovShown) for (let d = ov.i80.lo; d <= ov.i80.hi; d = addDays(d, 1)) put(d, d === ov.point ? 'point' : 'range');
  const on = (date: ISODate, period: boolean) => {
    const bleed: 'core' | 'edge' | undefined = !period && cb && between(date, bleedFrom, cb.i80.hi) ? (date <= cb.point ? 'core' : 'edge') : undefined;
    const core80 = !period && Boolean(next && between(date, next.i80.lo, next.i80.hi));
    const edge95 = !period && !core80 && Boolean(next && between(date, next.i95.lo, next.i95.hi));
    const periodEstimate: DayCell['periodEstimate'] = bleed === 'core' || core80 ? 'core' : bleed === 'edge' || edge95 ? 'edge' : undefined;
    return { periodEstimate, bleed, core80, edge95, fertile: fertile.get(date), ovulation: ovMarks.get(date) };
  };
  return { cb, next, ov, uncertain, past, on, bleedFrom, fertile };
}

/** A past cycle's fertile window, rebuilt by the engine's own rule from its retrospective estimate (the row has no sd: its 80% range is
 *  point ± Z80·sd, so sd = half-width / Z80, floored at half a day). Days under the drawing floor are left out; one day left is no window. */
export function pastFertileDays(r: PastOvulation): Array<{ date: ISODate; pInWindow: number }> {
  const sd = Math.max(0.5, diffDays(r.i80.hi, r.i80.lo) / 2 / Z80);
  const days = fertileDayProbabilities({ point: r.point, sd, basis: r.basis }, r.cycleStart, diffDays(r.i80.hi, r.cycleStart) + 1)
    .filter((f) => f.pInWindow >= FERTILE_MIN_P)
    .map((f) => ({ date: f.date, pInWindow: Math.min(1, f.pInWindow) }));
  return days.length > 1 ? days : [];
}

const fertileWord = (f: number) => t(`calendar.fertileWords.${f < 0.25 ? 'low' : f < 0.5 ? 'moderate' : 'high'}`);
const basisWord = (b: PastOvulation['basis']) => t(`day.estimates.basis.${b}`);
const graded = (line: string, c: string | undefined) => [line, c ? t(`confidence.${c}`) : ''].filter(Boolean).join(' · ');

/** What the calendar marks on `date` mean, in words, each with its range and confidence word (D-104), plus an uncertain ovulation range the grid does not draw (D-106) and a past cycle's range with its basis. */
export function dayEstimates(date: ISODate, i: EstimateInput & { period: boolean; /** The day the grid counts from; give the grid's own so the words and the marks agree. Defaults to the prediction's asOf. */ today?: ISODate }): string[] {
  const { cb, next, ov, uncertain, past, on } = estimateMarks(i, i.today ?? i.prediction?.asOf ?? ('' as ISODate));
  const m = on(date, i.period);
  const out: string[] = [];
  if (next && m.core80) out.push(graded(t('day.estimates.period', { range: formatRange(next.i80.lo, next.i80.hi) }), next.confidence));
  if (next && m.edge95) out.push(graded(t('day.estimates.period95', { range: formatRange(next.i95.lo, next.i95.hi) }), next.confidence));
  if (cb && m.bleed) out.push(graded(t('day.estimates.periodEnd', { range: formatRange(cb.i80.lo, cb.i80.hi) }), cb.confidence));
  // uncertain (D-098): hidden unless she opted in (D-115); either way the words say it is uncertain (D-106)
  if (ov && uncertain && between(date, ov.i80.lo, ov.i80.hi)) out.push(graded(t('day.estimates.ovulationUncertain', { range: formatRange(ov.i80.lo, ov.i80.hi) }), ov.confidence));
  else if (ov && m.ovulation) out.push(graded(t(m.ovulation === 'point' ? 'day.estimates.ovulationPoint' : 'day.estimates.ovulation', { range: formatRange(ov.i80.lo, ov.i80.hi) }), ov.confidence));
  if (m.fertile !== undefined) out.push(t('day.estimates.fertile', { word: fertileWord(m.fertile) }));
  for (const r of past) {
    if (!between(date, r.i80.lo, r.i80.hi)) continue;
    const key = wide(r) ? 'ovulationPastUncertain' : date === r.point ? 'ovulationPastPoint' : 'ovulationPast';
    out.push(t(`day.estimates.${key}`, { range: formatRange(r.i80.lo, r.i80.hi), basis: basisWord(r.basis) }));
  }
  return out;
}

/** The open cycle's two headline estimates for a day of that cycle up to today (the frames list them on every such day, logged or not):
 *  when the period in progress ends and when the next one is likely. Empty for any other day and while paused. */
export function cycleHeadlines(date: ISODate, i: EstimateInput & { today: ISODate }): string[] {
  const p = i.prediction && !i.prediction.suspended ? i.prediction : undefined;
  if (!p?.currentPhase || !i.today) return [];
  const openStart = addDays(i.today, -(p.currentPhase.dayOfCycle - 1));
  if (date < openStart || date > i.today) return [];
  const out: string[] = [];
  const cb = p.currentBleed && i.today <= p.currentBleed.i80.hi ? p.currentBleed : undefined;
  if (cb) out.push(graded(t('day.estimates.periodEnd', { range: formatRange(cb.i80.lo, cb.i80.hi) }), cb.confidence));
  const next = p.nextPeriod;
  if (next) out.push(graded(t('day.estimates.period', { range: formatRange(next.i80.lo, next.i80.hi) }), next.confidence));
  return out;
}

export function buildMonth(i: EstimateInput & { month: string; today: ISODate; periodDays: Set<ISODate>; loggedDays: Set<ISODate>; symptomDays: Set<ISODate>; weekStart?: WeekStart; moon?: Map<ISODate, MoonPhase>; cycleStarts?: readonly ISODate[] }): MonthModel {
  const first = `${i.month}-01`;
  const gridStart = addDays(first, -((isoWeekday(first) - 1 + (i.weekStart === 'sun' ? 1 : 0)) % 7));
  const { uncertain, on } = estimateMarks(i, i.today);
  const starts = countedStarts(i);

  const cells: DayCell[] = Array.from({ length: 42 }, (_, k) => {
    const date = addDays(gridStart, k);
    const period = i.periodDays.has(date);
    const { periodEstimate, bleed, fertile: f, ovulation: ovMark } = on(date, period);
    const logged = i.loggedDays.has(date);
    const symptoms = i.symptomDays.has(date);
    const cycleDay = cycleDayOf(starts, date);
    const parts = [formatLong(date)];
    if (cycleDay) parts.push(t('calendar.a11y.cycleDay', { day: String(cycleDay) }));
    if (date === i.today) parts.push(t('calendar.a11y.today'));
    if (period) parts.push(t('calendar.a11y.period'));
    // the words follow the drawn mark; `bleed` only picks between the period-in-progress wording and the next-period wording
    if (periodEstimate === 'core') parts.push(t(bleed ? 'calendar.a11y.periodEstimate' : 'calendar.a11y.predicted'));
    else if (periodEstimate === 'edge') parts.push(t(bleed ? 'calendar.a11y.periodEstimateEdge' : 'calendar.a11y.predicted95'));
    if (f !== undefined) parts.push(t('calendar.a11y.fertile', { word: fertileWord(f) }));
    if (ovMark === 'point') parts.push(t('calendar.a11y.ovulation'));
    const moon = i.moon?.get(date);
    if (symptoms) parts.push(t('calendar.a11y.symptoms'));
    else if (logged) parts.push(t('calendar.a11y.logged'));
    if (moon) parts.push(t(`calendar.a11y.moon.${moon}`));
    return {
      date, day: Number(date.slice(8)), inMonth: monthOf(date) === i.month, isToday: date === i.today, cycleDay, cycleDayPast: date <= i.today, period, periodEstimate,
      fertile: f, ovulation: ovMark, logged, symptoms, moon, label: parts.join(', '),
    };
  });
  return { month: i.month, title: formatMonthYear(first), monthName: MONTH_NAME.format(new Date(`${first}T00:00:00Z`)), cells, ovulationUncertain: uncertain, ovulationHidden: uncertain && !i.includeUncertain };
}

// ---- month list ----

export interface MonthRow {
  /** First and last day of the row inside the shown month: tapping the row selects `from`. */
  from: ISODate;
  to: ISODate;
  kind: 'logged' | 'periodEstimate' | 'fertile' | 'ovulation' | 'nextPeriod';
  text: string;
  estimate: boolean;
  /** The row's dates as written ("3–5", "14", "24 Nov – 2 Dec"): the month name only when the whole range runs into another month. */
  label: string;
}
const KIND_ORDER: Record<MonthRow['kind'], number> = { logged: 0, periodEstimate: 1, fertile: 2, ovulation: 3, nextPeriod: 4 };

/** "3–5" or "14" inside a month; "24 Nov – 2 Dec" when the range crosses months. */
export function dayRange(lo: ISODate, hi: ISODate): string {
  if (monthOf(lo) !== monthOf(hi)) return formatRange(lo, hi);
  return lo === hi ? String(Number(lo.slice(8))) : `${Number(lo.slice(8))}–${Number(hi.slice(8))}`;
}

/** One row per thing in the shown month, in date order: logged days, then estimates (the fertile window as one row, never per day). */
export function monthRows(i: EstimateInput & { month: string; today: ISODate; periodDays: Set<ISODate>; loggedText: Map<ISODate, string[]>; cycleStarts?: readonly ISODate[] }): MonthRow[] {
  const { cb, next, ov, uncertain, past, on, bleedFrom, fertile } = estimateMarks(i, i.today);
  const rows: MonthRow[] = [];
  const inMonth = (d: ISODate) => monthOf(d) === i.month;
  const clip = (lo: ISODate, hi: ISODate): [ISODate, ISODate] | undefined => {
    const a = lo > `${i.month}-01` ? lo : (`${i.month}-01` as ISODate);
    const last = addDays(shiftToFirst(i.month, 1), -1);
    const b = hi < last ? hi : last;
    return a <= b ? [a, b] : undefined;
  };
  const add = (kind: MonthRow['kind'], lo: ISODate, hi: ISODate, text: string, estimate: boolean) => {
    const c = clip(lo, hi);
    if (c) rows.push({ from: c[0], to: c[1], kind, text, estimate, label: dayRange(lo, hi) });
  };
  const confidence = (c: string | undefined) => (c && c !== 'none' ? t(`calendar.list.confidence.${c}`) : '');

  const days = new Set<ISODate>([...i.periodDays, ...i.loggedText.keys()]);
  const starts = countedStarts(i);
  for (const d of [...days].filter(inMonth).sort()) {
    const cd = cycleDayOf(starts, d);
    const period = i.periodDays.has(d) ? [cd ? t('calendar.list.periodDay', { day: String(cd) }) : t('calendar.list.period')] : [];
    const text = [...period, ...(i.loggedText.get(d) ?? [])].join(' · ');
    if (text) add('logged', d, d, text, false);
  }
  if (cb) {
    // the unlogged rest of the period: every estimated day from the open cycle's start to the end of its range
    let lo: ISODate | undefined;
    for (let d = bleedFrom; d <= cb.i80.hi; d = addDays(d, 1)) if (on(d, i.periodDays.has(d)).bleed) { lo = lo ?? d; }
    if (lo) add('periodEstimate', lo, cb.i80.hi, t('calendar.list.periodEnds'), true);
  }
  if (i.showEstimate && !i.prediction?.suspended) {
    // one row per window (a run of consecutive days): this cycle's and any past cycle's that falls in the month
    const runs: ISODate[][] = [];
    for (const d of [...fertile.keys()].sort()) {
      const run = runs[runs.length - 1];
      if (run && addDays(run[run.length - 1] as ISODate, 1) === d) run.push(d);
      else runs.push([d]);
    }
    for (const run of runs) {
      // the likeliest days are a range of at least two, so the list never names a single fertile day
      const top = run.filter((d) => (fertile.get(d) ?? 0) >= 0.5);
      const most = top.length > 1 ? t('calendar.list.fertileMost', { range: dayRange(top[0] as ISODate, top[top.length - 1] as ISODate) }) : '';
      add('fertile', run[0] as ISODate, run[run.length - 1] as ISODate, [t('calendar.list.fertile'), most].filter(Boolean).join(' · '), true);
    }
    if (ov && on(ov.point, false).ovulation) {
      const key = uncertain ? 'ovulationUncertain' : 'ovulation';
      add('ovulation', ov.point, ov.point, [t(`calendar.list.${key}`, { range: dayRange(ov.i80.lo, ov.i80.hi) }), confidence(ov.confidence)].filter(Boolean).join(' · '), true);
    }
    for (const r of past) add('ovulation', r.point, r.point, [t(`calendar.list.${wide(r) ? 'ovulationUncertain' : 'ovulation'}`, { range: dayRange(r.i80.lo, r.i80.hi) }), basisWord(r.basis)].join(' · '), true);
  }
  if (next) add('nextPeriod', next.i80.lo, next.i80.hi, [t('calendar.list.nextPeriod'), t('calendar.list.atMost', { range: dayRange(next.i95.lo, next.i95.hi) }), confidence(next.confidence)].filter(Boolean).join(' · '), true);
  return rows.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : KIND_ORDER[a.kind] - KIND_ORDER[b.kind]));
}
const shiftToFirst = (m: string, delta: number): ISODate => `${shiftMonth(m, delta)}-01` as ISODate;

export type LegendKind = 'cycleDay' | 'period' | 'predicted' | 'predicted95' | 'fertile' | 'ovulation' | 'symptoms' | 'other' | 'moon';
/** The legend names the fertile window and ovulation only while those estimates are shown (PLAN.md §8.6: hidden under 18 by default). */
export const calendarLegend = (showEstimate: boolean): LegendKind[] => (showEstimate ? ['cycleDay', 'period', 'predicted', 'fertile', 'ovulation', 'symptoms', 'other'] : ['cycleDay', 'period', 'predicted', 'symptoms', 'other']);

const LEGEND_DRAWN: Record<LegendKind, (c: DayCell) => boolean> = {
  cycleDay: showCycleDay,
  period: (c) => c.period,
  predicted: (c) => c.periodEstimate === 'core',
  predicted95: (c) => c.periodEstimate === 'edge',
  fertile: (c) => c.fertile !== undefined,
  ovulation: (c) => c.ovulation !== undefined,
  symptoms: (c) => c.symptoms,
  other: (c) => c.logged && !c.symptoms,
  moon: (c) => c.inMonth && c.moon !== undefined,
};
/** The frame's legend order (Calendar-1-Closed, Calendar-Past-Bands): the circles and the band, then the small marks. */
const LEGEND_ORDER: LegendKind[] = ['period', 'predicted', 'predicted95', 'fertile', 'ovulation', 'cycleDay', 'symptoms', 'other', 'moon'];
/** The legend of the shown grid: only the marks it draws (D-118; fix plan C3, C5), inside the estimate gate (calendarLegend). The wider 95% range
 *  has its own entry whenever a day of it is drawn; a paused month (no estimates, no cycle days) names only what she logged. */
export function legendKinds(cells: readonly DayCell[], o: { showEstimate: boolean; cycleDays: boolean }): LegendKind[] {
  const allowed = new Set<LegendKind>([...calendarLegend(o.showEstimate), 'predicted95', 'moon']);
  return LEGEND_ORDER.filter((k) => allowed.has(k) && (k !== 'cycleDay' || o.cycleDays) && cells.some(LEGEND_DRAWN[k]));
}
