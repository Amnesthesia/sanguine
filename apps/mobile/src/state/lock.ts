// App lock state (PLAN.md §8.8). Not persisted: the app always starts locked when the setting is on and the phone has a screen lock.
import { create } from 'zustand';
import { shouldLock } from '@/features/lock/lockModel';
import { authenticate, deviceHasLock } from '@/services/lockAuth';

interface LockState {
  locked: boolean;
  available: boolean | undefined;
  unlockedThisSession: boolean;
  backgroundedAt: number | undefined;
  failed: boolean;
  prompting: boolean;
  /** Called once the data layer is ready and again whenever the app returns to the foreground. */
  evaluate: (appLock: boolean, reason: string) => Promise<void>;
  noteBackground: () => void;
  tryUnlock: (reason: string) => Promise<void>;
}

export const useLock = create<LockState>((set, get) => ({
  locked: false, available: undefined, unlockedThisSession: false, backgroundedAt: undefined, failed: false, prompting: false,

  async evaluate(appLock, reason) {
    const available = get().available ?? (await deviceHasLock());
    set({ available });
    const lock = shouldLock({ appLock, available, unlockedThisSession: get().unlockedThisSession, backgroundedAt: get().backgroundedAt, now: Date.now() });
    if (!lock) { set({ locked: false }); return; }
    set({ locked: true });
    await get().tryUnlock(reason);
  },

  noteBackground() {
    if (get().backgroundedAt === undefined || !get().locked) set({ backgroundedAt: Date.now() });
  },

  async tryUnlock(reason) {
    if (get().prompting) return;
    set({ prompting: true });
    const ok = await authenticate(reason);
    set(ok ? { locked: false, unlockedThisSession: true, backgroundedAt: undefined, failed: false, prompting: false } : { failed: true, prompting: false });
  },
}));
