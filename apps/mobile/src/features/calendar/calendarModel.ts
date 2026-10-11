// Month grid view-model (PLAN.md §8.3, §8.5): which marks each day carries. Pure; the screen only draws it.
import { addDays, diffDays, type ISODate, isoWeekday, type Prediction } from '@sanguine/engine';
import type { MoonPhase } from './moon';
import { ovulationUncertain, shownFertileDays } from '@/features/today/fertileShown';
import i18n from '@/i18n';
import type { WeekStart } from '@/i18n/locale';
import { formatLong, formatMonthYear } from '@/ui/format';


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

export function buildMonth(i: { month: string; today: ISODate; periodDays: Set<ISODate>; loggedDays: Set<ISODate>; prediction: Prediction | undefined; showEstimate: boolean; weekStart?: WeekStart; moon?: Map<ISODate, MoonPhase>; cycleStarts?: readonly ISODate[] }): MonthModel {
  const first = `${i.month}-01`;
  const gridStart = addDays(first, -((isoWeekday(first) - 1 + (i.weekStart === 'sun' ? 1 : 0)) % 7));
  const p = i.prediction;
  const next = p?.nextPeriod;
  const ov = i.showEstimate ? p?.ovulation : undefined;
  const uncertain = Boolean(ov) && ovulationUncertain(p);
  const fertile = new Map<ISODate, number>();
  if (i.showEstimate) for (const f of shownFertileDays(p)) fertile.set(f.date, Math.min(1, f.pInWindow));

  const cells: DayCell[] = Array.from({ length: 42 }, (_, k) => {
    const date = addDays(gridStart, k);
    const period = i.periodDays.has(date);
    const in80 = !period && Boolean(next && between(date, next.i80.lo, next.i80.hi));
    const in95 = !period && !in80 && Boolean(next && between(date, next.i95.lo, next.i95.hi));
    const f = fertile.get(date);
    let ovMark: DayCell['ovulation'];
    if (ov && !uncertain) ovMark = date === ov.point ? 'point' : between(date, ov.i80.lo, ov.i80.hi) ? 'range' : undefined;
    const logged = i.loggedDays.has(date);
    const cycleDay = cycleDayOf(i.cycleStarts ?? [], date);
    const parts = [formatLong(date)];
    if (cycleDay) parts.push(t('calendar.a11y.cycleDay', { day: String(cycleDay) }));
    if (date === i.today) parts.push(t('calendar.a11y.today'));
    if (period) parts.push(t('calendar.a11y.period'));
    if (in80) parts.push(t('calendar.a11y.predicted'));
    else if (in95) parts.push(t('calendar.a11y.predicted95'));
    if (f !== undefined) parts.push(t('calendar.a11y.fertile', { word: t(`calendar.fertileWords.${f < 0.25 ? 'low' : f < 0.5 ? 'moderate' : 'high'}`) }));
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
