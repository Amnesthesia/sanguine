import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from './database';
import { migrate } from './migrate';
import { MIGRATIONS } from './migrations';
import { openTestDb } from './testDb';

let db: Database;
beforeEach(() => { db = openTestDb(); });

const tables = async () => (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).map((r) => r.name);
const ev = (id: string, extra: Record<string, string | number | null> = {}) => {
  const row = { id, lamport: 1, device_id: 'd', recorded_at: '2026-10-10T08:00:00+10:00', effective_day: '2026-10-10', tz: 'Australia/Sydney', kind: 'flow', payload: '{}', provenance: 'manual', retracts: null, ...extra };
  return db.run(`INSERT INTO event (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`, Object.values(row));
};

describe('migrations', () => {
  it('creates every table in PLAN.md §5.2', async () => {
    await migrate(db);
    expect(await tables()).toEqual(['biomarker', 'cycle', 'daily_log', 'event', 'health_link', 'health_sync', 'life_state', 'prediction_score', 'schema_migration', 'setting']);
  });
  it('records each version once and is idempotent', async () => {
    const first = await migrate(db, MIGRATIONS, () => '2026-10-10T00:00:00Z');
    expect(first).toEqual({ applied: MIGRATIONS.map((m) => m.version), current: MIGRATIONS.length });
    expect(await migrate(db)).toEqual({ applied: [], current: MIGRATIONS.length });
    expect(await db.all('SELECT * FROM schema_migration')).toEqual(MIGRATIONS.map((m) => ({ version: m.version, applied_at: '2026-10-10T00:00:00Z' })));
  });
  it('002 widens daily_log.flow_kind for post_pregnancy and keeps existing rows (P3-12)', async () => {
    await migrate(db, MIGRATIONS.slice(0, 1));
    await ev('e1');
    await db.run("INSERT INTO daily_log (day, flow, flow_kind, updated_event) VALUES ('2026-10-09', 'medium', 'period', 'e1')");
    expect(await migrate(db)).toMatchObject({ applied: [2] });
    expect(await db.all('SELECT day, flow_kind FROM daily_log')).toEqual([{ day: '2026-10-09', flow_kind: 'period' }]);
    await db.run("INSERT INTO daily_log (day, flow, flow_kind, updated_event) VALUES ('2026-10-10', 'heavy', 'post_pregnancy', 'e1')");
    await expect(db.run("INSERT INTO daily_log (day, flow, flow_kind, updated_event) VALUES ('2026-10-11', 'heavy', 'nonsense', 'e1')")).rejects.toThrow(/CHECK/);
  });
  it('applies later migrations in order and only the pending ones', async () => {
    await migrate(db);
    const next = MIGRATIONS.length + 1;
    const more = [...MIGRATIONS, { version: next, name: 'extra', sql: 'CREATE TABLE extra (x INTEGER);' }];
    expect(await migrate(db, more)).toEqual({ applied: [next], current: next });
    expect(await tables()).toContain('extra');
  });
  it('rolls a failing migration back completely and does not record it', async () => {
    await migrate(db);
    const bad = [...MIGRATIONS, { version: MIGRATIONS.length + 1, name: 'bad', sql: 'CREATE TABLE half (x INTEGER); CREATE TABLE half (y INTEGER);' }];
    await expect(migrate(db, bad)).rejects.toThrow();
    expect(await tables()).not.toContain('half');
    expect((await db.all<{ version: number }>('SELECT version FROM schema_migration')).map((r) => r.version)).toEqual(MIGRATIONS.map((m) => m.version));
  });
  it('refuses a database that is newer than the app', async () => {
    await migrate(db);
    await db.run('INSERT INTO schema_migration VALUES (5, ?)', ['x']);
    await expect(migrate(db)).rejects.toThrow(/newer than this app/);
  });
  it('rejects gaps and duplicates in the numbering', async () => {
    await expect(migrate(db, [{ version: 2, name: 'x', sql: '' }])).rejects.toThrow(/numbered 1\.\.n/);
    await expect(migrate(db, [MIGRATIONS[0] as never, MIGRATIONS[0] as never])).rejects.toThrow(/numbered/);
  });
});

describe('append-only event log (non-negotiable)', () => {
  beforeEach(async () => { await migrate(db); });
  it('accepts inserts', async () => {
    await ev('e1');
    expect((await db.get<{ n: number }>('SELECT count(*) n FROM event'))?.n).toBe(1);
  });
  it('aborts UPDATE and DELETE on event rows', async () => {
    await ev('e1');
    await expect(db.run("UPDATE event SET payload = '{\"x\":1}' WHERE id = 'e1'")).rejects.toThrow(/append-only/);
    await expect(db.run("DELETE FROM event WHERE id = 'e1'")).rejects.toThrow(/append-only/);
    expect((await db.get<{ payload: string }>("SELECT payload FROM event WHERE id='e1'"))?.payload).toBe('{}');
  });
  it('a retract event must reference its target, and only retracts may', async () => {
    await ev('e1');
    await ev('r1', { kind: 'retract', retracts: 'e1' });
    await expect(ev('bad1', { kind: 'retract', retracts: null })).rejects.toThrow();
    await expect(ev('bad2', { kind: 'flow', retracts: 'e1' })).rejects.toThrow();
    await expect(ev('bad3', { kind: 'retract', retracts: 'missing' })).rejects.toThrow();
  });
  it('validates provenance and the effective day format', async () => {
    await expect(ev('p', { provenance: 'robot' })).rejects.toThrow();
    await expect(ev('d', { effective_day: '10/10/2026' })).rejects.toThrow();
  });
});

describe('projection constraints', () => {
  beforeEach(async () => { await migrate(db); });
  it('cycle start days are unique and quality is constrained', async () => {
    await db.run("INSERT INTO cycle (id, start_day, quality) VALUES ('a', '2026-10-01', 'valid')");
    await expect(db.run("INSERT INTO cycle (id, start_day, quality) VALUES ('b', '2026-10-01', 'valid')")).rejects.toThrow();
    await expect(db.run("INSERT INTO cycle (id, start_day, quality) VALUES ('c', '2026-11-01', 'weird')")).rejects.toThrow();
  });
});

describe('transactions', () => {
  it('nested transactions join the outer one and roll back together', async () => {
    await migrate(db);
    await expect(db.transaction(async (tx) => {
      await tx.run("INSERT INTO setting VALUES ('a', '1')");
      await tx.transaction(async (inner) => { await inner.run("INSERT INTO setting VALUES ('b', '2')"); });
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(await db.all('SELECT * FROM setting')).toEqual([]);
  });
});
