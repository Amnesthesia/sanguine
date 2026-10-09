// User preferences (PLAN.md §8.2: appearance, tracking options, notifications). Defaults are the most private option (§8.1 rule 6).
import { isTeenOn } from './age';
import symptomCatalog from '../../../../copy/symptoms.json';
import type { HealthType } from '@sanguine/health-adapter';
import type { Database } from './database';
import type { HealthWindow } from './healthSync';
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
  /** Today's look-back symptom note (D-087). */
  symptomNote: boolean;
  notifications: { period: boolean; descriptive: boolean };
  appLock: boolean;
  /** Widgets show the headline text only when on (PLAN.md §8.8): off = the ring and the day count. */
  widgetDetails: boolean;
  /** The home-screen icon and name are "Notes" (PLAN.md §8.8). */
  discreetIcon: boolean;
  /** Screenshots and the recent-apps thumbnail are blocked (PLAN.md §8.8). On by default. */
  screenProtection: boolean;
  /** Health types the user switched on (PLAN.md §7.5: none until they ask), and how far back the first import reads. */
  healthTypes: HealthType[];
  healthWindow: HealthWindow;
  /** Automatic encrypted copy in the user's own iCloud Drive or Google Drive (PLAN.md §6.3, D-061): off until they ask. */
  cloudBackup: boolean;
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
  symptomNote: true,
  notifications: { period: false, descriptive: false },
  appLock: false, // off until turned on in Settings, Privacy and data (owner, D-073)
  widgetDetails: false,
  discreetIcon: false,
  screenProtection: true,
  healthTypes: [],
  healthWindow: '2y',
  cloudBackup: false,
};

export async function loadPrefs(db: Database): Promise<Prefs> {
  const saved = await getSetting<Partial<Prefs>>(db, 'prefs', {});
  return { ...DEFAULT_PREFS, ...saved, notifications: { ...DEFAULT_PREFS.notifications, ...saved.notifications } };
}
export async function savePrefs(db: Database, p: Prefs): Promise<void> {
  await setSetting(db, 'prefs', p);
}

/** Teen mode (age 13-17): fertility estimate card and sexual-activity logging are off by default (PLAN.md §8.6). Exact when a date of birth is stored (D-055). */
export const isTeen = isTeenOn;
export function effectivePrefs(p: Prefs, profile: { birthDate?: string | undefined; birthYear?: number | undefined }, today: string): { showOvulationEstimate: boolean; sexLogging: boolean; teen: boolean; fertilityTools: boolean } {
  const teen = isTeen(profile, today);
  return {
    teen,
    /** Ovulation tests, cervical mucus and position, ovulation inferences: off under 18 until unlocked (PLAN.md §8.6); an adult who hides the estimate card still keeps them. */
    fertilityTools: !teen || p.teenUnlockEstimate,
    showOvulationEstimate: p.showOvulationEstimate && (!teen || p.teenUnlockEstimate),
    sexLogging: p.sexLogging,
  };
}
