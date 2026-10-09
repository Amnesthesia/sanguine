// The device's language and calendar settings (PLAN.md §6.4), read through expo-localization. The rules themselves are in i18n/locale.ts.
import { getCalendars, getLocales } from 'expo-localization';
import { type Locale, pickLocale, type WeekStart, weekStartFrom } from '@/i18n/locale';

export const deviceLocale = (): Locale => pickLocale(getLocales().map((l) => l.languageTag));
export const deviceWeekStart = (): WeekStart => weekStartFrom(getCalendars()[0]?.firstWeekday);
export const deviceRegion = (): string | null => getLocales()[0]?.regionCode ?? null;
