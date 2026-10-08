// View cache over the event log (PLAN.md §6.1): the log is the source of truth, this store only holds the latest derived values.
import { type EngineSettings, type FlagCode, type History, type ISODate, type Prediction, predict } from '@sanguine/engine';
import { create } from 'zustand';
import type { Database } from '@/data/database';
import { flagContext, loadFlagState, muteFlag, recordRaised } from '@/data/flagState';
import { wipeAll } from '@/data/wipe';
import { deleteDeviceSecret, deleteNoteKey } from '@/services/secrets';
import { removeAllTempFiles } from '@/services/tempFiles';
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
  muteFlag: (code: FlagCode) => Promise<void>;
  updateProfile: (patch: Profile) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  /** Drops the whole database and every key, then returns the app to first launch. */
  deleteEverything: () => Promise<void>;
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
    const { store, db } = get();
    if (!store || !db) return;
    const today = todayLocal();
    const [inputs, profile, flagState] = await Promise.all([store.engineInputs(), store.profile(), loadFlagState(db)]);
    const history: History = { ...inputs.history, ...flagContext(flagState) };
    const prediction = predict(history, inputs.settings, today);
    await recordRaised(db, prediction.flags, flagState);
    set((s) => ({ today, history, settings: inputs.settings, profile, prediction, version: s.version + 1 }));
  },

  async updatePrefs(patch) {
    const { db, prefs } = get();
    if (!db) return;
    const next = { ...prefs, ...patch };
    await savePrefs(db, next);
    set({ prefs: next });
  },

  async muteFlag(code) {
    const { db, today } = get();
    if (!db) return;
    await muteFlag(db, code, today);
    await get().refresh();
  },

  async updateProfile(patch) {
    const { store, profile } = get();
    if (!store) return;
    await store.setProfile({ ...profile, ...patch });
    await get().refresh();
  },

  async deleteEverything() {
    const { db } = get();
    if (!db) return;
    await wipeAll(db);
    await Promise.all([deleteDeviceSecret(), deleteNoteKey()]);
    removeAllTempFiles();
    set({ prefs: DEFAULT_PREFS, profile: {}, onboarded: false, history: undefined, settings: undefined, prediction: undefined, version: get().version + 1 });
    await get().refresh();
  },

  async completeOnboarding() {
    const { db } = get();
    if (!db) return;
    await setSetting(db, 'onboarded', true);
    set({ onboarded: true });
  },
}));
