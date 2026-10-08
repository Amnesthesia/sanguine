// View cache over the event log (PLAN.md §6.1): the log is the source of truth, this store only holds the latest derived values.
import { type EngineSettings, type History, type ISODate, type Prediction, predict } from '@sanguine/engine';
import { create } from 'zustand';
import type { Database } from '@/data/database';
import { loadPrefs, type Prefs, DEFAULT_PREFS, savePrefs } from '@/data/prefs';
import type { Profile } from '@/data/project';
import { getSetting, setSetting } from '@/data/settings';
import type { EventStore } from '@/data/store';
import { appData } from '@/services/appData';
import { todayLocal } from '@/services/clock';

interface AppState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  db?: Database;
  store?: EventStore;
  prefs: Prefs;
  profile: Profile;
  onboarded: boolean;
  today: ISODate;
  history?: History;
  settings?: EngineSettings;
  prediction?: Prediction;
  /** Bumps on every refresh so screens can re-query their own tables. */
  version: number;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  updatePrefs: (patch: Partial<Prefs>) => Promise<void>;
  updateProfile: (patch: Profile) => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  status: 'loading',
  prefs: DEFAULT_PREFS,
  profile: {},
  onboarded: false,
  today: todayLocal(),
  version: 0,

  async init() {
    try {
      const { db, store } = await appData();
      const [prefs, onboarded] = await Promise.all([loadPrefs(db), getSetting(db, 'onboarded', false)]);
      set({ db, store, prefs, onboarded });
      await get().refresh();
      set({ status: 'ready' });
    } catch (e) {
      set({ status: 'error', error: (e as Error).message });
    }
  },

  async refresh() {
    const { store } = get();
    if (!store) return;
    const today = todayLocal();
    const [{ history, settings }, profile] = await Promise.all([store.engineInputs(), store.profile()]);
    set((s) => ({ today, history, settings, profile, prediction: predict(history, settings, today), version: s.version + 1 }));
  },

  async updatePrefs(patch) {
    const { db, prefs } = get();
    if (!db) return;
    const next = { ...prefs, ...patch };
    await savePrefs(db, next);
    set({ prefs: next });
  },

  async updateProfile(patch) {
    const { store, profile } = get();
    if (!store) return;
    await store.setProfile({ ...profile, ...patch });
    await get().refresh();
  },

  async completeOnboarding() {
    const { db } = get();
    if (!db) return;
    await setSetting(db, 'onboarded', true);
    set({ onboarded: true });
  },
}));
