// expo-sqlite implementation of Database (plain SQLite in Phases 0-2; SQLCipher via `useSQLCipher` in P3-2).
import * as SQLite from 'expo-sqlite';
import type { Database, DatabaseOpener, SqlValue } from './database';

function wrap(raw: SQLite.SQLiteDatabase): Database {
  let depth = 0;
  const db: Database = {
    exec: (sql) => raw.execAsync(sql),
    run: async (sql, params) => ({ changes: (await raw.runAsync(sql, (params ?? []) as SQLite.SQLiteBindValue[])).changes }),
    all: <T>(sql: string, params?: SqlValue[]) => raw.getAllAsync<T>(sql, (params ?? []) as SQLite.SQLiteBindValue[]),
    get: async <T>(sql: string, params?: SqlValue[]) => (await raw.getFirstAsync<T>(sql, (params ?? []) as SQLite.SQLiteBindValue[])) ?? undefined,
    async transaction<T>(fn: (d: Database) => Promise<T>): Promise<T> {
      if (depth > 0) return fn(db);
      let out!: T;
      depth++;
      try {
        await raw.withTransactionAsync(async () => { out = await fn(db); });
      } finally {
        depth--;
      }
      return out;
    },
    close: () => raw.closeAsync(),
  };
  return db;
}

export const expoDatabase: DatabaseOpener = {
  // `key` is accepted for the Phase 3 SQLCipher switch and deliberately ignored here.
  async open(name, _key) {
    const raw = await SQLite.openDatabaseAsync(name);
    await raw.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    return wrap(raw);
  },
};
