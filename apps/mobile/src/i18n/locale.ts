// Locale choices (PLAN.md §6.4): the copy is Australian English; en-GB and en-US share it and differ in temperature unit and week start,
// which follow the device. Pure so the rules are tested; services/locale.ts reads the device.
export const LOCALES = ['en-AU', 'en-GB', 'en-US'] as const;
export type Locale = (typeof LOCALES)[number];

/** The first language tag we ship a locale for, else en-AU. `tags` are BCP 47 tags in the user's order, for example `en-US`. */
export function pickLocale(tags: readonly string[]): Locale {
  for (const raw of tags) {
    const [lang = '', ...rest] = raw.replace('_', '-').split('-');
    if (lang.toLowerCase() !== 'en') continue;
    const region = rest.find((p) => /^[A-Za-z]{2}$/.test(p))?.toUpperCase();
    if (region === 'US') return 'en-US';
    if (region === 'GB' || region === 'IE') return 'en-GB';
    return 'en-AU';
  }
  return 'en-AU';
}

/** °F only for en-US (PLAN.md §6.4); everyone else °C. This is the first-run default, the Tracking settings choice wins afterwards. */
export const defaultTempUnit = (l: Locale): 'C' | 'F' => (l === 'en-US' ? 'F' : 'C');

export type WeekStart = 'mon' | 'sun';
/** From `expo-localization`'s `firstWeekday` (1 = Sunday ... 7 = Saturday). Only Sunday and Monday starts are drawn; anything else is Monday. */
export const weekStartFrom = (firstWeekday: number | null | undefined): WeekStart => (firstWeekday === 1 ? 'sun' : 'mon');

/** The Monday-first labels in `copy` reordered for the week start. */
export function weekdayLabels(mondayFirst: readonly string[], start: WeekStart): string[] {
  return start === 'sun' ? [mondayFirst[6] as string, ...mondayFirst.slice(0, 6)] : [...mondayFirst];
}

/** A translated language for the device, or null (then the English copy is used): an exact tag such as `pt-BR` first, then the bare language. */
export function pickTranslated(tags: readonly string[], available: readonly string[]): string | null {
  for (const raw of tags) {
    const tag = raw.replace('_', '-');
    const exact = available.find((a) => a.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;
    const lang = tag.split('-')[0]?.toLowerCase();
    const bare = available.find((a) => a.toLowerCase() === lang);
    if (bare) return bare;
  }
  return null;
}
