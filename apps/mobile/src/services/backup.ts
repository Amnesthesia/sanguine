// Device side of the encrypted backup (P2-5): save through the share sheet, restore from a picked file. Cloud upload is P3-7.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { createBackup, restoreBackup } from '@/data/backup';
import type { Database } from '@/data/database';
import type { ImportResult } from '@/data/exportImport';
import type { EventStore } from '@/data/store';
import { deviceClock, todayLocal } from './clock';
import { removeTempFile } from './tempFiles';
import { backupCrypto, nativeArgon2 } from './argon2';
import { getOrCreateDeviceSecret } from './secrets';

export async function shareBackup(db: Database, store: EventStore, passphrase: string, onProgress?: (f: number) => void): Promise<{ recoveryCreated: boolean; secret: Uint8Array }> {
  const { secret, created } = await getOrCreateDeviceSecret();
  const bytes = await createBackup(db, store, { passphrase, deviceSecret: secret, clock: deviceClock, ...backupCrypto(), ...(onProgress ? { onProgress } : {}) });
  const file = new File(Paths.cache, `sanguine-backup-${todayLocal()}.sgb`);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  try {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/octet-stream', dialogTitle: 'Sanguine encrypted backup' });
  } finally {
    removeTempFile(file);
  }
  return { recoveryCreated: created, secret };
}

/** Lets the user pick a backup file and returns its bytes, or null when they cancel. */
export async function pickBackupBytes(): Promise<Uint8Array | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return null;
  const f = new File(asset.uri);
  try {
    return await f.bytes();
  } finally {
    removeTempFile(f);
  }
}

/** `deviceSecret` is the stored secret on the same phone, or the one decoded from the recovery code on a new phone. */
export async function pickAndRestore(db: Database, store: EventStore, passphrase: string, deviceSecret: Uint8Array, onProgress?: (f: number) => void): Promise<ImportResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return null;
  const picked2 = new File(asset.uri);
  try {
    return await restoreBackup(db, store, await picked2.bytes(), passphrase, deviceSecret, onProgress, nativeArgon2() ?? undefined);
  } finally {
    removeTempFile(picked2);
  }
}
