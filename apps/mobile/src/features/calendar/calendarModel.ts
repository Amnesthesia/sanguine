// Month grid view-model (PLAN.md §8.3, §8.5): which marks each day carries. Pure; the screen only draws it.
import { addDays, diffDays, type ISODate, isoWeekday, type Prediction } from '@sanguine/engine';
import type { MoonPhase } from './moon';
import { ovulationUncertain, shownFertileDays } from '@/features/today/fertileShown';
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
  period: boolean;
  predicted80: boolean;
  /** In the 95% range but not the 80% range: drawn as a faint outline. */
  predicted95Edge: boolean;
  /** Probability of being in the fertile window (0.1-1) as underline opacity; undefined = no band on this day. */
  fertile: number | undefined;
  ovulation: 'point' | 'range' | undefined;
  logged: boolean;
  /** Principal moon phase on this day, only for users whose cycles run close to a lunar month (D-089). */
  moon: MoonPhase | undefined;
  label: string;
}
export interface MonthModel { month: string; title: string; cells: DayCell[]; ovulationUncertain: boolean }

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

/** Every day of the shown month with a cycle day carries it as a badge (D-101); days outside the month do not. */
export const showCycleDay = (c: DayCell): boolean => c.inMonth && c.cycleDay !== undefined;

const t = (k: string, p?: Record<string, string>) => i18n.t(k, p);
const between = (d: ISODate, lo: ISODate, hi: ISODate) => d >= lo && d <= hi;

type EstimateMarks = Pick<DayCell, 'predicted80' | 'predicted95Edge' | 'fertile' | 'ovulation'>;
/** The estimate marks of any day: one rule for the grid, the selected-day card and the day screen (D-104). */
function estimateMarks(p: Prediction | undefined, showEstimate: boolean) {
  const next = p?.nextPeriod;
  const ov = showEstimate ? p?.ovulation : undefined;
  const uncertain = Boolean(ov) && ovulationUncertain(p);
  const fertile = new Map<ISODate, number>();
  if (showEstimate) for (const f of shownFertileDays(p)) fertile.set(f.date, Math.min(1, f.pInWindow));
  const on = (date: ISODate, period: boolean): EstimateMarks => {
    const predicted80 = !period && Boolean(next && between(date, next.i80.lo, next.i80.hi));
    const predicted95Edge = !period && !predicted80 && Boolean(next && between(date, next.i95.lo, next.i95.hi));
    const ovulation = ov && !uncertain ? (date === ov.point ? 'point' : between(date, ov.i80.lo, ov.i80.hi) ? 'range' : undefined) : undefined;
    return { predicted80, predicted95Edge, fertile: fertile.get(date), ovulation };
  };
  return { uncertain, on };
}

const fertileWord = (f: number) => t(`calendar.fertileWords.${f < 0.25 ? 'low' : f < 0.5 ? 'moderate' : 'high'}`);

/** What the calendar marks on `date` mean, in words, each with its range and confidence word (D-104), plus an uncertain ovulation range the grid does not draw (D-106). */
export function dayEstimates(date: ISODate, p: Prediction | undefined, showEstimate: boolean, period: boolean): string[] {
  const { uncertain, on } = estimateMarks(p, showEstimate);
  const m = on(date, period);
  const graded = (line: string, c: string | undefined) => [line, c ? t(`confidence.${c}`) : ''].filter(Boolean).join(' · ');
  const next = p?.nextPeriod;
  const ov = p?.ovulation;
  const out: string[] = [];
  if (next && m.predicted80) out.push(graded(t('day.estimates.period', { range: formatRange(next.i80.lo, next.i80.hi) }), next.confidence));
  if (next && m.predicted95Edge) out.push(graded(t('day.estimates.period95', { range: formatRange(next.i95.lo, next.i95.hi) }), next.confidence));
  // uncertain (D-098): the grid draws no mark and no band, so only words say where ovulation could fall (owner, D-106)
  if (ov && showEstimate && uncertain && between(date, ov.i80.lo, ov.i80.hi)) out.push(graded(t('day.estimates.ovulationUncertain', { range: formatRange(ov.i80.lo, ov.i80.hi) }), ov.confidence));
  if (ov && m.ovulation) out.push(graded(t(m.ovulation === 'point' ? 'day.estimates.ovulationPoint' : 'day.estimates.ovulation', { range: formatRange(ov.i80.lo, ov.i80.hi) }), ov.confidence));
  if (m.fertile !== undefined) out.push(t('day.estimates.fertile', { word: fertileWord(m.fertile) }));
  return out;
}

export function buildMonth(i: { month: string; today: ISODate; periodDays: Set<ISODate>; loggedDays: Set<ISODate>; prediction: Prediction | undefined; showEstimate: boolean; weekStart?: WeekStart; moon?: Map<ISODate, MoonPhase>; cycleStarts?: readonly ISODate[] }): MonthModel {
  const first = `${i.month}-01`;
  const gridStart = addDays(first, -((isoWeekday(first) - 1 + (i.weekStart === 'sun' ? 1 : 0)) % 7));
  const { uncertain, on } = estimateMarks(i.prediction, i.showEstimate);

  const cells: DayCell[] = Array.from({ length: 42 }, (_, k) => {
    const date = addDays(gridStart, k);
    const period = i.periodDays.has(date);
    const { predicted80: in80, predicted95Edge: in95, fertile: f, ovulation: ovMark } = on(date, period);
    const logged = i.loggedDays.has(date);
    const cycleDay = cycleDayOf(i.cycleStarts ?? [], date);
    const parts = [formatLong(date)];
    if (cycleDay) parts.push(t('calendar.a11y.cycleDay', { day: String(cycleDay) }));
    if (date === i.today) parts.push(t('calendar.a11y.today'));
    if (period) parts.push(t('calendar.a11y.period'));
    if (in80) parts.push(t('calendar.a11y.predicted'));
    else if (in95) parts.push(t('calendar.a11y.predicted95'));
    if (f !== undefined) parts.push(t('calendar.a11y.fertile', { word: fertileWord(f) }));
    if (ovMark === 'point') parts.push(t('calendar.a11y.ovulation'));
    const moon = i.moon?.get(date);
    if (logged) parts.push(t('calendar.a11y.logged'));
    if (moon) parts.push(t(`calendar.a11y.moon.${moon}`));
    return {
      date, day: Number(date.slice(8)), inMonth: monthOf(date) === i.month, isToday: date === i.today, cycleDay, period, predicted80: in80, predicted95Edge: in95,
      fertile: f, ovulation: ovMark, logged, moon, label: parts.join(', '),
    };
  });
  return { month: i.month, title: formatMonthYear(first), cells, ovulationUncertain: uncertain };
}

export type LegendKind = 'cycleDay' | 'period' | 'predicted' | 'fertile' | 'ovulation' | 'logged' | 'moon';
/** The legend names the fertile window and ovulation only while those estimates are shown (PLAN.md §8.6: hidden under 18 by default). */
export const calendarLegend = (showEstimate: boolean): LegendKind[] => (showEstimate ? ['cycleDay', 'period', 'predicted', 'fertile', 'ovulation', 'logged'] : ['cycleDay', 'period', 'predicted', 'logged']);
