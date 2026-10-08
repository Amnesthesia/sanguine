import { BackupError, newDeviceSecret, recoveryWordsToSecret, secretToRecoveryWords } from '@sanguine/crypto';
import { describe, expect, it } from 'vitest';
import { readHeader } from '@sanguine/crypto';
import { BACKUP_KDF, createBackup, restoreBackup } from './backup';
import type { Database } from './database';
import type { Clock } from './ids';
import { migrate } from './migrate';
import { EventStore } from './store';
import { openTestDb } from './testDb';

const LOW = { memKiB: 256, iterations: 1, parallelism: 1 };
function clock(seed: number): Clock {
  let n = seed;
  return { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n++ * 13 + i + seed) % 256) };
}
async function device(seed: number): Promise<{ db: Database; store: EventStore; clk: Clock }> {
  const db = openTestDb();
  await migrate(db);
  const clk = clock(seed);
  return { db, store: new EventStore(db, clk), clk };
}
const dump = async (db: Database) => JSON.stringify(await Promise.all(['cycle', 'daily_log', 'biomarker', 'life_state'].map((t) => db.all(`SELECT * FROM ${t} ORDER BY 1`))));

describe('encrypted backup (P2-5)', () => {
  it('round-trips through a recovery code onto a new device, including the profile', async () => {
    const a = await device(1);
    await a.store.setProfile({ birthYear: 1990, menarcheYear: 2003 });
    for (const d of ['2026-08-04', '2026-09-01', '2026-09-30']) await a.store.append({ kind: 'flow', payload: { day: d, level: 'medium', flow_kind: 'period' } });
    await a.store.append({ kind: 'symptom', payload: { day: '2026-10-01', code: 'cramps', intensity: 2 } });
    const secret = newDeviceSecret((n) => a.clk.randomBytes(n));
    const file = await createBackup(a.db, a.store, { passphrase: 'a long passphrase', deviceSecret: secret, clock: a.clk, kdf: LOW });

    const words = secretToRecoveryWords(secret); // shown once to the user
    const b = await device(2);
    const r = await restoreBackup(b.db, b.store, file, 'a long passphrase', recoveryWordsToSecret(words) as Uint8Array);
    expect(r.imported).toBe((await a.store.events()).length);
    expect(await dump(b.db)).toBe(await dump(a.db));
    expect(await b.store.profile()).toEqual({ birthYear: 1990, menarcheYear: 2003 });
  });
  it('a wrong passphrase or secret fails before writing anything', async () => {
    const a = await device(1);
    await a.store.append({ kind: 'flow', payload: { day: '2026-08-04', level: 'medium', flow_kind: 'period' } });
    const secret = newDeviceSecret((n) => a.clk.randomBytes(n));
    const file = await createBackup(a.db, a.store, { passphrase: 'right', deviceSecret: secret, clock: a.clk, kdf: LOW });
    const b = await device(2);
    await expect(restoreBackup(b.db, b.store, file, 'wrong', secret)).rejects.toBeInstanceOf(BackupError);
    await expect(restoreBackup(b.db, b.store, file, 'right', newDeviceSecret((n) => b.clk.randomBytes(n)))).rejects.toMatchObject({ code: 'auth' });
    expect(await b.store.events()).toEqual([]);
  });
  it('the backup file reveals none of the log', async () => {
    const a = await device(1);
    await a.store.append({ kind: 'symptom', payload: { day: '2026-10-01', code: 'a_very_recognisable_code', intensity: 2 } });
    const secret = newDeviceSecret((n) => a.clk.randomBytes(n));
    const file = await createBackup(a.db, a.store, { passphrase: 'p', deviceSecret: secret, clock: a.clk, kdf: LOW });
    const text = Buffer.from(file).toString('latin1');
    expect(text).not.toContain('a_very_recognisable_code');
    expect(text).not.toContain('2026-10-01');
    expect(text).not.toContain('events.jsonl');
  });
  it('restoring over an existing log merges and does not overwrite an existing profile', async () => {
    const a = await device(1);
    await a.store.setProfile({ birthYear: 1990 });
    await a.store.append({ kind: 'flow', payload: { day: '2026-08-04', level: 'medium', flow_kind: 'period' } });
    const secret = newDeviceSecret((n) => a.clk.randomBytes(n));
    const file = await createBackup(a.db, a.store, { passphrase: 'p', deviceSecret: secret, clock: a.clk, kdf: LOW });
    const b = await device(2);
    await b.store.setProfile({ birthYear: 1985 });
    await restoreBackup(b.db, b.store, file, 'p', secret);
    expect((await b.store.profile()).birthYear).toBe(1985);
    expect(await b.db.all('SELECT start_day FROM cycle')).toEqual([{ start_day: '2026-08-04' }]);
  });
});

describe('backup KDF cost in the JavaScript build', () => {
  it('defaults to the OWASP minimum recorded in the header (the plan\'s 64 MiB is Phase 3, native)', async () => {
    const a = await device(1);
    const secret = newDeviceSecret((n) => a.clk.randomBytes(n));
    const file = await createBackup(a.db, a.store, { passphrase: 'p', deviceSecret: secret, clock: a.clk });
    expect(readHeader(file).kdf).toEqual(BACKUP_KDF);
    expect(BACKUP_KDF).toEqual({ memKiB: 19456, iterations: 2, parallelism: 1 });
  }, 60_000);
});
