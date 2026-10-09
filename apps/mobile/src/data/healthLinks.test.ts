import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from './database';
import { sqliteLinks } from './healthLinks';
import { migrate } from './migrate';
import { openTestDb } from './testDb';

let db: Database;
beforeEach(async () => {
  db = openTestDb();
  await migrate(db);
  await db.run("INSERT INTO event (id, lamport, device_id, recorded_at, effective_day, tz, kind, payload, provenance, retracts) VALUES ('e1', 1, 'd', 't', '2026-10-05', 'UTC', 'flow', '{}', 'manual', NULL)");
});
const row = (o: Partial<Parameters<ReturnType<typeof sqliteLinks>['put']>[0]> = {}) => ({ eventId: 'e1', platform: 'healthkit' as const, externalId: 'x1', direction: 'wrote' as const, contentHash: 'h1', writtenAt: '2026-10-09T08:00:00Z', ...o });

describe('sqliteLinks', () => {
  it('stores and finds a link by external id and by event id', async () => {
    const l = sqliteLinks(db);
    await l.put(row());
    expect(await l.byExternalId('healthkit', 'x1')).toEqual(row());
    expect(await l.byEventId('e1')).toEqual([row()]);
    expect(await l.byExternalId('healthconnect', 'x1')).toBeNull();
  });
  it('put replaces a link with the same platform and external id', async () => {
    const l = sqliteLinks(db);
    await l.put(row());
    await l.put(row({ direction: 'read', contentHash: 'h2' }));
    expect(await l.byEventId('e1')).toEqual([row({ direction: 'read', contentHash: 'h2' })]);
  });
  it('removes a link', async () => {
    const l = sqliteLinks(db);
    await l.put(row());
    await l.remove('healthkit', 'x1');
    expect(await l.byEventId('e1')).toEqual([]);
  });
  it('wroteHashesSince returns only our writes at or after the time, on that platform', async () => {
    const l = sqliteLinks(db);
    await l.put(row({ externalId: 'a', contentHash: 'new', writtenAt: '2026-10-09T08:00:00Z' }));
    await l.put(row({ externalId: 'b', contentHash: 'old', writtenAt: '2026-10-01T08:00:00Z' }));
    await l.put(row({ externalId: 'c', contentHash: 'read', direction: 'read', writtenAt: '2026-10-09T08:00:00Z' }));
    await l.put(row({ externalId: 'd', contentHash: 'other', platform: 'healthconnect', writtenAt: '2026-10-09T08:00:00Z' }));
    expect([...(await l.wroteHashesSince('healthkit', '2026-10-08T00:00:00Z'))]).toEqual(['new']);
  });
  it('keeps one anchor per platform and type and overwrites it', async () => {
    const l = sqliteLinks(db);
    expect(await l.anchor('healthkit', 'bbt')).toBeNull();
    await l.setAnchor('healthkit', 'bbt', 'A1', '2026-10-09T08:00:00Z');
    await l.setAnchor('healthkit', 'bbt', 'A2', '2026-10-09T09:00:00Z');
    await l.setAnchor('healthkit', 'lh', 'L1', '2026-10-09T09:00:00Z');
    expect(await l.anchor('healthkit', 'bbt')).toBe('A2');
    expect(await l.anchor('healthkit', 'lh')).toBe('L1');
    expect(await l.anchor('healthconnect', 'bbt')).toBeNull();
    expect(await db.all('SELECT last_sync_at FROM health_sync WHERE data_type = ?', ['bbt'])).toEqual([{ last_sync_at: '2026-10-09T09:00:00Z' }]);
  });
});
