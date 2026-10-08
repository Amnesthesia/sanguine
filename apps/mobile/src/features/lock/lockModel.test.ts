import { describe, expect, it } from 'vitest';
import { LOCK_AFTER_MS, shouldLock } from './lockModel';

const base = { appLock: true, available: true, unlockedThisSession: true, backgroundedAt: undefined, now: 1_000_000 };

describe('shouldLock', () => {
  it('locks on first open of a session', () => expect(shouldLock({ ...base, unlockedThisSession: false })).toBe(true));
  it('stays unlocked while in use', () => expect(shouldLock(base)).toBe(false));
  it('locks after a minute in the background, not before', () => {
    expect(shouldLock({ ...base, backgroundedAt: base.now - (LOCK_AFTER_MS - 1) })).toBe(false);
    expect(shouldLock({ ...base, backgroundedAt: base.now - LOCK_AFTER_MS })).toBe(true);
  });
  it('is off when the setting is off or the phone has no screen lock', () => {
    expect(shouldLock({ ...base, appLock: false, unlockedThisSession: false })).toBe(false);
    expect(shouldLock({ ...base, available: false, unlockedThisSession: false })).toBe(false);
  });
  it('honours a shorter delay (development)', () => expect(shouldLock({ ...base, backgroundedAt: base.now - 3000, lockAfterMs: 2000 })).toBe(true));
  it('the delay is 60 seconds', () => expect(LOCK_AFTER_MS).toBe(60_000));
});
