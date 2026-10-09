// View cache over the event log (PLAN.md §6.1): the log is the source of truth, this store only holds the latest derived values.
import { type EngineSettings, type FlagCode, type History, type ISODate, type Prediction, predict } from '@sanguine/engine';
import { create } from 'zustand';
import type { Database } from '@/data/database';
import { flagContext, loadFlagState, muteFlag, recordRaised } from '@/data/flagState';
import { wipeAll } from '@/data/wipe';
import { deleteDeviceSecret, deleteNoteKey } from '@/services/secrets';
import { removeAllTempFiles } from '@/services/tempFiles';
import { loadPrefs, type Prefs, DEFAULT_PREFS, savePrefs } from '@/data/prefs';
import { sqliteLinks } from '@/data/healthLinks';
import { SyncGate } from '@/data/syncGate';
import { mergeReports } from '@/data/healthSync';
import { clearCloudSecrets, uploadCloudIfDue } from '@/services/cloud';
import i18next from 'i18next';
import { TRANSLATIONS } from '@/i18n/translations';
import { getLocales } from 'expo-localization';
import { defaultTempUnit, pickTranslated } from '@/i18n/locale';
import { deviceLocale } from '@/services/locale';
import { setFormatLocale } from '@/ui/format';
import { syncHealthOnce, watchHealth } from '@/services/health';
import { setHealthBackground } from '@/services/health/backgroundTask';
import type { SyncReport } from '@sanguine/health-adapter';
import { AppState as RNAppState, Platform } from 'react-native';
import type { Profile } from '@/data/project';
import { getSetting, setSetting } from '@/data/settings';
import type { EventStore } from '@/data/store';
import { planReminder } from '@/features/notifications/plan';
import { appData, startFreshDatabase } from '@/services/appData';
import { KeyMismatchError } from '@/data/cipher';
import { syncReminder } from '@/services/notifications';
import { serial } from './serial';
import { displayName, setDiscreetIcon } from '@/services/discreet';
import { syncWidget, widgetSnapshot } from '@/services/widgets';
import { todayLocal } from '@/services/clock';

export type HealthAsk = SyncReport['asks'][number] & { platform: 'healthkit' | 'healthconnect' };
export interface HealthState { running: boolean; lastAt?: string; last?: SyncReport; asks: HealthAsk[] }
const HEALTH_MIN_GAP_MS = 60_000;
const healthGate = new SyncGate();
let healthTimer: ReturnType<typeof setTimeout> | undefined;
let unwatchHealth: (() => void) | undefined;
let foregroundHooked = false;
function rewatch(types: Prefs['healthTypes'], run: () => void) {
  unwatchHealth?.();
  unwatchHealth = types.length > 0 ? watchHealth(types, run) : undefined;
}

interface AppState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  /** The database exists but this phone's key does not open it (D-043). */
  keyMismatch?: boolean;
  /** How many times the app has been opened (this launch included); drives the splash tagline (D-049). */
  launchCount: number;
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
  /** Date the next local reminder will fire, if one is scheduled. */
  nextReminder: string | undefined;
  /** Health sync (PLAN.md §7): the last pass and the deletions the user has to answer. */
  health: HealthState;
  syncHealth: (o?: { force?: boolean }) => Promise<SyncReport | null>;
  resolveHealthAsk: (ask: HealthAsk, removeHere: boolean) => Promise<void>;
  syncReminders: () => Promise<void>;
  syncWidgets: () => Promise<void>;
  init: () => Promise<void>;
  /** Deletes an unreadable database and starts empty; only after the user confirms. */
  startFresh: () => Promise<void>;
  refresh: () => Promise<void>;
  updatePrefs: (patch: Partial<Prefs>) => Promise<void>;
  retry: () => Promise<void>;
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
  launchCount: 0,
  version: 0,
  nextReminder: undefined,
  health: { running: false, asks: [] },

  async init() {
    try {
      const { db, store } = await appData();
      const [loaded, onboarded, launches, savedPrefs] = await Promise.all([loadPrefs(db), getSetting(db, 'onboarded', false), getSetting(db, 'launchCount', 0), getSetting<unknown>(db, 'prefs', null)]);
      const locale = deviceLocale();
      setFormatLocale(locale);
      const translated = pickTranslated(getLocales().map((l) => l.languageTag), Object.keys(TRANSLATIONS));
      if (translated) await i18next.changeLanguage(translated);
      // first run: the temperature unit follows the device region (°F for en-US); the Tracking setting wins afterwards
      const prefs = savedPrefs === null ? { ...loaded, tempUnit: defaultTempUnit(locale) } : loaded;
      if (savedPrefs === null && prefs.tempUnit !== loaded.tempUnit) await savePrefs(db, prefs);
      const launchCount = launches + 1;
      await setSetting(db, 'launchCount', launchCount);
      const asks = await getSetting<HealthAsk[]>(db, 'healthAsks', []);
      set({ db, store, prefs, onboarded, launchCount, health: { running: false, asks } });
      await get().refresh();
      set({ status: 'ready' });
      void get().syncHealth({ force: true });
      rewatch(get().prefs.healthTypes, () => void get().syncHealth({ force: true }));
      void setHealthBackground(get().prefs.healthTypes.length > 0 || get().prefs.cloudBackup);
      if (!foregroundHooked) {
        foregroundHooked = true;
        RNAppState.addEventListener('change', (st) => { if (st === 'active') { void get().syncHealth(); const { db: d, store: st2, prefs: p } = get(); if (d && st2) void uploadCloudIfDue(d, st2, p.cloudBackup); } });
      }
    } catch (e) {
      set({ status: 'error', error: (e as Error).message, keyMismatch: e instanceof KeyMismatchError });
    }
  },

  /** "Try again" on the open-failed screen: appData() does not cache a failed open, so init can simply run again. */
  async retry() {
    set({ status: 'loading', error: undefined, keyMismatch: false });
    await get().init();
  },

  async startFresh() {
    await startFreshDatabase();
    set({ status: 'loading', error: undefined, keyMismatch: false });
    await get().init();
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
    void get().syncReminders();
    void get().syncWidgets();
    void get().syncHealth();
    void uploadCloudIfDue(db, store, get().prefs.cloudBackup);
  },

  /** One health pass: at most one at a time and one a minute (a skipped call is retried once the minute is up), force skips the minute. */
  async syncHealth(o) {
    const { db, store, prefs, health } = get();
    if (!db || !store || prefs.healthTypes.length === 0 || health.running) return null;
    const wait = health.lastAt ? HEALTH_MIN_GAP_MS - (Date.now() - Date.parse(health.lastAt)) : 0;
    if (!o?.force && wait > 0) {
      healthTimer ??= setTimeout(() => { healthTimer = undefined; void get().syncHealth(); }, wait);
      return null;
    }
    return healthGate.run(async () => {
      set({ health: { ...get().health, running: true } });
      let report: SyncReport | null = null;
      try {
        report = await syncHealthOnce(db, store, prefs);
      } catch (e) {
        report = { ...mergeReports([]), failed: [{ op: 'read', error: (e as Error).message }] };
      }
      const platform = Platform.OS === 'ios' ? 'healthkit' : 'healthconnect';
      const asks = [...get().health.asks, ...(report?.asks ?? []).map((a) => ({ ...a, platform }) as HealthAsk)];
      if (report?.asks.length) await setSetting(db, 'healthAsks', asks);
      set({ health: { running: false, lastAt: new Date().toISOString(), ...(report ? { last: report } : {}), asks } });
      if (report && report.imported + report.retracted > 0) await get().refresh();
      return report;
    });
  },

  async resolveHealthAsk(ask, removeHere) {
    const { db, store, health } = get();
    if (!db || !store) return;
    if (removeHere) await store.retract(ask.eventId);
    else await sqliteLinks(db).remove(ask.platform, ask.externalId); // unlinked, so the next pass writes it again
    const asks = health.asks.filter((a) => a.externalId !== ask.externalId);
    await setSetting(db, 'healthAsks', asks);
    set({ health: { ...health, asks } });
    await get().refresh();
    void get().syncHealth({ force: true });
  },

  /** Hands the widget today's snapshot: the ring and the day, plus the headline only if the user opted in (§8.8). */
  async syncWidgets() {
    const { prediction, history, prefs, today } = get();
    try {
      await syncWidget(widgetSnapshot({ prediction, hasCycles: (history?.cycles.length ?? 0) > 0, today, descriptive: prefs.widgetDetails, appName: displayName(prefs.discreetIcon) }));
    } catch {
      // a widget that cannot update must never break the app
    }
  },

  async syncReminders() {
    const { prediction, prefs, today } = get();
    const hour = new Date().getHours();
    try {
      const plan = planReminder(prediction, prefs.notifications.period, prefs.notifications.descriptive, today, hour);
      set({ nextReminder: await syncReminder(plan, prefs.discreetIcon) });
    } catch {
      set({ nextReminder: undefined });
    }
  },

  // serialised: two quick toggles would otherwise both merge into the same stale `prefs` and the first change would be lost (I-13, D-075)
  updatePrefs: serial(async (patch: Partial<Prefs>) => {
    const { db, prefs } = get();
    if (!db) return;
    const next = { ...prefs, ...patch };
    await savePrefs(db, next);
    set({ prefs: next });
    if (patch.notifications || patch.discreetIcon !== undefined) void get().syncReminders();
    if (patch.widgetDetails !== undefined || patch.discreetIcon !== undefined) void get().syncWidgets();
    if (patch.healthTypes) rewatch(next.healthTypes, () => void get().syncHealth({ force: true }));
    if (patch.healthTypes || patch.cloudBackup !== undefined) void setHealthBackground(next.healthTypes.length > 0 || next.cloudBackup);
  }),

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
    // stop health sync first and keep it stopped until the preferences are reset: a pass that is still running, or started with the old
    // preferences, would write the platform's records back into the emptied database
    clearTimeout(healthTimer);
    healthTimer = undefined;
    rewatch([], () => {});
    void setHealthBackground(false);
    await healthGate.close();
    try {
      await wipeAll(db);
      await Promise.all([deleteDeviceSecret(), deleteNoteKey(), clearCloudSecrets()]);
      removeAllTempFiles();
      // the widget and the home-screen icon hold nothing of the deleted data: reset the icon and blank the widget
      void setDiscreetIcon(false).catch(() => {});
      set({ prefs: DEFAULT_PREFS, health: { running: false, asks: [] }, profile: {}, onboarded: false, history: undefined, settings: undefined, prediction: undefined, version: get().version + 1 });
    } finally {
      healthGate.open();
    }
    await get().refresh();
  },

  async completeOnboarding() {
    const { db } = get();
    if (!db) return;
    await setSetting(db, 'onboarded', true);
    set({ onboarded: true });
  },
}));
