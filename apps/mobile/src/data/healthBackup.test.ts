// PLAN.md §7.6: samples that came only from HealthKit never go into a backup (Apple's rule against storing HealthKit data in iCloud).
import { openBackup } from '@sanguine/crypto';
import { strFromU8, unzipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { createBackup, restoreBackup } from './backup';
import type { Database } from './database';
import { sqliteLinks } from './healthLinks';
import type { Clock } from './ids';
import { migrate } from './migrate';
import { EventStore } from './store';
import { openTestDb } from './testDb';

function clock(): Clock {
  let n = 0;
  return { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) };
}
const secret = new Uint8Array(32).fill(7);
const fast = { memKiB: 64, iterations: 1, parallelism: 1 };
let db: Database;
let store: EventStore;
beforeEach(async () => { db = openTestDb(); await migrate(db); store = new EventStore(db, clock()); });
const flow = (day: string) => ({ kind: 'flow', payload: { day, level: 'medium', flow_kind: 'period' } });
const link = (eventId: string, platform: 'healthkit' | 'healthconnect', externalId: string, direction: 'read' | 'wrote' = 'read') =>
  sqliteLinks(db).put({ eventId, platform, externalId, direction, contentHash: 'h', writtenAt: '2026-10-09T00:00:00Z' });
const eventsOf = async (bytes: Uint8Array) => {
  const files = unzipSync(await openBackup(bytes, 'pw', secret));
  return { names: Object.keys(files), events: strFromU8(files['events.jsonl'] as Uint8Array).split('\n').filter(Boolean).map((l) => JSON.parse(l) as { id: string; kind: string; effective_day: string }) };
};

describe('backup and HealthKit data', () => {
  it('leaves out events imported from HealthKit and their retracts, keeps everything else', async () => {
    const mine = await store.append(flow('2026-09-01'));
    const hk = await store.append({ ...flow('2026-09-29'), provenance: 'imported', source_app: 'com.other', external_id: 'healthkit:hk1' });
    const hc = await store.append({ ...flow('2026-10-01'), provenance: 'imported', source_app: 'com.other', external_id: 'healthconnect:hc1' });
    const gone = await store.append({ ...flow('2026-10-02'), provenance: 'imported', source_app: 'com.other', external_id: 'healthkit:hk2' });
    await store.retract(gone.id);
    await link(hk.id, 'healthkit', 'hk1');
    // no link for `gone`: the platform deleted the record, so its link was removed, and it must still stay out
    await link(hc.id, 'healthconnect', 'hc1');
    await link(mine.id, 'healthkit', 'hk-dup'); // a duplicate link on our own manual event: the event is ours
    const bytes = await createBackup(db, store, { passphrase: 'pw', deviceSecret: secret, clock: clock(), kdf: fast });
    const { names, events } = await eventsOf(bytes);
    expect(events.map((e) => e.id).sort()).toEqual([mine.id, hc.id].sort());
    expect(names).not.toContain('daily.csv'); // derived files would carry the same days
  });
  it('restores into a fresh database without a dangling retract', async () => {
    const hk = await store.append({ ...flow('2026-09-29'), provenance: 'imported', source_app: 'com.other', external_id: 'healthkit:hk1' });
    await store.append(flow('2026-09-01'));
    await store.retract(hk.id);
    await link(hk.id, 'healthkit', 'hk1');
    const bytes = await createBackup(db, store, { passphrase: 'pw', deviceSecret: secret, clock: clock(), kdf: fast });
    const db2 = openTestDb();
    await migrate(db2);
    const store2 = new EventStore(db2, clock());
    expect(await restoreBackup(db2, store2, bytes, 'pw', secret)).toMatchObject({ imported: 1 });
    expect((await store2.events()).map((e) => e.kind)).toEqual(['flow']);
  });
});
