// The record of what the person agreed to at onboarding (PLAN.md §2.5, GDPR Article 9). Stored on the phone with the other settings.
import type { Database } from './database';
import { getSetting, setSetting } from './settings';

export const CONSENT_VERSION = 1;
export type ConsentBasis = 'standard' | 'art9-explicit';
export interface ConsentRecord { version: number; at: string; basis: ConsentBasis }

/** EU and EEA members, the UK, and Switzerland (treated alike to be safe): special-category data needs explicit consent. */
const EXPLICIT_REGIONS = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'GB', 'CH',
]);

/** `explicit` asks for a separate, specific agreement before any data is entered. An unknown region is treated as `explicit`: the stricter default. */
export const consentRequirement = (region: string | null | undefined): 'explicit' | 'standard' =>
  !region || EXPLICIT_REGIONS.has(region.toUpperCase()) ? 'explicit' : 'standard';

export const getConsent = (db: Database): Promise<ConsentRecord | null> => getSetting<ConsentRecord | null>(db, 'consent.v1', null);
export const recordConsent = (db: Database, at: string, basis: ConsentBasis): Promise<void> => setSetting(db, 'consent.v1', { version: CONSENT_VERSION, at, basis } satisfies ConsentRecord);
