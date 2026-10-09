// Month grid view-model (PLAN.md §8.3, §8.5): which marks each day carries. Pure; the screen only draws it.
import { addDays, diffDays, type ISODate, isoWeekday, type Prediction } from '@sanguine/engine';
import i18n from '@/i18n';
import type { WeekStart } from '@/i18n/locale';
import { formatLong, formatMonthYear } from '@/ui/format';

const FERTILE_MIN = 0.1;
const UNCERTAIN_SPAN_DAYS = 6;

export interface DayCell {
  date: ISODate;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  period: boolean;
  predicted80: boolean;
  /** In the 95% range but not the 80% range: drawn as a faint outline. */
  predicted95Edge: boolean;
  /** Probability of being in the fertile window (0.1-1) as underline opacity; undefined = no band on this day. */
  fertile: number | undefined;
  ovulation: 'point' | 'range' | undefined;
  logged: boolean;
  label: string;
}
export interface MonthModel { month: string; title: string; cells: DayCell[]; ovulationUncertain: boolean }

export const monthOf = (d: ISODate): string => d.slice(0, 7);
export function shiftMonth(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  const idx = y * 12 + (mo - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

const t = (k: string, p?: Record<string, string>) => i18n.t(k, p);
const between = (d: ISODate, lo: ISODate, hi: ISODate) => d >= lo && d <= hi;

export function buildMonth(i: { month: string; today: ISODate; periodDays: Set<ISODate>; loggedDays: Set<ISODate>; prediction: Prediction | undefined; showEstimate: boolean; weekStart?: WeekStart }): MonthModel {
  const first = `${i.month}-01`;
  const gridStart = addDays(first, -((isoWeekday(first) - 1 + (i.weekStart === 'sun' ? 1 : 0)) % 7));
  const p = i.prediction;
  const next = p?.nextPeriod;
  const ov = i.showEstimate ? p?.ovulation : undefined;
  const uncertain = Boolean(ov && diffDays(ov.i80.hi, ov.i80.lo) > UNCERTAIN_SPAN_DAYS);
  const fertile = new Map<ISODate, number>();
  if (i.showEstimate) for (const f of p?.fertileDays ?? []) if (f.pInWindow >= FERTILE_MIN) fertile.set(f.date, Math.min(1, f.pInWindow));

  const cells: DayCell[] = Array.from({ length: 42 }, (_, k) => {
    const date = addDays(gridStart, k);
    const period = i.periodDays.has(date);
    const in80 = !period && Boolean(next && between(date, next.i80.lo, next.i80.hi));
    const in95 = !period && !in80 && Boolean(next && between(date, next.i95.lo, next.i95.hi));
    const f = fertile.get(date);
    let ovMark: DayCell['ovulation'];
    if (ov && !uncertain) ovMark = date === ov.point ? 'point' : between(date, ov.i80.lo, ov.i80.hi) ? 'range' : undefined;
    const logged = i.loggedDays.has(date);
    const parts = [formatLong(date)];
    if (date === i.today) parts.push(t('calendar.a11y.today'));
    if (period) parts.push(t('calendar.a11y.period'));
    if (in80) parts.push(t('calendar.a11y.predicted'));
    else if (in95) parts.push(t('calendar.a11y.predicted95'));
    if (f !== undefined) parts.push(t('calendar.a11y.fertile', { word: t(`calendar.fertileWords.${f < 0.25 ? 'low' : f < 0.5 ? 'moderate' : 'high'}`) }));
    if (ovMark === 'point') parts.push(t('calendar.a11y.ovulation'));
    if (logged) parts.push(t('calendar.a11y.logged'));
    return {
      date, day: Number(date.slice(8)), inMonth: monthOf(date) === i.month, isToday: date === i.today, period, predicted80: in80, predicted95Edge: in95,
      fertile: f, ovulation: ovMark, logged, label: parts.join(', '),
    };
  });
  return { month: i.month, title: formatMonthYear(first), cells, ovulationUncertain: uncertain };
}

export type LegendKind = 'period' | 'predicted' | 'fertile' | 'ovulation' | 'logged';
/** The legend names the fertile window and ovulation only while those estimates are shown (PLAN.md §8.6: hidden under 18 by default). */
export const calendarLegend = (showEstimate: boolean): LegendKind[] => (showEstimate ? ['period', 'predicted', 'fertile', 'ovulation', 'logged'] : ['period', 'predicted', 'logged']);
