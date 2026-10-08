// Key/value settings stored in the `setting` table (JSON values). Not part of the event log: these are preferences, not facts about days.
import type { Database } from './database';

export async function getSetting<T>(db: Database, key: string, fallback: T): Promise<T> {
  const row = await db.get<{ value: string }>('SELECT value FROM setting WHERE key = ?', [key]);
  return row ? (JSON.parse(row.value) as T) : fallback;
}
export async function setSetting<T>(db: Database, key: string, value: T): Promise<void> {
  await db.run('INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, JSON.stringify(value)]);
}
