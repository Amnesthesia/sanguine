// Date formatting for the UI (en-AU). Calendar days only: dates are formatted in UTC so the local zone never shifts them.
import { parseISO } from '@sanguine/engine';

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-AU', { ...opts, timeZone: 'UTC' });
const D = fmt({ day: 'numeric' });
const DM = fmt({ day: 'numeric', month: 'short' });
const DMY = fmt({ day: 'numeric', month: 'short', year: 'numeric' });
const LONG = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const MONTH = fmt({ month: 'short' });
const MONTH_YEAR = fmt({ month: 'long', year: 'numeric' });
const WEEKDAY = fmt({ weekday: 'long' });
const when = (iso: string) => new Date(parseISO(iso));

export const formatDay = (iso: string): string => DM.format(when(iso));
export const formatDayYear = (iso: string): string => DMY.format(when(iso));
export const formatLong = (iso: string): string => LONG.format(when(iso));
export const formatMonthShort = (iso: string): string => MONTH.format(when(iso));
export const formatMonthYear = (iso: string): string => MONTH_YEAR.format(when(iso));
export const formatWeekday = (iso: string): string => WEEKDAY.format(when(iso));

/** "12–17 Nov" within a month, "30 Oct – 2 Nov" across months (PLAN.md §2.3 style). */
export function formatRange(lo: string, hi: string): string {
  if (lo === hi) return formatDay(lo);
  if (lo.slice(0, 7) === hi.slice(0, 7)) return `${D.format(when(lo))}–${formatDay(hi)}`;
  return `${formatDay(lo)} – ${formatDay(hi)}`;
}
