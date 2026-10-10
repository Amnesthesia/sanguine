// One rule for every surface that draws or exports the fertile window: Today's ring, the calendar band, reminders and the .ics export.
import { diffDays, type Prediction } from '@sanguine/engine';

/** §8.5: "arms longer than 6 days" read "estimate uncertain"; an arm is half the 80% range (owner, D-098). */
export const UNCERTAIN_ARM_DAYS = 6;
/** Days below this probability are not drawn (§8.5 opacity floor); the engine keeps rows down to 0.01. */
export const FERTILE_MIN_P = 0.1;

export const ovulationUncertain = (p: Prediction | undefined): boolean =>
  Boolean(p?.ovulation && diffDays(p.ovulation.i80.hi, p.ovulation.i80.lo) > 2 * UNCERTAIN_ARM_DAYS);

/** The fertile days to show: none while the ovulation estimate is uncertain (§9.8 Today state 4 and Calendar irregular state, D-098). */
export const shownFertileDays = (p: Prediction | undefined): NonNullable<Prediction['fertileDays']> =>
  ovulationUncertain(p) ? [] : (p?.fertileDays ?? []).filter((f) => f.pInWindow >= FERTILE_MIN_P);
