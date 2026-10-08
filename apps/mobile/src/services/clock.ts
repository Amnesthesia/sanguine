import * as Crypto from 'expo-crypto';
import type { Clock } from '@/data/ids';

function localIso(d: Date): string {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const p = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sign}${p(off / 60)}:${p(off % 60)}`;
}

/** Device clock: the only place the app reads the time. The engine always receives `today` as an argument. */
export const deviceClock: Clock = {
  nowMs: () => Date.now(),
  iso: () => localIso(new Date()),
  tz: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  randomBytes: (n) => Crypto.getRandomBytes(n),
};

/** Today's local calendar day, YYYY-MM-DD. */
export function todayLocal(d: Date = new Date()): string {
  return localIso(d).slice(0, 10);
}
