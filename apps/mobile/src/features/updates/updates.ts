// Over-the-air updates seen from inside the app (D-103): which update is running, a manual check from Settings > About, and a
// one-time notice after a launch that runs an update the person has not been told about. The check itself is the EAS Update
// request D-069 already allows; it carries no user data.
import * as Updates from 'expo-updates';
import type { Database } from '@/data/database';
import { getSetting, setSetting } from '@/data/settings';

/** A development build runs Metro's bundle, not an update, and has nothing to check against. */
export const updatesOn = (): boolean => Updates.isEnabled && !__DEV__;

/** True when this launch runs a downloaded update that differs from the last one seen; a store build's embedded bundle never counts. */
export const isNewUpdate = (current: string | null, lastSeen: string | null, embedded: boolean): boolean =>
  !embedded && current !== null && current !== lastSeen;

/** Records the running update id; true once per newly installed over-the-air update. */
export async function noteLaunchedUpdate(db: Database): Promise<boolean> {
  if (!updatesOn()) return false;
  const last = await getSetting<string | null>(db, 'lastUpdateId', null);
  if (Updates.updateId === last) return false;
  await setSetting(db, 'lastUpdateId', Updates.updateId);
  return isNewUpdate(Updates.updateId, last, Updates.isEmbeddedLaunch);
}

export type CheckResult = 'off' | 'latest' | 'reloading' | 'failed';

/** Manual check: downloads a newer update and restarts into it, or says there is none. */
export async function checkAndApply(): Promise<CheckResult> {
  if (!updatesOn()) return 'off';
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return 'latest';
    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew) return 'latest';
    await Updates.reloadAsync();
    return 'reloading';
  } catch {
    return 'failed';
  }
}
