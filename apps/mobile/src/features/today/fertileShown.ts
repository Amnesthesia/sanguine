// One rule for every surface that draws or exports the fertile window: Today's ring, the calendar band, reminders and the .ics export.
import { diffDays, type Prediction } from '@sanguine/engine';

/** §8.5: "arms longer than 6 days" read "estimate uncertain"; an arm is half the 80% range (owner, D-098). */
export const UNCERTAIN_ARM_DAYS = 6;
/** Days below this probability are not drawn (§8.5 opacity floor); the engine keeps rows down to 0.01. */
export const FERTILE_MIN_P = 0.1;

export const ovulationUncertain = (p: Prediction | undefined): boolean =>
  Boolean(p?.ovulation && diffDays(p.ovulation.i80.hi, p.ovulation.i80.lo) > 2 * UNCERTAIN_ARM_DAYS);

/** Callers still apply the effective showOvulationEstimate gate, including teen mode. */
export const ovulationDrawable = (p: Prediction | undefined, includeUncertain: boolean): boolean =>
  Boolean(p?.ovulation) && (includeUncertain || !ovulationUncertain(p));

/** Wide estimates require an in-app opt-in; reminders, widgets and exports keep the default (D-115). A window is a range: one day above the
 *  floor is not shown at all, so no surface draws or words a single fertile day (CLAUDE.md). */
export function shownFertileDays(p: Prediction | undefined, opts?: { includeUncertain?: boolean }): NonNullable<Prediction['fertileDays']> {
  const days = !opts?.includeUncertain && ovulationUncertain(p) ? [] : (p?.fertileDays ?? []).filter((f) => f.pInWindow >= FERTILE_MIN_P);
  return days.length > 1 ? days : [];
}
