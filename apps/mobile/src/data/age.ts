// Age rules from a date of birth (PLAN.md §2.4, §8.6, D-054). Pure.
// The minimum age is a hard rule, so it is checked on the exact date: the earlier year-only check let someone turning 13
// later in the year through (D-029). Profiles made before dates were asked still carry only a year and fall back to it.
import type { ISODate } from '@sanguine/engine';

export const MIN_AGE = 13;
const TEEN_UNTIL = 18;
const MAX_AGE = 120;

export type Check = { ok: true } | { ok: false; reason: 'required' | 'tooYoung' | 'invalid' };

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
function parts(iso: string): [number, number, number] | undefined {
  const m = ISO.exec(iso);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const real = new Date(Date.UTC(y, mo - 1, d));
  return real.getUTCFullYear() === y && real.getUTCMonth() === mo - 1 && real.getUTCDate() === d ? [y, mo, d] : undefined;
}

/** Whole years on `today`; a 29 February birthday counts from 1 March in a common year. */
export function ageOn(birthDate: ISODate, today: ISODate): number {
  const b = parts(birthDate) as [number, number, number];
  const t = parts(today) as [number, number, number];
  let age = t[0] - b[0];
  if (t[1] < b[1] || (t[1] === b[1] && t[2] < b[2])) age--;
  return age;
}

export function validateBirthDate(date: string | undefined, today: ISODate): Check {
  if (date === undefined) return { ok: false, reason: 'required' };
  if (!parts(date)) return { ok: false, reason: 'invalid' };
  if (date > today) return { ok: false, reason: 'tooYoung' };
  const age = ageOn(date, today);
  if (age > MAX_AGE) return { ok: false, reason: 'invalid' };
  return age < MIN_AGE ? { ok: false, reason: 'tooYoung' } : { ok: true };
}

/** Teen mode: 13 to 17. Uses the exact date when stored, the year otherwise. */
export function isTeenOn(p: { birthDate?: ISODate | undefined; birthYear?: number | undefined }, today: ISODate): boolean {
  if (p.birthDate !== undefined) return ageOn(p.birthDate, today) < TEEN_UNTIL;
  return p.birthYear !== undefined && Number(today.slice(0, 4)) - p.birthYear < TEEN_UNTIL;
}

/** Where the selector starts: thirty years back, clamped for 29 February. */
export function defaultBirthDate(today: ISODate): ISODate {
  const [y, m, d] = parts(today) as [number, number, number];
  const ty = y - 30;
  const last = new Date(Date.UTC(ty, m, 0)).getUTCDate();
  return `${String(ty).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
