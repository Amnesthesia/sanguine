// Mute and "raised on" bookkeeping for health flags (PLAN.md §4.10). Stored as a setting; the engine receives it as history context.
import { addDays, type FlagCode, type HealthFlag, type ISODate } from '@sanguine/engine';
import type { Database } from './database';
import { getSetting, setSetting } from './settings';

export const MUTE_DAYS = 90;
export interface FlagState { muted: Partial<Record<FlagCode, ISODate>>; lastRaised: Partial<Record<FlagCode, ISODate>> }
const EMPTY: FlagState = { muted: {}, lastRaised: {} };

export const loadFlagState = (db: Database): Promise<FlagState> => getSetting(db, 'flagState', EMPTY);

export async function muteFlag(db: Database, code: FlagCode, today: ISODate): Promise<void> {
  const s = await loadFlagState(db);
  await setSetting(db, 'flagState', { ...s, muted: { ...s.muted, [code]: addDays(today, MUTE_DAYS) } });
}

/** Remembers when each flag was first shown so `raisedOn` stays stable for 90 days. Returns true if anything changed. */
export async function recordRaised(db: Database, flags: HealthFlag[], state: FlagState): Promise<boolean> {
  const lastRaised = { ...state.lastRaised };
  let changed = false;
  for (const f of flags) if (lastRaised[f.code] !== f.raisedOn) { lastRaised[f.code] = f.raisedOn; changed = true; }
  if (changed) await setSetting(db, 'flagState', { ...state, lastRaised });
  return changed;
}

/** The engine's `History` fields for this state. */
export function flagContext(s: FlagState): { muted: Array<{ code: FlagCode; until: ISODate }>; lastFlagRaised: Partial<Record<FlagCode, ISODate>> } {
  return { muted: Object.entries(s.muted).map(([code, until]) => ({ code: code as FlagCode, until: until as ISODate })), lastFlagRaised: s.lastRaised };
}
