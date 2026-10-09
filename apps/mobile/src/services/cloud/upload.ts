// Automatic encrypted upload (PLAN.md §6.3, D-061). Pure over its inputs: the Wi-Fi check, keystore and cloud driver are passed in.
import type { PrecomputedKey } from '@sanguine/crypto';
import { createBackup } from '@/data/backup';
import type { Database } from '@/data/database';
import type { Clock } from '@/data/ids';
import { getSetting, setSetting } from '@/data/settings';
import type { EventStore } from '@/data/store';
import { BACKUP_NAME, BACKUP_PREV, type CloudStore } from './types';

const HOUR_MS = 3_600_000;

export function shouldUpload(s: { enabled: boolean; onWifi: boolean; changedAtMs: number | null; lastUploadMs: number | null; nowMs: number }): boolean {
  if (!s.enabled || !s.onWifi || s.changedAtMs === null) return false;
  if (s.lastUploadMs === null) return true;
  return s.changedAtMs > s.lastUploadMs && s.nowMs - s.lastUploadMs >= HOUR_MS;
}

export interface UploadDeps {
  db: Database; store: EventStore; cloud: CloudStore; clock: Clock;
  deviceSecret: Uint8Array | null; key: PrecomputedKey | null;
  enabled: boolean; onWifi: boolean; nowMs: number;
}

/** Never throws: a failure is `failed` and is tried again on the next change or return to the foreground. */
export async function uploadIfDue(d: UploadDeps): Promise<'uploaded' | 'skipped' | 'failed'> {
  try {
    if (!d.key || !d.deviceSecret) return 'skipped';
    const changed = (await d.db.get<{ m: string | null }>('SELECT MAX(recorded_at) AS m FROM event'))?.m;
    const last = await getSetting<string | null>(d.db, 'cloud.lastUploadAt', null);
    if (!shouldUpload({ enabled: d.enabled, onWifi: d.onWifi, changedAtMs: changed ? Date.parse(changed) : null, lastUploadMs: last ? Date.parse(last) : null, nowMs: d.nowMs })) return 'skipped';
    const bytes = await createBackup(d.db, d.store, { passphrase: '', deviceSecret: d.deviceSecret, clock: d.clock, precomputed: d.key });
    const previous = await d.cloud.get(BACKUP_NAME);
    if (previous) await d.cloud.put(BACKUP_PREV, previous);
    await d.cloud.put(BACKUP_NAME, bytes);
    await setSetting(d.db, 'cloud.lastUploadAt', new Date(d.nowMs).toISOString());
    return 'uploaded';
  } catch {
    return 'failed';
  }
}
