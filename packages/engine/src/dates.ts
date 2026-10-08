// Calendar-day arithmetic on 'YYYY-MM-DD' strings. UTC maths only: no local time zone, no clock.
import type { ISODate } from './types';

const RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY = 86_400_000;

export function parseISO(d: ISODate): number {
  const m = RE.exec(d);
  if (!m) throw new RangeError(`bad ISODate: ${d}`);
  const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, da);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== da) throw new RangeError(`bad ISODate: ${d}`);
  return t;
}
export function toISO(t: number): ISODate {
  const d = new Date(t);
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export function addDays(d: ISODate, n: number): ISODate {
  return toISO(parseISO(d) + Math.round(n) * DAY);
}
/** a - b in whole days. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(a) - parseISO(b)) / DAY);
}
/** 1 = Monday .. 7 = Sunday. */
export function isoWeekday(d: ISODate): number {
  const w = new Date(parseISO(d)).getUTCDay();
  return w === 0 ? 7 : w;
}
