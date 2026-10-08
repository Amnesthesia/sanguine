// The only database surface the app uses. `expoDatabase.ts` implements it on expo-sqlite; tests use better-sqlite3.
// SQLCipher since P3-2: the app opens with the key from Secure Store; the test opener ignores it (PLAN.md §6.1).
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
  /** `key` is the SQLCipher key from Secure Store, 64 hex characters (required by the app opener since P3-2). */
  open(name: string, key?: string): Promise<Database>;
}
