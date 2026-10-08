import { describe, expect, it } from 'vitest';
import { migrate } from './migrate';
import { EventStore } from './store';
import { openTestDb } from './testDb';
import { wipeAll } from './wipe';

describe('wipeAll', () => {
  it('removes every row including the append-only event log, and leaves a usable database', async () => {
    const db = openTestDb();
    await migrate(db);
    let n = 0;
    const store = new EventStore(db, { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'UTC', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) });
    await store.setProfile({ birthYear: 1990 });
    for (const d of ['2026-08-04', '2026-09-01', '2026-09-30']) await store.append({ kind: 'flow', payload: { day: d, level: 'medium', flow_kind: 'period' } });
    await store.append({ kind: 'note', payload: { day: '2026-09-30', cipher: 'n1:00' } });
    expect((await store.events()).length).toBeGreaterThan(0);

    await wipeAll(db);
    for (const t of ['event', 'cycle', 'daily_log', 'biomarker', 'life_state', 'prediction_score', 'setting', 'health_sync', 'health_link'])
      expect(await db.get(`SELECT COUNT(*) AS n FROM ${t}`), t).toEqual({ n: 0 });
    // fresh schema: append-only triggers are back and the store works again
    await expect(db.run('DELETE FROM event')).resolves.toBeDefined(); // empty table, nothing to abort
    const again = new EventStore(db, { nowMs: () => 9, iso: () => 'x', tz: () => 'UTC', randomBytes: (k) => new Uint8Array(k).fill(7) });
    await again.append({ kind: 'flow', payload: { day: '2026-10-01', level: 'light', flow_kind: 'period' } });
    await expect(db.run("UPDATE event SET kind = 'x'")).rejects.toThrow(/append-only/);
    expect((await db.all('SELECT version FROM schema_migration')).length).toBe(1);
  });
});
