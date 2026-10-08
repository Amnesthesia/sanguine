// When the app locks (PLAN.md §8.8): on first open, and after a minute in the background. Pure so it can be tested.
export const LOCK_AFTER_MS = 60_000;

export interface LockInput {
  appLock: boolean; // user setting
  available: boolean; // the phone has Face ID, a fingerprint or a passcode
  unlockedThisSession: boolean;
  backgroundedAt: number | undefined;
  now: number;
  lockAfterMs?: number;
}

/** True when the lock screen must cover the app. If the phone has no screen lock the lock cannot work and stays off. */
export function shouldLock(i: LockInput): boolean {
  if (!i.appLock || !i.available) return false;
  if (!i.unlockedThisSession) return true;
  return i.backgroundedAt !== undefined && i.now - i.backgroundedAt >= (i.lockAfterMs ?? LOCK_AFTER_MS);
}
