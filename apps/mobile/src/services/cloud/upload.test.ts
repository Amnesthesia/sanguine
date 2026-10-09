import { openBackup, precomputeKey } from '@sanguine/crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '@/data/database';
import type { Clock } from '@/data/ids';
import { migrate } from '@/data/migrate';
import { getSetting } from '@/data/settings';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { shouldUpload, uploadIfDue } from './upload';
import { BACKUP_NAME, BACKUP_PREV, type CloudStore } from './types';

const HOUR = 3_600_000;
describe('shouldUpload (PLAN.md §6.3: after a change, on Wi-Fi, at most hourly)', () => {
  const base = { enabled: true, onWifi: true, changedAtMs: 2000, lastUploadMs: null as number | null, nowMs: 10 * HOUR };
  it('uploads the first time something exists', () => expect(shouldUpload(base)).toBe(true));
  it('does nothing when off, offline Wi-Fi-wise, or nothing has changed', () => {
    expect(shouldUpload({ ...base, enabled: false })).toBe(false);
    expect(shouldUpload({ ...base, onWifi: false })).toBe(false);
    expect(shouldUpload({ ...base, changedAtMs: null })).toBe(false);
    expect(shouldUpload({ ...base, lastUploadMs: 5000 })).toBe(false);
  });
  it('waits an hour after the last upload even when things changed', () => {
    expect(shouldUpload({ ...base, changedAtMs: 9 * HOUR + 10, lastUploadMs: 9 * HOUR, nowMs: 9 * HOUR + 30 * 60_000 })).toBe(false);
    expect(shouldUpload({ ...base, changedAtMs: 9 * HOUR + 10, lastUploadMs: 9 * HOUR, nowMs: 10 * HOUR + 1 })).toBe(true);
  });
});

function memoryCloud(): CloudStore & { files: Map<string, Uint8Array>; failPuts: boolean } {
  const files = new Map<string, Uint8Array>();
  const c = {
    name: 'local' as const, files, failPuts: false,
    async available() { return true; },
    async put(n: string, b: Uint8Array) { if (c.failPuts) throw new Error('offline'); files.set(n, b); },
    async get(n: string) { return files.get(n) ?? null; },
    async list() { return [...files].map(([name, b]) => ({ name, modifiedAt: 'x', size: b.length })); },
    async remove(n: string) { files.delete(n); },
  };
  return c;
}
let stamp = '2026-10-10T07:00:00+10:00'; // when events are recorded; moved forward by the tests
function clock(): Clock {
  let n = 0;
  return { nowMs: () => 1_700_000_000_000 + n++, iso: () => stamp, tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) };
}
const secret = new Uint8Array(32).fill(5);
let db: Database;
let store: EventStore;
let cloud: ReturnType<typeof memoryCloud>;
beforeEach(async () => { stamp = '2026-10-10T07:00:00+10:00'; db = openTestDb(); await migrate(db); store = new EventStore(db, clock()); cloud = memoryCloud(); await store.append({ kind: 'flow', payload: { day: '2026-10-01', level: 'medium', flow_kind: 'period' } }); });
const key = () => precomputeKey('correct horse', (n) => Uint8Array.from({ length: n }, (_, i) => i), { memKiB: 64, iterations: 1, parallelism: 1 });
const deps = async (over: Partial<Parameters<typeof uploadIfDue>[0]> = {}) => ({ db, store, cloud, clock: clock(), deviceSecret: secret, key: await key(), enabled: true, onWifi: true, nowMs: Date.parse('2026-10-10T08:00:00+10:00'), ...over });

describe('uploadIfDue', () => {
  it('uploads a file that opens with the passphrase and records the time', async () => {
    expect(await uploadIfDue(await deps())).toBe('uploaded');
    const file = cloud.files.get(BACKUP_NAME) as Uint8Array;
    expect(file).toBeDefined();
    expect((await openBackup(file, 'correct horse', secret)).length).toBeGreaterThan(0);
    expect(await getSetting(db, 'cloud.lastUploadAt', null)).not.toBeNull();
  });
  it('keeps the previous file beside the new one', async () => {
    await uploadIfDue(await deps());
    const first = cloud.files.get(BACKUP_NAME);
    stamp = '2026-10-10T09:30:00+10:00';
    await store.append({ kind: 'flow', payload: { day: '2026-10-02', level: 'medium', flow_kind: 'period' } });
    expect(await uploadIfDue(await deps({ nowMs: Date.parse('2026-10-10T10:00:00+10:00') }))).toBe('uploaded');
    expect(cloud.files.get(BACKUP_PREV)).toEqual(first);
    expect(cloud.files.get(BACKUP_NAME)).not.toEqual(first);
  });
  it('skips when the hour is not up, with no key, or when switched off', async () => {
    await uploadIfDue(await deps());
    expect(await uploadIfDue(await deps({ nowMs: Date.parse('2026-10-10T08:30:00+10:00') }))).toBe('skipped');
    expect(await uploadIfDue(await deps({ key: null }))).toBe('skipped');
    expect(await uploadIfDue(await deps({ enabled: false }))).toBe('skipped');
  });
  it('reports failed, never throws, and does not record an upload when the cloud is unreachable', async () => {
    cloud.failPuts = true;
    expect(await uploadIfDue(await deps())).toBe('failed');
    expect(await getSetting(db, 'cloud.lastUploadAt', null)).toBeNull();
    cloud.failPuts = false;
    expect(await uploadIfDue(await deps())).toBe('uploaded'); // retried
  });
  it('is skipped when nothing has changed since the last upload', async () => {
    await uploadIfDue(await deps());
    expect(await uploadIfDue(await deps({ nowMs: Date.parse('2026-10-10T12:00:00+10:00') }))).toBe('skipped');
  });
});
