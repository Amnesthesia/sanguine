// Cloud backup wiring (PLAN.md §6.3, D-061): picks the store, keeps the derived key in the keystore, runs the automatic upload.
import { type PrecomputedKey, precomputeKey } from '@sanguine/crypto';
import * as Network from 'expo-network';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Database } from '@/data/database';
import type { EventStore } from '@/data/store';
import { deviceClock } from '../clock';
import { backupCrypto } from '../argon2';
import { getDeviceSecret } from '../secrets';
import { localCloudStore } from './local';
import type { CloudStore } from './types';
import { uploadIfDue } from './upload';

export { BACKUP_NAME, BACKUP_PREV, type CloudStore } from './types';

const KEY = 'sanguine.backup.kdfKey';
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => Number.parseInt(x, 16));

/** The store for this platform, or null when there is none (Tasks for the iCloud and Drive drivers add them; development builds fall back to a local folder). */
export async function getCloudStore(): Promise<CloudStore | null> {
  try {
    if (Platform.OS === 'ios') {
      const m = require('./icloud') as typeof import('./icloud');
      const s = m.icloudStore();
      if (await s.available()) return s;
    } else if (Platform.OS === 'android') {
      const m = require('./drive') as typeof import('./drive');
      if (m.driveConfigured()) {
        const s = m.driveStore();
        if (await s.available()) return s;
      }
    }
  } catch {
    // the native module or the account is missing
  }
  return __DEV__ ? localCloudStore() : null;
}
export const cloudServiceName = (s: CloudStore) => (s.name === 'icloud' ? 'iCloud Drive' : s.name === 'drive' ? 'Google Drive' : 'this phone (test folder)');

async function loadKey(): Promise<PrecomputedKey | null> {
  const raw = await SecureStore.getItemAsync(KEY, OPTS);
  if (!raw) return null;
  const j = JSON.parse(raw) as { salt: string; k0: string; kdf: PrecomputedKey['kdf'] };
  return { salt: unhex(j.salt), k0: unhex(j.k0), kdf: j.kdf };
}
/** Runs the key derivation once (the slow part) and keeps the result on this phone only. */
export async function enableAutoBackup(passphrase: string, onProgress?: (f: number) => void): Promise<void> {
  const { kdf, argon2id } = backupCrypto();
  const started = deviceClock.nowMs();
  const k = await precomputeKey(passphrase, (n) => deviceClock.randomBytes(n), kdf, onProgress, argon2id);
  if (__DEV__) console.log(`[backup] key derived with ${argon2id ? 'native' : 'JavaScript'} Argon2id, ${kdf.memKiB / 1024} MiB x ${kdf.iterations}, in ${deviceClock.nowMs() - started} ms`);
  await SecureStore.setItemAsync(KEY, JSON.stringify({ salt: hex(k.salt), k0: hex(k.k0), kdf: k.kdf }), OPTS);
}
export async function disableAutoBackup(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY, OPTS);
}

/** "Delete everything": removes the derived backup key and the Google sign-in from this phone. Files already in the user's cloud account stay there. */
export async function clearCloudSecrets(): Promise<void> {
  await disableAutoBackup();
  try {
    await (require('./drive') as typeof import('./drive')).signOutOfDrive();
  } catch {
    // no Drive module on this platform
  }
}

/** Uploads when due (after a change, on Wi-Fi, at most hourly). Safe to call often; never throws. */
export async function uploadCloudIfDue(db: Database, store: EventStore, enabled: boolean): Promise<'uploaded' | 'skipped' | 'failed'> {
  if (!enabled) return 'skipped';
  try {
    const cloud = await getCloudStore();
    if (!cloud) return 'skipped';
    const onWifi = (await Network.getNetworkStateAsync()).type === Network.NetworkStateType.WIFI;
    return await uploadIfDue({ db, store, cloud, clock: deviceClock, deviceSecret: await getDeviceSecret(), key: await loadKey(), enabled, onWifi, nowMs: deviceClock.nowMs() });
  } catch {
    return 'failed';
  }
}
