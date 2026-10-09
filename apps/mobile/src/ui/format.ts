// Date formatting for the UI (en-AU). Calendar days only: dates are formatted in UTC so the local zone never shifts them.
import { parseISO } from '@sanguine/engine';
import type { Locale } from '@/i18n/locale';

let locale: Locale = 'en-AU';
/** The device's English variant (PLAN.md §6.4): US writes "Oct 10", the others "10 Oct". Set once at start. */
export function setFormatLocale(l: Locale): void { locale = l; }
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' });
const us = () => locale === 'en-US';
const when = (iso: string) => new Date(parseISO(iso));
/** Fixed short month names: Intl gives "Sept" for en-AU, the product copy uses "Sep" (PLAN.md §9.6). */
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const monthShort = (iso: string) => MONTHS_SHORT[Number(iso.slice(5, 7)) - 1] as string;

export const formatDay = (iso: string): string => (us() ? `${monthShort(iso)} ${Number(iso.slice(8, 10))}` : `${Number(iso.slice(8, 10))} ${monthShort(iso)}`);
export const formatDayYear = (iso: string): string => (us() ? `${formatDay(iso)}, ${iso.slice(0, 4)}` : `${formatDay(iso)} ${iso.slice(0, 4)}`);
export const formatLong = (iso: string): string => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(when(iso));
export const formatMonthShort = (iso: string): string => monthShort(iso);
export const formatMonthYear = (iso: string): string => fmt({ month: 'long', year: 'numeric' }).format(when(iso));
export const formatWeekday = (iso: string): string => fmt({ weekday: 'long' }).format(when(iso));

/** "12–17 Nov" within a month, "30 Oct – 2 Nov" across months (PLAN.md §2.3 style). */
export function formatRange(lo: string, hi: string): string {
  if (lo === hi) return formatDay(lo);
  if (lo.slice(0, 7) === hi.slice(0, 7)) return us() ? `${formatDay(lo)}–${Number(hi.slice(8, 10))}` : `${Number(lo.slice(8, 10))}–${formatDay(hi)}`;
  return `${formatDay(lo)} – ${formatDay(hi)}`;
}
