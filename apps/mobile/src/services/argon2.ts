// Native Argon2id (libsodium) for the backup key (PLAN.md §6.3, D-034 follow-up). Same function as the JavaScript one, about two orders of
// magnitude faster, so the phone can use the plan's 64 MiB x 3 instead of the 19 MiB x 2 the JavaScript build needed.
import { type Argon2id, DEFAULT_KDF, type KdfParams } from '@sanguine/crypto';
import { BACKUP_KDF } from '@/data/backup';

const ARGON2ID13 = 2; // crypto_pwhash_ALG_ARGON2ID13
let cached: Argon2id | null | undefined;

export function nativeArgon2(): Argon2id | null {
  if (cached !== undefined) return cached;
  try {
    const s = require('react-native-libsodium') as { crypto_pwhash: (len: number, pw: Uint8Array, salt: Uint8Array, ops: number, mem: number, alg: number) => Uint8Array; crypto_pwhash_ALG_ARGON2ID13?: number };
    cached = async (pw, salt, k) => {
      if (k.parallelism !== 1) throw new Error('libsodium runs Argon2id with one lane');
      return s.crypto_pwhash(32, pw, salt, k.iterations, k.memKiB * 1024, s.crypto_pwhash_ALG_ARGON2ID13 ?? ARGON2ID13);
    };
  } catch {
    cached = null; // Expo Go or a build without the module
  }
  return cached;
}

/** What to pass to `createBackup`: the plan's cost with the native function, the lighter JavaScript cost without it. */
export function backupCrypto(): { kdf: KdfParams; argon2id?: Argon2id } {
  const native = nativeArgon2();
  return native ? { kdf: DEFAULT_KDF, argon2id: native } : { kdf: BACKUP_KDF };
}
