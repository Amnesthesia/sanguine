// Hourly background pass on Android (PLAN.md §7.2): Health Connect has no push delivery, so WorkManager (through expo-background-task)
// wakes the app about once an hour to read the change feed and upload a due cloud copy. iOS uses HealthKit background delivery instead.
// Must be imported once at start (app/_layout.tsx) so the task is defined before the system runs it.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { loadPrefs } from '@/data/prefs';
import { appData } from '../appData';
import { uploadCloudIfDue } from '../cloud';
import { syncHealthOnce } from './index';

export const HEALTH_TASK = 'sanguine-health-sync';
const MIN_INTERVAL_MINUTES = 60;

TaskManager.defineTask(HEALTH_TASK, async () => {
  try {
    const { db, store } = await appData(); // fails while the phone is locked (the key needs an unlocked phone): tried again next hour
    const prefs = await loadPrefs(db);
    await syncHealthOnce(db, store, prefs);
    await uploadCloudIfDue(db, store, prefs.cloudBackup);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Registers the hourly task while any health type or the cloud copy is on, removes it otherwise. */
export async function setHealthBackground(enabled: boolean): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(HEALTH_TASK);
    if (enabled && !registered) await BackgroundTask.registerTaskAsync(HEALTH_TASK, { minimumInterval: MIN_INTERVAL_MINUTES });
    if (!enabled && registered) await BackgroundTask.unregisterTaskAsync(HEALTH_TASK);
  } catch {
    // background work unavailable on this device: the foreground paths still work
  }
}
