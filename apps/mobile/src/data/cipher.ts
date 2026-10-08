// SQLCipher open, and the one-time move of a plain database from before P3-2 into an encrypted one (D-043).
// Pure orchestration over `RawOpener`, so the decision logic is tested without the native library.
import type { Database } from './database';

export interface RawOpener {
  /** Opens (or creates) the named database without a key. */
  open(name: string): Promise<Database>;
  /** Absolute file path of the named database, for ATTACH. */
  path(name: string): string;
  exists(name: string): Promise<boolean>;
  /** Deletes the named file if it exists. */
  remove(name: string): Promise<void>;
  /** Renames `from` to `to`; `to` must not exist. */
  rename(from: string, to: string): Promise<void>;
}

/** The file exists but this key does not open it (e.g. the phone was restored from an OS backup, which never carries the key). */
export class KeyMismatchError extends Error {
  constructor() {
    super('the database cannot be opened with this key');
  }
}

/** SQLCipher's raw-key form: 32 bytes as hex, so no passphrase derivation runs on every open. Anything else is refused. */
export function keyClause(hex: string): string {
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error('database key must be 64 lowercase hex characters');
  return `"x'${hex}'"`;
}

async function readable(db: Database): Promise<boolean> {
  try {
    await db.get('SELECT count(*) AS n FROM sqlite_master');
    return true;
  } catch {
    return false;
  }
}

async function openWithKey(raw: RawOpener, name: string, key: string): Promise<Database | null> {
  const db = await raw.open(name);
  await db.exec(`PRAGMA key = ${key}`);
  if (await readable(db)) return db; // encrypted with this key, or a new file that will be
  await db.close();
  return null;
}

export async function openKeyed(raw: RawOpener, name: string, hex: string): Promise<Database> {
  const key = keyClause(hex);
  const tmp = `${name}.encrypting`;
  // A run killed between removing the plain file and renaming the export: the export is complete (the plain file is
  // only removed after it finished), so finish the rename instead of opening a new, empty database.
  if (!(await raw.exists(name)) && (await raw.exists(tmp))) await raw.rename(tmp, name);
  const db = await openWithKey(raw, name, key);
  if (db) return db;

  // Not readable with the key: a plain database from before P3-2, or one encrypted with another key.
  const plain = await raw.open(name);
  if (!(await readable(plain))) {
    await plain.close();
    // never deleted or overwritten here: the data may still be recoverable with the right key
    throw new KeyMismatchError();
  }
  await raw.remove(tmp); // left over from an interrupted run
  await plain.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  await plain.exec(`ATTACH DATABASE '${raw.path(tmp).replace(/'/g, "''")}' AS enc KEY ${key}`);
  await plain.exec("SELECT sqlcipher_export('enc')");
  await plain.exec('DETACH DATABASE enc');
  await plain.close();
  // Until the plain file is removed a crash only repeats the export; after it, the recovery step above finishes the rename.
  for (const suffix of ['-wal', '-shm']) await raw.remove(name + suffix);
  await raw.remove(name);
  await raw.rename(tmp, name);
  const enc = await openWithKey(raw, name, key);
  if (!enc) throw new Error('the encrypted database could not be opened after migration');
  return enc;
}
