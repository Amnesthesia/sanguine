// What to schedule (PLAN.md §6.1, §8.8). One local reminder the day before the 80% range starts, at 09:00; no push, no network.
import { addDays, diffDays, type ISODate, type Prediction } from '@sanguine/engine';

export const REMINDER_HOUR = 9;
export interface ReminderPlan { fireDate: ISODate; hour: number; descriptive: boolean; lo: number; hi: number }

/** Returns the reminder to schedule, or undefined (feature off, estimates paused, no prediction, or the day has passed). */
export function planReminder(p: Prediction | undefined, enabled: boolean, descriptive: boolean, today: ISODate, nowHour: number): ReminderPlan | undefined {
  if (!enabled || !p || p.suspended || !p.nextPeriod) return undefined;
  const fireDate = addDays(p.nextPeriod.i80.lo, -1);
  if (fireDate < today || (fireDate === today && nowHour >= REMINDER_HOUR)) return undefined;
  return { fireDate, hour: REMINDER_HOUR, descriptive, lo: diffDays(p.nextPeriod.i80.lo, fireDate), hi: diffDays(p.nextPeriod.i80.hi, fireDate) };
}
