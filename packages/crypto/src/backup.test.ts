import { argon2id } from '@noble/hashes/argon2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { type Argon2id, BackupError, DEFAULT_KDF, HEADER_BYTES, keyForFile, openBackup, openBackupWithKey, precomputeKey, readHeader, sealBackup } from './backup';
import { newDeviceSecret, recoveryWordsToSecret, secretToRecoveryWords } from './recovery';

/** Deterministic "random": fills each request with a counter-offset pattern. */
function fixedRandom(start = 1) {
  let c = start;
  return (n: number) => Uint8Array.from({ length: n }, () => c++ % 256);
}
const LOW = { memKiB: 256, iterations: 1, parallelism: 1 };
const secret = Uint8Array.from({ length: 32 }, (_, i) => 0xa0 + i);
const payload = new TextEncoder().encode('{"id":"e1"}\n{"id":"e2"}\n');
const seal = (over: object = {}) => sealBackup({ payload, passphrase: 'correct horse', deviceSecret: secret, random: fixedRandom(), kdf: LOW, ...over });

describe('Argon2id wiring', () => {
  it('matches the RFC 9106 Argon2id test vector', () => {
    const tag = argon2id(new Uint8Array(32).fill(1), new Uint8Array(16).fill(2), {
      t: 3, m: 32, p: 4, dkLen: 32, key: new Uint8Array(8).fill(3), personalization: new Uint8Array(12).fill(4),
    });
    expect(bytesToHex(tag)).toBe('0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659');
  });
});

describe('backup.v1 file format (§6.3)', () => {
  it('round-trips', async () => {
    const f = await seal();
    expect(await openBackup(f, 'correct horse', secret)).toEqual(payload);
  });
  it('has the documented layout: magic, version, KDF, salt, nonce, length, ciphertext, 32-byte HMAC', async () => {
    const f = await seal();
    expect(new TextDecoder().decode(f.subarray(0, 4))).toBe('SGB1');
    const h = readHeader(f);
    expect(h.kdf).toEqual(LOW);
    expect(h.salt).toHaveLength(16);
    expect(h.nonce).toHaveLength(24);
    expect(h.ctLen).toBe(payload.length + 16);
    expect(f).toHaveLength(HEADER_BYTES + payload.length + 16 + 32);
  });
  it('fixed vector (regression pin: the same inputs always give the same bytes)', async () => {
    const f = await seal();
    expect(bytesToHex(f)).toBe(PINNED);
    expect(await openBackup(Uint8Array.from(Buffer.from(PINNED, 'hex')), 'correct horse', secret)).toEqual(payload);
  });
  it('the default KDF is 64 MiB, 3 iterations', () => expect(DEFAULT_KDF).toEqual({ memKiB: 65536, iterations: 3, parallelism: 1 }));
  it('works with the full default cost', async () => {
    const f = await sealBackup({ payload, passphrase: 'x', deviceSecret: secret, random: fixedRandom() });
    expect(readHeader(f).kdf).toEqual(DEFAULT_KDF);
    expect(await openBackup(f, 'x', secret)).toEqual(payload);
  }, 120_000);
  it('different salt and nonce each time, so ciphertexts differ', async () => {
    const r = fixedRandom();
    const a = await seal({ random: r });
    const b = await seal({ random: r });
    expect(bytesToHex(a)).not.toBe(bytesToHex(b));
  });
  it('handles an empty and a large payload', async () => {
    expect(await openBackup(await seal({ payload: new Uint8Array(0) }), 'correct horse', secret)).toEqual(new Uint8Array(0));
    const big = Uint8Array.from({ length: 300_000 }, (_, i) => i % 251);
    expect(await openBackup(await seal({ payload: big }), 'correct horse', secret)).toEqual(big);
  });
  it('normalises the passphrase (NFKC) so composed and decomposed forms match', async () => {
    const f = await seal({ passphrase: 'café' });
    expect(await openBackup(f, 'café', secret)).toEqual(payload);
  });
});

describe('authentication', () => {
  const expectAuth = async (p: Promise<unknown>) => expect(await p.then(() => null, (e: BackupError) => e.code)).toBe('auth');
  it('wrong passphrase', async () => expectAuth(openBackup(await seal(), 'wrong', secret)));
  it('wrong device secret: the cloud file plus a guessed passphrase is not enough', async () => {
    const other = secret.slice();
    other[0] = (other[0] as number) ^ 1;
    await expectAuth(openBackup(await seal(), 'correct horse', other));
  });
  it('any single flipped bit anywhere in the file is rejected', async () => {
    const f = await seal();
    for (let i = 0; i < f.length; i += 1) {
      const t = f.slice();
      t[i] = (t[i] as number) ^ 0x01;
      const err = await openBackup(t, 'correct horse', secret).then(() => null, (e: BackupError) => e);
      expect(err, `byte ${i}`).toBeInstanceOf(BackupError);
    }
  }, 120_000);
});

describe('malformed input', () => {
  const code = async (f: Uint8Array) => (await openBackup(f, 'correct horse', secret).then(() => null, (e: BackupError) => e.code));
  it('bad magic, truncated, trailing data', async () => {
    const f = await seal();
    expect(await code(new Uint8Array(10))).toBe('format');
    expect(await code(f.slice(0, f.length - 1))).toBe('format');
    expect(await code(new Uint8Array([...f, 0]))).toBe('format');
    const bad = f.slice();
    bad[0] = 0;
    expect(await code(bad)).toBe('format');
  });
  it('future version', async () => {
    const f = await seal();
    f[4] = 2;
    expect(await code(f)).toBe('version');
  });
  it('a header asking for absurd KDF cost is refused before any key derivation', async () => {
    const f = await seal();
    new DataView(f.buffer).setUint32(6, 4 * 1024 * 1024); // 4 GiB
    expect(await code(f)).toBe('params');
    const g = await seal();
    g[14] = 0;
    expect(await code(g)).toBe('params');
  });
  it('rejects empty passphrases, wrong-size secrets and out-of-range KDF settings when sealing', async () => {
    await expect(seal({ passphrase: '' })).rejects.toThrow(/empty/);
    await expect(seal({ deviceSecret: new Uint8Array(5) })).rejects.toThrow(/32 bytes/);
    await expect(seal({ kdf: { memKiB: 1 << 30 } })).rejects.toThrow(/range/);
  });
});

describe('recovery code', () => {
  const s = Uint8Array.from({ length: 32 }, (_, i) => i);
  it('is 24 words and round-trips the secret', () => {
    const w = secretToRecoveryWords(s);
    expect(w.split(' ')).toHaveLength(24);
    expect(recoveryWordsToSecret(w)).toEqual(s);
  });
  it('known vector: 32 zero bytes', () =>
    expect(secretToRecoveryWords(new Uint8Array(32))).toBe(`${'abandon '.repeat(23)}art`));
  it('forgives case, newlines, numbering and extra spaces', () => {
    const w = secretToRecoveryWords(s).split(' ');
    expect(recoveryWordsToSecret(w.map((x, i) => `${i + 1}. ${x.toUpperCase()}`).join('\n  '))).toEqual(s);
  });
  it('rejects a typo (checksum), a wrong word and the wrong word count', () => {
    const w = secretToRecoveryWords(s).split(' ');
    expect(recoveryWordsToSecret([...w.slice(0, 23), w[22] as string].join(' '))).toBeNull();
    expect(recoveryWordsToSecret([...w.slice(0, 23), 'zzzzzz'].join(' '))).toBeNull();
    expect(recoveryWordsToSecret(w.slice(0, 12).join(' '))).toBeNull();
    expect(recoveryWordsToSecret('')).toBeNull();
  });
  it('newDeviceSecret asks the injected RNG for 32 bytes', () => expect(newDeviceSecret(fixedRandom())).toHaveLength(32));
  it('the recovered secret opens a backup', async () => {
    const f = await seal();
    expect(await openBackup(f, 'correct horse', recoveryWordsToSecret(secretToRecoveryWords(secret)) as Uint8Array)).toEqual(payload);
  });
});

// Independently verified: this exact file decrypts with argon2-cffi (Argon2id), hashlib HKDF/HMAC and libsodium's
// XChaCha20-Poly1305 (PyNaCl), so the format is not only self-consistent.
const PINNED =
  '534742310101000001000000000101000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728000000283d9cedf5abec7940c4f30194d29c11d72824a45c961001015b2140667537c819e7f9d136bf5bb69ff09b6da6c265cd57319b0b4423bf445c206ff94fbdb44fcfd3bd9987d07e39a6';

describe('precomputed key (D-061)', () => {
  const fast = { memKiB: 64, iterations: 1, parallelism: 1 };
  const rnd = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + n) % 256);
  const secret = new Uint8Array(32).fill(9);
  const payload = new TextEncoder().encode('events');
  it('a file sealed without the passphrase opens with the passphrase', async () => {
    const pre = await precomputeKey('correct horse', rnd, fast);
    const file = await sealBackup({ payload, passphrase: '', deviceSecret: secret, random: rnd, precomputed: pre });
    expect(new TextDecoder().decode(await openBackup(file, 'correct horse', secret))).toBe('events');
    await expect(openBackup(file, 'wrong', secret)).rejects.toMatchObject({ code: 'auth' });
  });
  it('reuses the salt but never the nonce, so two files differ', async () => {
    const pre = await precomputeKey('correct horse', rnd, fast);
    let n = 0;
    const fresh = (k: number) => Uint8Array.from({ length: k }, (_, i) => (i + 31 * ++n) % 256);
    const a = await sealBackup({ payload, passphrase: '', deviceSecret: secret, random: fresh, precomputed: pre });
    const b = await sealBackup({ payload, passphrase: '', deviceSecret: secret, random: fresh, precomputed: pre });
    expect(readHeader(a).salt).toEqual(readHeader(b).salt);
    expect(readHeader(a).nonce).not.toEqual(readHeader(b).nonce);
    expect(a).not.toEqual(b);
  });
  it('still needs the device secret', async () => {
    const pre = await precomputeKey('correct horse', rnd, fast);
    const file = await sealBackup({ payload, passphrase: '', deviceSecret: secret, random: rnd, precomputed: pre });
    await expect(openBackup(file, 'correct horse', new Uint8Array(32).fill(1))).rejects.toMatchObject({ code: 'auth' });
  });
  it('a file made with the older 19 MiB cost still opens (parameters travel in the header)', async () => {
    const file = await sealBackup({ payload, passphrase: 'pw', deviceSecret: secret, random: rnd, kdf: { memKiB: 19 * 1024, iterations: 2, parallelism: 1 } });
    expect(readHeader(file).kdf).toEqual({ memKiB: 19 * 1024, iterations: 2, parallelism: 1 });
    expect(new TextDecoder().decode(await openBackup(file, 'pw', secret))).toBe('events');
  });
});

describe('injected Argon2id (native libsodium on the phone)', () => {
  const fast = { memKiB: 64, iterations: 1, parallelism: 1 };
  const rnd = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 11 + n) % 256);
  const secret = new Uint8Array(32).fill(3);
  const payload = new TextEncoder().encode('events');
  // stands in for libsodium: any implementation of the standard function gives the same bytes
  const viaNoble: Argon2id = async (pw, salt, k) => argon2id(pw, salt, { t: k.iterations, m: k.memKiB, p: k.parallelism, dkLen: 32 });
  it('a file sealed with the injected function opens with the built-in one and the other way round', async () => {
    let calls = 0;
    const counted: Argon2id = async (...a) => { calls++; return viaNoble(...a); };
    const sealed = await sealBackup({ payload, passphrase: 'pw', deviceSecret: secret, random: rnd, kdf: fast, argon2id: counted });
    expect(calls).toBe(1);
    expect(new TextDecoder().decode(await openBackup(sealed, 'pw', secret))).toBe('events');
    const builtIn = await sealBackup({ payload, passphrase: 'pw', deviceSecret: secret, random: rnd, kdf: fast });
    expect(new TextDecoder().decode(await openBackup(builtIn, 'pw', secret, undefined, counted))).toBe('events');
    expect(calls).toBe(2);
  });
  it('precomputeKey uses it too', async () => {
    let calls = 0;
    const counted: Argon2id = async (...a) => { calls++; return viaNoble(...a); };
    await precomputeKey('pw', rnd, fast, undefined, counted);
    expect(calls).toBe(1);
  });
});

describe('key from an existing file (P8-7, D-083)', () => {
  const fast = { memKiB: 64, iterations: 1, parallelism: 1 };
  let n = 0;
  const rnd = (k: number) => Uint8Array.from({ length: k }, (_, i) => (i * 13 + 7 * ++n) % 256);
  const secret = new Uint8Array(32).fill(9);
  const payload = new TextEncoder().encode('events');
  it('a second phone derives the same key from the file and both open each other\'s files without the passphrase', async () => {
    const phoneA = await precomputeKey('correct horse', rnd, fast);
    const fromA = await sealBackup({ payload, passphrase: '', deviceSecret: secret, random: rnd, precomputed: phoneA });
    const phoneB = await keyForFile(fromA, 'correct horse');
    expect(phoneB).toEqual(phoneA);
    const fromB = await sealBackup({ payload: new TextEncoder().encode('more'), passphrase: '', deviceSecret: secret, random: rnd, precomputed: phoneB });
    expect(new TextDecoder().decode(await openBackupWithKey(fromB, phoneA, secret))).toBe('more');
    expect(new TextDecoder().decode(await openBackupWithKey(fromA, phoneB, secret))).toBe('events');
  });
  it('a different salt, passphrase or device secret is auth, never a wrong decryption', async () => {
    const key = await precomputeKey('correct horse', rnd, fast);
    const file = await sealBackup({ payload, passphrase: '', deviceSecret: secret, random: rnd, precomputed: key });
    const other = await precomputeKey('correct horse', rnd, fast);
    await expect(openBackupWithKey(file, other, secret)).rejects.toMatchObject({ code: 'auth' });
    await expect(openBackupWithKey(file, await keyForFile(file, 'wrong'), secret)).rejects.toMatchObject({ code: 'auth' });
    await expect(openBackupWithKey(file, key, new Uint8Array(32).fill(1))).rejects.toMatchObject({ code: 'auth' });
    await expect(keyForFile(file, '')).rejects.toMatchObject({ code: 'params' });
  });
});
