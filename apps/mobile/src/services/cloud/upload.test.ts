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
describe('shouldUpload (PLAN.md §6.3: when the cloud copy lacks entries, on Wi-Fi, at most hourly)', () => {
  const base = { enabled: true, onWifi: true, missing: true, lastUploadMs: null as number | null, nowMs: 10 * HOUR };
  it('uploads the first time something exists', () => expect(shouldUpload(base)).toBe(true));
  it('does nothing when off, offline Wi-Fi-wise, or nothing has changed', () => {
    expect(shouldUpload({ ...base, enabled: false })).toBe(false);
    expect(shouldUpload({ ...base, onWifi: false })).toBe(false);
    expect(shouldUpload({ ...base, missing: false })).toBe(false);
  });
  it('waits an hour after the last upload even when things changed', () => {
    expect(shouldUpload({ ...base, lastUploadMs: 9 * HOUR, nowMs: 9 * HOUR + 30 * 60_000 })).toBe(false);
    expect(shouldUpload({ ...base, lastUploadMs: 9 * HOUR, nowMs: 10 * HOUR + 1 })).toBe(true);
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
    expect((await uploadIfDue(await deps())).status).toBe('uploaded');
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
    expect((await uploadIfDue(await deps({ nowMs: Date.parse('2026-10-10T10:00:00+10:00') }))).status).toBe('uploaded');
    expect(cloud.files.get(BACKUP_PREV)).toEqual(first);
    expect(cloud.files.get(BACKUP_NAME)).not.toEqual(first);
  });
  it('skips when the hour is not up, with no key, or when switched off', async () => {
    await uploadIfDue(await deps());
    expect((await uploadIfDue(await deps({ nowMs: Date.parse('2026-10-10T08:30:00+10:00') }))).status).toBe('skipped');
    expect((await uploadIfDue(await deps({ key: null }))).status).toBe('skipped');
    expect((await uploadIfDue(await deps({ enabled: false }))).status).toBe('skipped');
  });
  it('reports failed, never throws, and does not record an upload when the cloud is unreachable', async () => {
    cloud.failPuts = true;
    expect((await uploadIfDue(await deps())).status).toBe('failed');
    expect(await getSetting(db, 'cloud.lastUploadAt', null)).toBeNull();
    cloud.failPuts = false;
    expect((await uploadIfDue(await deps())).status).toBe('uploaded'); // retried
  });
  it('is skipped when nothing has changed since the last upload', async () => {
    await uploadIfDue(await deps());
    expect((await uploadIfDue(await deps({ nowMs: Date.parse('2026-10-10T12:00:00+10:00') }))).status).toBe('skipped');
  });
});

describe('sync between the user\'s own phones (P8-7, D-083)', () => {
  // phone B has its own device id and event ids (the shared test clock would repeat A's)
  const phone = async () => { const d = openTestDb(); await migrate(d); let n = 0; return { db: d, store: new EventStore(d, { nowMs: () => 1_800_000_000_000 + n++, iso: () => stamp, tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (97 + n + i) % 256) }) }; };
  const days = async (d: Database) => (await d.all<{ day: string }>('SELECT day FROM daily_log WHERE flow IS NOT NULL ORDER BY day')).map((r) => r.day);
  it('a second phone with the same key merges the first phone\'s entries before it uploads, and the first gets them back', async () => {
    const k = await key();
    expect((await uploadIfDue(await deps({ key: k }))).status).toBe('uploaded'); // phone A: 1 Oct
    const b = await phone();
    stamp = '2026-10-10T09:00:00+10:00';
    await b.store.append({ kind: 'flow', payload: { day: '2026-10-02', level: 'heavy', flow_kind: 'period' } });
    const rb = await uploadIfDue({ ...(await deps({ key: k })), db: b.db, store: b.store, nowMs: Date.parse('2026-10-10T09:30:00+10:00') });
    expect(rb).toEqual({ status: 'uploaded', merged: 1 }); // A's one event
    expect(await days(b.db)).toEqual(['2026-10-01', '2026-10-02']);
    const ra = await uploadIfDue(await deps({ key: k, nowMs: Date.parse('2026-10-10T11:00:00+10:00') }));
    expect(ra.merged).toBeGreaterThan(0);
    expect(await days(db)).toEqual(['2026-10-01', '2026-10-02']);
    expect((await uploadIfDue(await deps({ key: k, nowMs: Date.parse('2026-10-10T13:00:00+10:00') }))).merged).toBe(0); // converged
  });
  it('a copy sealed with another key is never overwritten: conflict', async () => {
    await uploadIfDue(await deps());
    const theirs = cloud.files.get(BACKUP_NAME);
    const other = await precomputeKey('another passphrase', (n) => Uint8Array.from({ length: n }, (_, i) => 200 - i), { memKiB: 64, iterations: 1, parallelism: 1 });
    stamp = '2026-10-10T09:00:00+10:00';
    await store.append({ kind: 'flow', payload: { day: '2026-10-03', level: 'light', flow_kind: 'period' } });
    expect(await uploadIfDue(await deps({ key: other, nowMs: Date.parse('2026-10-10T12:00:00+10:00') }))).toEqual({ status: 'conflict', merged: 0 });
    expect(cloud.files.get(BACKUP_NAME)).toEqual(theirs);
  });
  it('force uploads inside the hour, after merging', async () => {
    await uploadIfDue(await deps());
    expect((await uploadIfDue(await deps({ force: true, nowMs: Date.parse('2026-10-10T08:10:00+10:00') }))).status).toBe('uploaded');
  });
  it('a phone whose upload was overwritten by a racing phone uploads again, though nothing changed on it', async () => {
    const k = await key();
    await uploadIfDue(await deps({ key: k })); // A uploads its 1 event
    const b = await phone();
    await b.store.append({ kind: 'flow', payload: { day: '2026-10-05', level: 'light', flow_kind: 'period' } });
    // B uploads a copy holding only its own event, as if it had downloaded before A's upload landed
    cloud.files.delete(BACKUP_NAME);
    await uploadIfDue({ ...(await deps({ key: k })), db: b.db, store: b.store });
    const r = await uploadIfDue(await deps({ key: k, nowMs: Date.parse('2026-10-10T09:30:00+10:00') }));
    expect(r.status).toBe('uploaded'); // A merged B's event and saw its own was missing from the copy
    expect((await uploadIfDue({ ...(await deps({ key: k })), db: b.db, store: b.store, nowMs: Date.parse('2026-10-10T11:00:00+10:00') })).merged).toBe(1);
  });
  it('a conflict is remembered for the backup screen', async () => {
    await uploadIfDue(await deps());
    const other = await precomputeKey('another passphrase', (n) => Uint8Array.from({ length: n }, (_, i) => 200 - i), { memKiB: 64, iterations: 1, parallelism: 1 });
    await uploadIfDue(await deps({ key: other, nowMs: Date.parse('2026-10-10T12:00:00+10:00') }));
    expect(await getSetting(db, 'cloud.conflict', false)).toBe(true);
  });
});
