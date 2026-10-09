// Onboarding rules and the writes they produce (PLAN.md §8.3, §8.6). Pure: the screen only collects `Answers`.
import type { ISODate } from '@sanguine/engine';
import type { NewEvent } from '@/data/events';
import type { Profile } from '@/data/project';

import { type Check, MIN_AGE, validateBirthDate } from '@/data/age';

export { MIN_AGE };
export const TOTAL_STEPS = 5;

export type LifeChoice = 'none' | 'hormonal' | 'postHormonal' | 'pregnant' | 'postpartum' | 'afterLoss' | 'perimenopause' | 'irregular';
export const LIFE_CHOICES: LifeChoice[] = ['none', 'hormonal', 'postHormonal', 'pregnant', 'postpartum', 'afterLoss', 'perimenopause', 'irregular'];
export const METHODS = ['combined_pill', 'pop', 'implant', 'injection', 'hormonal_iud', 'ring', 'patch'] as const;
export type Method = (typeof METHODS)[number];

export interface Answers {
  /** Date of birth (D-054). The engine still receives only the year. */
  birthDate: ISODate | undefined;
  menarcheYear: number | undefined;
  lastPeriod: ISODate | undefined;
  usualLength: number | undefined;
  lifeState: LifeChoice;
  method: Method;
  /** Date for the chosen life state: when it started, you stopped, or you gave birth. */
  stateDate: ISODate;
  breastfeeding: boolean;
  consent: boolean;
}

const OK: Check = { ok: true };

export function validateMenarcheYear(m: number | undefined, birthDate: ISODate | undefined, year: number): Check {
  const birthYear = birthDate === undefined ? undefined : Number(birthDate.slice(0, 4));
  if (m === undefined) return OK;
  if (!Number.isInteger(m) || m > year || (birthYear !== undefined && m - birthYear < 8)) return { ok: false, reason: 'invalid' };
  return OK;
}
export function validateUsualLength(n: number | undefined): Check {
  if (n === undefined) return OK;
  return Number.isInteger(n) && n >= 15 && n <= 90 ? OK : { ok: false, reason: 'invalid' };
}

/** Only age is required (step index 1); the last step needs the data-handling acknowledgement. */
export function canContinue(step: number, a: Answers, today: ISODate): boolean {
  if (step === 1) return validateBirthDate(a.birthDate, today).ok && validateMenarcheYear(a.menarcheYear, a.birthDate, Number(today.slice(0, 4))).ok;
  if (step === 2) return validateUsualLength(a.usualLength).ok;
  if (step === TOTAL_STEPS - 1) return a.consent;
  return true;
}

export function buildOnboardingWrites(a: Answers, today: ISODate): { profile: Profile; events: NewEvent[] } {
  const profile: Profile = {
    ...(a.birthDate !== undefined ? { birthDate: a.birthDate, birthYear: Number(a.birthDate.slice(0, 4)) } : {}),
    ...(a.menarcheYear !== undefined ? { menarcheYear: a.menarcheYear } : {}),
    ...(a.usualLength !== undefined ? { usualCycleLength: a.usualLength } : {}),
  };
  const events: NewEvent[] = [];
  if (a.lastPeriod && a.lastPeriod <= today) events.push({ kind: 'period.start', payload: { day: a.lastPeriod } });
  const set = (kind: string, detail: Record<string, unknown>, day: ISODate) => events.push({ kind: 'life_state.set', payload: { kind, detail, day } });
  switch (a.lifeState) {
    case 'hormonal': set('hormonal_contraception', { method: a.method }, a.stateDate); break;
    case 'postHormonal': set('post_contraception', { method: a.method }, a.stateDate); break;
    case 'pregnant': set('pregnant', {}, a.stateDate); break;
    case 'postpartum': set('postpartum', { breastfeeding: a.breastfeeding, after: 'birth' }, a.stateDate); break;
    case 'afterLoss': set('postpartum', { breastfeeding: false, after: 'loss' }, a.stateDate); break; // engine: the postpartum rule (D-053)
    case 'perimenopause': set('perimenopause', {}, a.stateDate); break;
    case 'irregular': set('known_irregular', { reason: 'other' }, a.stateDate); break;
    case 'none': break;
  }
  return { profile, events };
}
