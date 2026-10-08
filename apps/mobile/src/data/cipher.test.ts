import { describe, expect, it } from 'vitest';
import type { Database } from './database';
import { keyClause, openKeyed, type RawOpener } from './cipher';

const K1 = 'a'.repeat(64);
const K2 = 'b'.repeat(64);

/** A file system of SQLCipher files: each has the key it is encrypted with (null = plain) and its rows. */
function fakeFs(files: Record<string, { key: string | null; rows: string[] }>) {
  const log: string[] = [];
  let crashBeforeRename = false;
  const raw: RawOpener = {
    path: (name) => `/data/${name}`,
    remove: async (name) => { if (files[name]) log.push(`rm ${name}`); delete files[name]; },
    exists: async (name) => name in files,
    rename: async (from, to) => {
      if (to in files) throw new Error('destination exists');
      if (crashBeforeRename) throw new Error('killed');
      files[to] = files[from] as (typeof files)[string];
      delete files[from];
      log.push(`mv ${from} ${to}`);
    },
    open: async (name) => {
      let session: string | null = null;
      const attached: Record<string, string> = {};
      const file = () => {
        files[name] ??= { key: session, rows: [] }; // created on first touch
        return files[name];
      };
      const db: Database = {
        exec: async (sql) => {
          const key = /^PRAGMA key = "x'(\w+)'"$/.exec(sql);
          const attach = /^ATTACH DATABASE '\/data\/(.+)' AS enc KEY "x'(\w+)'"$/.exec(sql);
          if (key) session = key[1] as string;
          else if (attach) {
            attached.enc = attach[1] as string;
            files[attached.enc] = { key: attach[2] as string, rows: [] };
          }
          else if (sql === "SELECT sqlcipher_export('enc')") (files[attached.enc as string] as { rows: string[] }).rows = [...file().rows];
          log.push(sql);
        },
        get: async <T>() => {
          if (file().key !== session) throw new Error('file is not a database');
          return { n: file().rows.length } as T;
        },
        run: async () => ({ changes: 0 }), all: async () => [], transaction: (fn) => fn(db), close: async () => {},
      };
      return db;
    },
  };
  return { raw, files, log, crashNextRename: (on: boolean) => { crashBeforeRename = on; } };
}

describe('keyClause', () => {
  it('accepts only a 32-byte hex key, so nothing else can reach the PRAGMA', () => {
    expect(keyClause(K1)).toBe(`"x'${K1}'"`);
    for (const bad of ['', 'abc', 'A'.repeat(64), `${'a'.repeat(63)}'`, `${'a'.repeat(62)}"; DROP TABLE event; --`]) expect(() => keyClause(bad)).toThrow();
  });
});

describe('openKeyed (P3-2)', () => {
  it('a new database is created encrypted with the key', async () => {
    const fs = fakeFs({});
    await openKeyed(fs.raw, 'sanguine.db', K1);
    expect(fs.files['sanguine.db']?.key).toBe(K1);
  });

  it('an encrypted database opens with its key and nothing is migrated', async () => {
    const fs = fakeFs({ 'sanguine.db': { key: K1, rows: ['e1'] } });
    const db = await openKeyed(fs.raw, 'sanguine.db', K1);
    expect(await db.get('x')).toEqual({ n: 1 });
    expect(fs.log.some((l) => l.startsWith('ATTACH'))).toBe(false);
  });

  it('a plain database from before P3-2 is exported into an encrypted file that replaces it, rows intact', async () => {
    const fs = fakeFs({ 'sanguine.db': { key: null, rows: ['e1', 'e2'] }, 'sanguine.db-wal': { key: null, rows: [] }, 'sanguine.db.encrypting': { key: K2, rows: ['stale'] } });
    const db = await openKeyed(fs.raw, 'sanguine.db', K1);
    expect(fs.files['sanguine.db']).toEqual({ key: K1, rows: ['e1', 'e2'] });
    expect(Object.keys(fs.files)).toEqual(['sanguine.db']);
    expect(await db.get('x')).toEqual({ n: 2 });
    // the stale temp file goes before ATTACH; the log is checkpointed before the export
    const at = (prefix: string) => fs.log.findIndex((l) => l.startsWith(prefix));
    const steps = [at('rm sanguine.db.encrypting'), at('PRAGMA wal_checkpoint'), at('ATTACH DATABASE'), at('SELECT sqlcipher_export'), at('mv sanguine.db.encrypting')];
    expect(steps.every((s, i) => s >= 0 && (i === 0 || s > (steps[i - 1] as number)))).toBe(true);
  });

  it('a run killed after the plain file was removed but before the rename is finished on the next open, rows intact', async () => {
    const fs = fakeFs({ 'sanguine.db': { key: null, rows: ['e1', 'e2'] } });
    fs.crashNextRename(true);
    await expect(openKeyed(fs.raw, 'sanguine.db', K1)).rejects.toThrow('killed');
    expect(Object.keys(fs.files)).toEqual(['sanguine.db.encrypting']); // the plain file is gone, the export is complete
    fs.crashNextRename(false);
    const db = await openKeyed(fs.raw, 'sanguine.db', K1);
    expect(fs.files['sanguine.db']).toEqual({ key: K1, rows: ['e1', 'e2'] });
    expect(await db.get('x')).toEqual({ n: 2 });
  });

  it('a database encrypted with another key is refused and left untouched', async () => {
    const fs = fakeFs({ 'sanguine.db': { key: K2, rows: ['e1'] } });
    await expect(openKeyed(fs.raw, 'sanguine.db', K1)).rejects.toThrow('cannot be opened');
    expect(fs.files['sanguine.db']).toEqual({ key: K2, rows: ['e1'] });
  });
});
