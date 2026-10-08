// The backup device secret lives in the Keychain / Android Keystore (PLAN.md §6.3), never in the database or the log.
import { secretToRecoveryWords } from '@sanguine/crypto';
import * as SecureStore from 'expo-secure-store';
import { deviceClock } from './clock';

const KEY = 'sanguine.backup.deviceSecret';
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => Number.parseInt(x, 16));

export async function getDeviceSecret(): Promise<Uint8Array | null> {
  const v = await SecureStore.getItemAsync(KEY, OPTS);
  return v ? fromHex(v) : null;
}
/** Creates the secret on first use. `created` tells the UI to show the recovery code (once). */
export async function getOrCreateDeviceSecret(): Promise<{ secret: Uint8Array; created: boolean }> {
  const existing = await getDeviceSecret();
  if (existing) return { secret: existing, created: false };
  const secret = deviceClock.randomBytes(32);
  await SecureStore.setItemAsync(KEY, toHex(secret), OPTS);
  return { secret, created: true };
}
export const recoveryCodeFor = secretToRecoveryWords;
export async function deleteDeviceSecret(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY, OPTS);
}

const NOTE_KEY = 'sanguine.notes.key';
/** Key for the second encryption layer on notes. P2-13 gates its release behind the app lock. */
export async function getNoteKey(): Promise<Uint8Array> {
  const v = await SecureStore.getItemAsync(NOTE_KEY, OPTS);
  if (v) return fromHex(v);
  const key = deviceClock.randomBytes(32);
  await SecureStore.setItemAsync(NOTE_KEY, toHex(key), OPTS);
  return key;
}
export async function deleteNoteKey(): Promise<void> {
  await SecureStore.deleteItemAsync(NOTE_KEY, OPTS);
}
