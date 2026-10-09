// Automatic encrypted upload (PLAN.md §6.3, D-061). Pure over its inputs: the Wi-Fi check, keystore and cloud driver are passed in.
import { BackupError, openBackupWithKey, type PrecomputedKey, sealBackup } from '@sanguine/crypto';
import type { Database } from '@/data/database';
import { exportBundle, importBundle } from '@/data/exportImport';
import type { Clock } from '@/data/ids';
import { getSetting, setSetting } from '@/data/settings';
import type { EventStore } from '@/data/store';
import { BACKUP_NAME, BACKUP_PREV, type CloudStore } from './types';

const HOUR_MS = 3_600_000;

/** Upload when the cloud copy lacks events this phone has (a new entry here, or another phone's upload that raced this one's, D-083),
 *  on Wi-Fi, at most hourly. Comparing contents, not timestamps, keeps another phone's clock out of the decision. */
export function shouldUpload(s: { enabled: boolean; onWifi: boolean; missing: boolean; lastUploadMs: number | null; nowMs: number }): boolean {
  if (!s.enabled || !s.onWifi || !s.missing) return false;
  return s.lastUploadMs === null || s.nowMs - s.lastUploadMs >= HOUR_MS;
}

export interface UploadDeps {
  db: Database; store: EventStore; cloud: CloudStore; clock: Clock;
  deviceSecret: Uint8Array | null; key: PrecomputedKey | null;
  enabled: boolean; onWifi: boolean; nowMs: number;
  /** "Upload now": skip the hourly wait (still merges first). */
  force?: boolean;
}
/** `conflict`: the copy in the cloud was sealed with another key (another phone's recovery code or passphrase); it is left alone. */
export type SyncStatus = 'uploaded' | 'skipped' | 'failed' | 'conflict';

/** Sync between the user's own phones (P8-7, D-077, D-083): before every upload, the copy already in the cloud is opened with this
 *  phone's key and merged into the log (events are append-only with ids, so a merge is a union; `importBundle` inserts what is new and
 *  rebuilds). Then the merged log is uploaded when due. Every phone that shares the key converges; nothing is ever overwritten unread.
 *  Never throws: a failure is `failed` and is tried again on the next change or return to the foreground. */
export async function uploadIfDue(d: UploadDeps): Promise<{ status: SyncStatus; merged: number }> {
  let merged = 0;
  try {
    if (!d.key || !d.deviceSecret || !d.enabled || !d.onWifi) return { status: 'skipped', merged };
    const remote = await d.cloud.get(BACKUP_NAME);
    let inCloud = 0;
    if (remote) {
      let zip: Uint8Array;
      try { zip = await openBackupWithKey(remote, d.key, d.deviceSecret); } catch (e) {
        if (e instanceof BackupError && e.code === 'auth') { await setSetting(d.db, 'cloud.conflict', true); return { status: 'conflict', merged }; }
        throw e;
      }
      const r = await importBundle(d.db, d.store, zip);
      merged = r.imported;
      inCloud = r.imported + r.duplicates;
    }
    await setSetting(d.db, 'cloud.conflict', false);
    const { zip, eventCount } = await exportBundle(d.db, d.store, d.clock, { forBackup: true });
    const last = await getSetting<string | null>(d.db, 'cloud.lastUploadAt', null);
    const missing = eventCount > inCloud;
    if (!shouldUpload({ enabled: true, onWifi: true, missing, lastUploadMs: last ? Date.parse(last) : null, nowMs: d.nowMs }) && !d.force) return { status: 'skipped', merged };
    const bytes = await sealBackup({ payload: zip, passphrase: '', deviceSecret: d.deviceSecret, random: (n) => d.clock.randomBytes(n), precomputed: d.key });
    if (remote) await d.cloud.put(BACKUP_PREV, remote);
    await d.cloud.put(BACKUP_NAME, bytes);
    await setSetting(d.db, 'cloud.lastUploadAt', new Date(d.nowMs).toISOString());
    return { status: 'uploaded', merged };
  } catch {
    return { status: 'failed', merged };
  }
}
