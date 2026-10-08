// Date formatting for the UI (en-AU). Calendar days only: dates are formatted in UTC so the local zone never shifts them.
import { parseISO } from '@sanguine/engine';

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-AU', { ...opts, timeZone: 'UTC' });
const D = fmt({ day: 'numeric' });
const LONG = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const MONTH_YEAR = fmt({ month: 'long', year: 'numeric' });
const WEEKDAY = fmt({ weekday: 'long' });
const when = (iso: string) => new Date(parseISO(iso));
/** Fixed short month names: Intl gives "Sept" for en-AU, the product copy uses "Sep" (PLAN.md §9.6). */
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const monthShort = (iso: string) => MONTHS_SHORT[Number(iso.slice(5, 7)) - 1] as string;

export const formatDay = (iso: string): string => `${Number(iso.slice(8, 10))} ${monthShort(iso)}`;
export const formatDayYear = (iso: string): string => `${formatDay(iso)} ${iso.slice(0, 4)}`;
export const formatLong = (iso: string): string => LONG.format(when(iso));
export const formatMonthShort = (iso: string): string => monthShort(iso);
export const formatMonthYear = (iso: string): string => MONTH_YEAR.format(when(iso));
export const formatWeekday = (iso: string): string => WEEKDAY.format(when(iso));

/** "12–17 Nov" within a month, "30 Oct – 2 Nov" across months (PLAN.md §2.3 style). */
export function formatRange(lo: string, hi: string): string {
  if (lo === hi) return formatDay(lo);
  if (lo.slice(0, 7) === hi.slice(0, 7)) return `${D.format(when(lo))}–${formatDay(hi)}`;
  return `${formatDay(lo)} – ${formatDay(hi)}`;
}
