// Encrypted backup file: an export bundle sealed with the backup.v1 format (PLAN.md §6.3). Upload to iCloud/Drive is P3-7.
import { openBackup, type KdfParams, type Random, sealBackup } from '@sanguine/crypto';
import type { Database } from './database';
import { exportBundle, importBundle, type ImportResult } from './exportImport';
import type { Clock } from './ids';
import type { EventStore } from './store';

export interface CreateBackupOptions { passphrase: string; deviceSecret: Uint8Array; clock: Clock; kdf?: Partial<KdfParams>; onProgress?: (f: number) => void }

export async function createBackup(db: Database, store: EventStore, o: CreateBackupOptions): Promise<Uint8Array> {
  const { zip } = await exportBundle(db, store, o.clock);
  const random: Random = (n) => o.clock.randomBytes(n);
  return sealBackup({ payload: zip, passphrase: o.passphrase, deviceSecret: o.deviceSecret, random, ...(o.kdf ? { kdf: o.kdf } : {}), ...(o.onProgress ? { onProgress: o.onProgress } : {}) });
}

/** Throws BackupError('auth') for a wrong passphrase or device secret, before anything is written. */
export async function restoreBackup(db: Database, store: EventStore, file: Uint8Array, passphrase: string, deviceSecret: Uint8Array, onProgress?: (f: number) => void): Promise<ImportResult> {
  const zip = await openBackup(file, passphrase, deviceSecret, onProgress);
  return importBundle(db, store, zip);
}
