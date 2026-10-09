// Pregnancy view on Today (P8-5, roadmap R3-2, D-081): gestational week and day, and the due date as a range, never one day (PLAN.md §4.1).
// Counted from a due date the user entered, else from the last period start on or before the day the pregnancy was set. Pure.
import { addDays, diffDays, type ISODate } from '@sanguine/engine';

const TERM_DAYS = 280; // Naegele: the due date is 40 weeks after the last period start
const DUE_LO = 37 * 7; // the due date as a range: term is 37 to 42 weeks (ACOG/WHO definition of term)
const DUE_HI = 42 * 7;
const MAX_DAYS = 44 * 7; // beyond this the stored dates are stale or mistyped

export interface PregnancyView { week: number; day: number; from: 'due' | 'period'; due: { lo: ISODate; hi: ISODate } }

export function pregnancyModel(o: { since: ISODate; cycleStarts: ISODate[]; dueDate?: ISODate | undefined; today: ISODate }): PregnancyView | undefined {
  const lastStart = [...o.cycleStarts].filter((s) => s <= o.since).sort().at(-1);
  const lmp = o.dueDate ? addDays(o.dueDate, -TERM_DAYS) : lastStart;
  if (!lmp) return undefined;
  const days = diffDays(o.today, lmp);
  if (days < 0 || days > MAX_DAYS) return undefined;
  return { week: Math.floor(days / 7), day: days % 7, from: o.dueDate ? 'due' : 'period', due: { lo: addDays(lmp, DUE_LO), hi: addDays(lmp, DUE_HI) } };
}
