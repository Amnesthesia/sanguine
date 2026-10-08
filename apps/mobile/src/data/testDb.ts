// Test-only: the Database interface on better-sqlite3 (Node), so data-layer tests run the same SQL as the app.
import BetterSqlite from 'better-sqlite3';
import type { Database, SqlValue } from './database';

export function openTestDb(): Database {
  const raw = new BetterSqlite(':memory:');
  raw.pragma('foreign_keys = ON');
  let depth = 0;
  const bind = (p?: SqlValue[]) => (p ?? []).map((v) => (v instanceof Uint8Array ? Buffer.from(v) : v));
  const db: Database = {
    async exec(sql) { raw.exec(sql); },
    async run(sql, params) { return { changes: raw.prepare(sql).run(...bind(params)).changes }; },
    async all<T>(sql: string, params?: SqlValue[]) { return raw.prepare(sql).all(...bind(params)) as T[]; },
    async get<T>(sql: string, params?: SqlValue[]) { return raw.prepare(sql).get(...bind(params)) as T | undefined; },
    async transaction<T>(fn: (d: Database) => Promise<T>): Promise<T> {
      if (depth > 0) return fn(db);
      raw.exec('BEGIN');
      depth++;
      try {
        const out = await fn(db);
        raw.exec('COMMIT');
        return out;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
    async close() { raw.close(); },
  };
  return db;
}
