// The only database surface the app uses. `expoDatabase.ts` implements it on expo-sqlite; tests use better-sqlite3.
// Phase 3 turns on SQLCipher: `open(name, key)` already accepts the key and ignores it until then (PLAN.md §6.1, P3-2).
export type SqlValue = string | number | null | Uint8Array;

export interface Database {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): Promise<T | undefined>;
  /** Runs `fn` atomically. A nested call joins the outer transaction. */
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface DatabaseOpener {
  /** `key` is the SQLCipher key from Secure Store (Phase 3); accepted now, ignored until then. */
  open(name: string, key?: string): Promise<Database>;
}
