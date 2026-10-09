// Health sync wiring (PLAN.md §7): picks the platform driver, runs a pass for the enabled types, watches for platform changes.
// The drivers import native modules, so they are loaded lazily and a missing module (Expo Go, unsupported device) means "no driver".
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { HealthType, PlatformDriver, SyncReport } from '@sanguine/health-adapter';
import type { Database } from '@/data/database';
import { activeHealthTypes, runHealthSync, sinceFor } from '@/data/healthSync';
import type { Prefs } from '@/data/prefs';
import type { EventStore } from '@/data/store';
import { deviceClock, todayLocal } from '../clock';

/** Our own package name, from the app config, so the echo guard keeps working if the id changes. */
const ANDROID_PACKAGE = Constants.expoConfig?.android?.package ?? 'app.sanguine.mobile';
let cached: PlatformDriver | null | undefined;

/** The platform driver, or null where the native module or the platform feature is missing. */
export async function getHealthDriver(): Promise<PlatformDriver | null> {
  if (cached !== undefined) return cached;
  try {
    if (Platform.OS === 'ios') {
      const m = require('./healthkit') as typeof import('./healthkit');
      cached = m.healthKitAvailable() ? m.createHealthKitDriver() : null;
    } else if (Platform.OS === 'android') {
      const m = require('./healthConnect') as typeof import('./healthConnect');
      cached = (await m.healthConnectAvailable()) ? m.createHealthConnectDriver(ANDROID_PACKAGE) : null;
    } else cached = null;
  } catch {
    cached = null;
  }
  return cached;
}

export const healthPlatformName = () => (Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect');

/** One pass for the user's enabled types. Null when nothing is enabled or no driver exists. A platform error comes back inside the report. */
export async function syncHealthOnce(db: Database, store: EventStore, prefs: Pick<Prefs, 'healthTypes' | 'healthWindow' | 'sexLogging'>): Promise<SyncReport | null> {
  const types = activeHealthTypes(prefs);
  if (types.length === 0) return null;
  const driver = await getHealthDriver();
  if (!driver) return null;
  return runHealthSync(db, store, driver, types, { now: new Date(deviceClock.nowMs()).toISOString(), deviceZone: deviceClock.tz(), since: sinceFor(prefs.healthWindow, todayLocal()) });
}

/** Asks the platform for access to these types (one system dialog on iOS, the permission screen on Android). */
export async function requestHealthAccess(types: HealthType[]): Promise<boolean> {
  const driver = await getHealthDriver();
  if (!driver?.requestPermission) return false;
  await driver.requestPermission(types);
  return true;
}

/** Calls `onChange` when the platform reports new data for any of the types (iOS background delivery). Returns an unsubscribe. */
export function watchHealth(types: HealthType[], onChange: () => void): () => void {
  if (Platform.OS !== 'ios' || types.length === 0) return () => {};
  try {
    return (require('./healthkit') as typeof import('./healthkit')).watchHealthKit(types, onChange);
  } catch {
    return () => {};
  }
}
