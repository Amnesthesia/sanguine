// User preferences (PLAN.md §8.2: appearance, tracking options, notifications). Defaults are the most private option (§8.1 rule 6).
import symptomCatalog from '../../../../copy/symptoms.json';
import type { Database } from './database';
import { getSetting, setSetting } from './settings';

export type ThemePref = 'system' | 'light' | 'dark';

export interface Prefs {
  theme: ThemePref;
  /** Symptom codes shown in the log sheet, in order (default: the 8 default-visible codes). */
  symptoms: string[];
  tempUnit: 'C' | 'F';
  tempSource: 'oral' | 'vaginal' | 'wrist' | 'finger' | 'other';
  sexLogging: boolean;
  /** User override of the ovulation estimate card; teen mode forces it off until unlocked. */
  showOvulationEstimate: boolean;
  teenUnlockEstimate: boolean;
  notifications: { period: boolean; descriptive: boolean };
  appLock: boolean;
  /** Widgets show the headline text only when on (PLAN.md §8.8): off = the ring and the day count. */
  widgetDetails: boolean;
  /** The home-screen icon and name are "Notes" (PLAN.md §8.8). */
  discreetIcon: boolean;
  /** Screenshots and the recent-apps thumbnail are blocked (PLAN.md §8.8). On by default. */
  screenProtection: boolean;
}

export const DEFAULT_SYMPTOMS: string[] = symptomCatalog.symptoms.filter((s) => s.defaultVisible).map((s) => s.code);

export const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  symptoms: DEFAULT_SYMPTOMS,
  tempUnit: 'C',
  tempSource: 'oral',
  sexLogging: false,
  showOvulationEstimate: true,
  teenUnlockEstimate: false,
  notifications: { period: false, descriptive: false },
  appLock: true,
  widgetDetails: false,
  discreetIcon: false,
  screenProtection: true,
};

export async function loadPrefs(db: Database): Promise<Prefs> {
  const saved = await getSetting<Partial<Prefs>>(db, 'prefs', {});
  return { ...DEFAULT_PREFS, ...saved, notifications: { ...DEFAULT_PREFS.notifications, ...saved.notifications } };
}
export async function savePrefs(db: Database, p: Prefs): Promise<void> {
  await setSetting(db, 'prefs', p);
}

/** Teen mode (age 13-17): fertility estimate card and sexual-activity logging are off by default (PLAN.md §8.6). */
export function isTeen(birthYear: number | undefined, year: number): boolean {
  return birthYear !== undefined && year - birthYear < 18;
}
export function effectivePrefs(p: Prefs, birthYear: number | undefined, year: number): { showOvulationEstimate: boolean; sexLogging: boolean; teen: boolean } {
  const teen = isTeen(birthYear, year);
  return {
    teen,
    showOvulationEstimate: p.showOvulationEstimate && (!teen || p.teenUnlockEstimate),
    sexLogging: p.sexLogging,
  };
}
