// What to schedule (PLAN.md §6.1, §8.8, D-090, D-152). Local reminders only: no push, no network. The user keeps a list of rules,
// "N days before <period | ovulation | fertile window | early or late follicular or luteal phase>", each fired at 09:00 on the start of that
// estimate's range minus N days.
import { addDays, type CycleRecord, diffDays, type ISODate, type Prediction } from '@sanguine/engine';
import { phaseOn } from '@/features/guidance/guidance';
import { ovulationUncertain, shownFertileDays } from '@/features/today/fertileShown';

export const REMINDER_HOUR = 9;
export type PhaseEvent = 'follicularEarly' | 'follicularLate' | 'lutealEarly' | 'lutealLate';
export type ReminderEvent = 'period' | 'ovulation' | 'fertile' | PhaseEvent;
export const PHASE_EVENTS: PhaseEvent[] = ['follicularEarly', 'follicularLate', 'lutealEarly', 'lutealLate'];
export const REMINDER_EVENTS: ReminderEvent[] = ['period', 'ovulation', 'fertile', ...PHASE_EVENTS];
export const isPhaseEvent = (e: string): e is PhaseEvent => (PHASE_EVENTS as string[]).includes(e);
/** Fertility events are hidden under 18 until unlocked, and whenever the ovulation estimate is hidden (§8.6). The phase events are not: they
 *  name no ovulation or fertile day (a copy test holds that), and the phase card they follow is shown to teens too (D-107, D-152). */
export const FERTILITY_EVENTS: ReminderEvent[] = ['ovulation', 'fertile'];
export const REMINDER_DAYS = [0, 1, 2, 3, 5, 7] as const;
export const MAX_RULES = 12;
/** The longest own reminder text kept (D-152): a notification shows about this much before it cuts. */
export const MAX_TEXT = 120;
/** Days at or above this probability of being in the fertile window start the fertile range (the §8.3 card threshold). */
const FERTILE_MIN_P = 0.2;
/** How far past today the phase scan looks: the longest cycle the engine admits plus a margin. */
const SCAN_DAYS = 70;

export interface ReminderRule { id: string; days: number; event: ReminderEvent; /** Own wording, shown as written (D-152). Empty or absent: the built-in text. */ text?: string }
export const DEFAULT_RULES: ReminderRule[] = [
  { id: 'default-follicularEarly-0', days: 0, event: 'follicularEarly' },
  { id: 'default-ovulation-3', days: 3, event: 'ovulation' },
  { id: 'default-lutealEarly-0', days: 0, event: 'lutealEarly' },
  { id: 'default-period-3', days: 3, event: 'period' },
  { id: 'default-period-1', days: 1, event: 'period' },
];
export interface ReminderPlan { id: string; event: ReminderEvent | 'late'; fireDate: ISODate; hour: number; descriptive: boolean; lo: number; hi: number; text?: string }

/** The text kept for a rule: trimmed, at most MAX_TEXT characters, undefined when empty. */
export function cleanText(s: string | undefined): string | undefined {
  const t = s?.trim().slice(0, MAX_TEXT).trim();
  return t ? t : undefined;
}

/** What the phase events need: Today's phase rule (D-107) with the same inputs. */
export interface PhaseContext { cycles: CycleRecord[]; showEstimate: boolean; today: ISODate }

/** The first and last day of the follicular run and of the luteal run (premenstrual days count as luteal) in the current cycle, from phaseOn(),
 *  so a reminder and Today's phase card never disagree. Empty while phaseOn says `general` (missing ovulation, a late period), and while the ovulation
 *  estimate is uncertain: Today then places the days outside the wide range (D-162), but the runs would be cut short, so reminders stay silent as D-152 set. */
function phaseRuns(p: Prediction, c: PhaseContext): { follicular?: { lo: ISODate; hi: ISODate }; luteal?: { lo: ISODate; hi: ISODate } } {
  if (ovulationUncertain(p)) return {};
  let start: ISODate | undefined;
  for (const r of c.cycles) if (r.start <= c.today && (!start || r.start > start)) start = r.start;
  if (!start) return {};
  const runs: { follicular?: { lo: ISODate; hi: ISODate }; luteal?: { lo: ISODate; hi: ISODate } } = {};
  for (let i = 0; i <= SCAN_DAYS + diffDays(c.today, start); i++) {
    const date = addDays(start, i);
    const g = phaseOn({ date, today: c.today, prediction: p, cycles: c.cycles, showEstimate: c.showEstimate });
    const key = g?.phase === 'follicular' ? 'follicular' : g?.phase === 'luteal' || g?.phase === 'premenstrual' ? 'luteal' : undefined;
    if (!key) { if (runs.luteal) break; continue; } // the luteal run is the last one in a cycle
    const run = runs[key];
    if (run && addDays(run.hi, 1) === date) run.hi = date;
    else if (!run) runs[key] = { lo: date, hi: date };
  }
  return runs;
}

/** Early is the first half of a phase's run, late the second half (the midpoint belongs to late). A run under two days has neither. */
function phaseRange(p: Prediction, c: PhaseContext, event: PhaseEvent): { lo: ISODate; hi: ISODate } | undefined {
  const run = phaseRuns(p, c)[event.startsWith('follicular') ? 'follicular' : 'luteal'];
  if (!run) return undefined;
  const len = diffDays(run.hi, run.lo) + 1;
  if (len < 2) return undefined;
  const mid = addDays(run.lo, Math.floor(len / 2));
  return event.endsWith('Early') ? { lo: run.lo, hi: addDays(mid, -1) } : { lo: mid, hi: run.hi };
}

/** The range a rule counts back from: the next period's or ovulation's 80% interval, the fertile days (never a single day), or half a phase. */
export function eventRange(p: Prediction, event: ReminderEvent, phase?: PhaseContext): { lo: ISODate; hi: ISODate } | undefined {
  if (event === 'period') return p.nextPeriod?.i80;
  if (event === 'ovulation') return p.ovulation && p.ovulation.confidence !== 'none' ? p.ovulation.i80 : undefined;
  if (isPhaseEvent(event)) return phase ? phaseRange(p, phase, event) : undefined;
  const days = shownFertileDays(p).filter((d) => d.pInWindow >= FERTILE_MIN_P).map((d) => d.date).sort();
  return days.length >= 2 ? { lo: days[0] as ISODate, hi: days[days.length - 1] as ISODate } : undefined;
}

/** Every reminder to schedule now, earliest first. Nothing when off, paused, without a prediction, or once a moment has passed. */
/** `late`: one reminder the morning after the next period's 80% range ends, the same day Today starts saying the period is later than
 *  likely. Logging the period moves the estimate, and the next schedule drops it. `phase` is needed for the phase rules; without it they are skipped. */
export function planReminders(p: Prediction | undefined, rules: ReminderRule[], o: { enabled: boolean; late: boolean; descriptive: boolean; fertility: boolean; today: ISODate; nowHour: number; phase?: Omit<PhaseContext, 'today'> }): ReminderPlan[] {
  if (!o.enabled || !p || p.suspended) return [];
  const out: ReminderPlan[] = [];
  const phase = o.phase ? { ...o.phase, today: o.today } : undefined;
  for (const r of rules) {
    if (FERTILITY_EVENTS.includes(r.event) && !o.fertility) continue;
    const range = eventRange(p, r.event, phase);
    if (!range) continue;
    const fireDate = addDays(range.lo, -r.days);
    if (fireDate < o.today || (fireDate === o.today && o.nowHour >= REMINDER_HOUR)) continue;
    const text = cleanText(r.text);
    out.push({ id: r.id, event: r.event, fireDate, hour: REMINDER_HOUR, descriptive: o.descriptive, lo: diffDays(range.lo, fireDate), hi: diffDays(range.hi, fireDate), ...(text ? { text } : {}) });
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
  if (isPhaseEvent(r.event)) return { key: `notifications.body.${r.event}`, params: {} };
  if (r.lo === 0) return { key: `notifications.body.${r.event}Now`, params: { hi: r.hi } };
  return { key: `notifications.body.${r.event}`, params: { lo: r.lo, hi: r.hi } };
}

/** The notification body (D-152): the user's own text as written, else the detailed text when details are on, else the discreet default.
 *  A phase reminder's discreet default is a feeling check-in with no health word; every other reminder's is "A reminder" (§8.8). */
export function reminderBody(r: ReminderPlan, t: (key: string, params?: Record<string, number>) => string): string {
  if (r.text) return r.text;
  if (r.descriptive) { const x = reminderText(r); return t(x.key, x.params); }
  return t(isPhaseEvent(r.event) ? 'notifications.discreetBody.phase' : 'notifications.defaultBody');
}
