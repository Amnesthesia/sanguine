// What to schedule (PLAN.md §6.1, §8.8, D-090). Local reminders only: no push, no network. The user keeps a list of rules,
// "N days before <period | ovulation | fertile window>", each fired at 09:00 on the start of that estimate's 80% range minus N days.
import { addDays, diffDays, type ISODate, type Prediction } from '@sanguine/engine';

export const REMINDER_HOUR = 9;
export type ReminderEvent = 'period' | 'ovulation' | 'fertile';
export const REMINDER_EVENTS: ReminderEvent[] = ['period', 'ovulation', 'fertile'];
/** Fertility events are hidden under 18 until unlocked, and whenever the ovulation estimate is hidden (§8.6). */
export const FERTILITY_EVENTS: ReminderEvent[] = ['ovulation', 'fertile'];
export const REMINDER_DAYS = [0, 1, 2, 3, 5, 7] as const;
export const MAX_RULES = 8;
/** Days at or above this probability of being in the fertile window start the fertile range (the §8.3 card threshold). */
const FERTILE_MIN_P = 0.2;

export interface ReminderRule { id: string; days: number; event: ReminderEvent }
export const DEFAULT_RULES: ReminderRule[] = [
  { id: 'default-ovulation-3', days: 3, event: 'ovulation' },
  { id: 'default-period-3', days: 3, event: 'period' },
  { id: 'default-period-1', days: 1, event: 'period' },
];
export interface ReminderPlan { id: string; event: ReminderEvent | 'late'; fireDate: ISODate; hour: number; descriptive: boolean; lo: number; hi: number }

/** The range a rule counts back from: the next period's or ovulation's 80% interval, or the fertile days (never a single day). */
export function eventRange(p: Prediction, event: ReminderEvent): { lo: ISODate; hi: ISODate } | undefined {
  if (event === 'period') return p.nextPeriod?.i80;
  if (event === 'ovulation') return p.ovulation && p.ovulation.confidence !== 'none' ? p.ovulation.i80 : undefined;
  const days = (p.fertileDays ?? []).filter((d) => d.pInWindow >= FERTILE_MIN_P).map((d) => d.date).sort();
  return days.length >= 2 ? { lo: days[0] as ISODate, hi: days[days.length - 1] as ISODate } : undefined;
}

/** Every reminder to schedule now, earliest first. Nothing when off, paused, without a prediction, or once a moment has passed. */
/** `late`: one reminder the morning after the next period's 80% range ends, the same day Today starts saying the period is later than
 *  likely. Logging the period moves the estimate, and the next schedule drops it. */
export function planReminders(p: Prediction | undefined, rules: ReminderRule[], o: { enabled: boolean; late: boolean; descriptive: boolean; fertility: boolean; today: ISODate; nowHour: number }): ReminderPlan[] {
  if (!o.enabled || !p || p.suspended) return [];
  const out: ReminderPlan[] = [];
  for (const r of rules) {
    if (FERTILITY_EVENTS.includes(r.event) && !o.fertility) continue;
    const range = eventRange(p, r.event);
    if (!range) continue;
    const fireDate = addDays(range.lo, -r.days);
    if (fireDate < o.today || (fireDate === o.today && o.nowHour >= REMINDER_HOUR)) continue;
    out.push({ id: r.id, event: r.event, fireDate, hour: REMINDER_HOUR, descriptive: o.descriptive, lo: diffDays(range.lo, fireDate), hi: diffDays(range.hi, fireDate) });
  }
  const lateDay = p.nextPeriod ? addDays(p.nextPeriod.i80.hi, 1) : undefined;
  if (o.late && lateDay && (lateDay > o.today || (lateDay === o.today && o.nowHour < REMINDER_HOUR))) {
    out.push({ id: 'late', event: 'late', fireDate: lateDay, hour: REMINDER_HOUR, descriptive: o.descriptive, lo: 0, hi: 0 });
  }
  return out.sort((a, b) => (a.fireDate < b.fireDate ? -1 : a.fireDate > b.fireDate ? 1 : 0));
}

/** The copy key and values for a reminder's text when details are on. */
export function reminderText(r: Pick<ReminderPlan, 'event' | 'lo' | 'hi'>): { key: string; params: Record<string, number> } {
  if (r.event === 'late') return { key: 'notifications.body.late', params: {} };
  if (r.lo === 0) return { key: `notifications.body.${r.event}Now`, params: { hi: r.hi } };
  return { key: `notifications.body.${r.event}`, params: { lo: r.lo, hi: r.hi } };
}
