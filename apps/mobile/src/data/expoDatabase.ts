// expo-sqlite implementation of Database, encrypted with SQLCipher (`useSQLCipher` in app.json, P3-2, D-043).
import { File } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import type { Database, DatabaseOpener, SqlValue } from './database';
import { openKeyed, type RawOpener } from './cipher';

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

const dir = (): string => SQLite.defaultDatabaseDirectory as string;
const fileIn = (name: string) => new File(dir().startsWith('file:') ? dir() : `file://${dir()}`, name);

const raw: RawOpener = {
  open: async (name) => wrap(await SQLite.openDatabaseAsync(name)),
  path: (name) => `${dir().replace(/^file:\/\//, '')}/${name}`,
  exists: async (name) => fileIn(name).exists,
  remove: async (name) => { const f = fileIn(name); if (f.exists) f.delete(); },
  rename: async (from, to) => fileIn(from).move(fileIn(to)),
};

/** Deletes the database and its side files. Only for the user's confirmed "start again" on an unreadable database. */
export async function discardDatabase(name: string): Promise<void> {
  for (const f of [name, `${name}-wal`, `${name}-shm`, `${name}.encrypting`]) await raw.remove(f);
}

export const expoDatabase: DatabaseOpener = {
  async open(name, key) {
    if (!key) throw new Error('the database key is required');
    const db = await openKeyed(raw, name, key);
    await db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    return db;
  },
};
