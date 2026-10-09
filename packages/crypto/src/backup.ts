// PLAN.md §6.3: backup.v1 = header (magic, version, KDF parameters, salt, nonce, length) + XChaCha20-Poly1305 ciphertext + HMAC.
// key = Argon2id(passphrase, salt) XOR deviceSecret, so the file alone (cloud copy) plus a guessed passphrase is not enough.
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { argon2idAsync } from '@noble/hashes/argon2.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';

export const MAGIC = new Uint8Array([0x53, 0x47, 0x42, 0x31]); // "SGB1"
export const FORMAT_VERSION = 1;
const KDF_ARGON2ID = 1;
export const HEADER_BYTES = 60;
const SALT_BYTES = 16;
const NONCE_BYTES = 24;
const MAC_BYTES = 32;
const TAG_BYTES = 16;
export const DEVICE_SECRET_BYTES = 32;

export interface KdfParams { memKiB: number; iterations: number; parallelism: number }
/** PLAN.md §6.3: 64 MiB, 3 iterations. The values travel in the header so the cost can change without breaking old files. */
export const DEFAULT_KDF: KdfParams = { memKiB: 64 * 1024, iterations: 3, parallelism: 1 };
/** Upper bounds accepted when reading a file, so a crafted header cannot exhaust memory or time. */
const MAX_KDF: KdfParams = { memKiB: 256 * 1024, iterations: 10, parallelism: 4 };

export type BackupErrorCode = 'format' | 'version' | 'params' | 'auth';
export class BackupError extends Error {
  constructor(readonly code: BackupErrorCode, message: string) { super(message); this.name = 'BackupError'; }
}

export type Random = (n: number) => Uint8Array;
/** Argon2id (version 1.3, one lane). The default is the JavaScript one; the app injects libsodium's native one, which gives the same output. */
export type Argon2id = (password: Uint8Array, salt: Uint8Array, kdf: KdfParams, onProgress?: (fraction: number) => void) => Promise<Uint8Array>;
export interface SealOptions {
  payload: Uint8Array;
  passphrase: string;
  deviceSecret: Uint8Array;
  random: Random; // required: the package never reaches for a global RNG
  kdf?: Partial<KdfParams>;
  onProgress?: (fraction: number) => void;
  /** A key from `precomputeKey`: skips the KDF so an automatic upload needs no passphrase (D-061). The file still opens with the passphrase. */
  precomputed?: PrecomputedKey;
  argon2id?: Argon2id;
}
export interface PrecomputedKey { salt: Uint8Array; k0: Uint8Array; kdf: KdfParams }

const enc = new TextEncoder();
const norm = (s: string) => s.normalize('NFKC');

function checkSecret(secret: Uint8Array): void {
  if (secret.length !== DEVICE_SECRET_BYTES) throw new BackupError('params', `device secret must be ${DEVICE_SECRET_BYTES} bytes`);
}
function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= (a[i] as number) ^ (b[i] as number);
  return d === 0;
}
function concat(...xs: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(xs.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of xs) { out.set(x, o); o += x.length; }
  return out;
}

function argon(passphrase: string, salt: Uint8Array, kdf: KdfParams, onProgress?: (f: number) => void, native?: Argon2id): Promise<Uint8Array> {
  if (native) return native(enc.encode(norm(passphrase)), salt, kdf, onProgress);
  return argon2idAsync(enc.encode(norm(passphrase)), salt, {
    t: kdf.iterations, m: kdf.memKiB, p: kdf.parallelism, dkLen: 32, asyncTick: 10, maxmem: MAX_KDF.memKiB * 1024 * 2,
    ...(onProgress ? { onProgress } : {}),
  });
}

/** Runs the KDF once. The result is what `SealOptions.precomputed` takes; keep it only in the system keystore. */
export async function precomputeKey(passphrase: string, random: Random, kdf?: Partial<KdfParams>, onProgress?: (f: number) => void, argon2id?: Argon2id): Promise<PrecomputedKey> {
  if (passphrase.length === 0) throw new BackupError('params', 'passphrase must not be empty');
  const params = { ...DEFAULT_KDF, ...kdf };
  const salt = random(SALT_BYTES);
  return { salt, k0: await argon(passphrase, salt, params, onProgress, argon2id), kdf: params };
}

async function deriveKeys(passphrase: string, salt: Uint8Array, kdf: KdfParams, deviceSecret: Uint8Array, onProgress?: (f: number) => void, k0Known?: Uint8Array, native?: Argon2id) {
  const k0 = k0Known ?? (await argon(passphrase, salt, kdf, onProgress, native));
  const base = new Uint8Array(32);
  for (let i = 0; i < 32; i++) base[i] = (k0[i] as number) ^ (deviceSecret[i] as number);
  return {
    encKey: hkdf(sha256, base, salt, enc.encode('sanguine/backup/v1/enc'), 32),
    macKey: hkdf(sha256, base, salt, enc.encode('sanguine/backup/v1/mac'), 32),
  };
}

function writeHeader(kdf: KdfParams, salt: Uint8Array, nonce: Uint8Array, ctLen: number): Uint8Array {
  const h = new Uint8Array(HEADER_BYTES);
  const v = new DataView(h.buffer);
  h.set(MAGIC, 0);
  h[4] = FORMAT_VERSION;
  h[5] = KDF_ARGON2ID;
  v.setUint32(6, kdf.memKiB);
  v.setUint32(10, kdf.iterations);
  h[14] = kdf.parallelism;
  h.set(salt, 16);
  h.set(nonce, 32);
  v.setUint32(56, ctLen);
  return h;
}

export async function sealBackup(o: SealOptions): Promise<Uint8Array> {
  checkSecret(o.deviceSecret);
  if (o.passphrase.length === 0 && !o.precomputed) throw new BackupError('params', 'passphrase must not be empty');
  const kdf = o.precomputed ? o.precomputed.kdf : { ...DEFAULT_KDF, ...o.kdf };
  if (kdf.memKiB > MAX_KDF.memKiB || kdf.iterations > MAX_KDF.iterations || kdf.parallelism > MAX_KDF.parallelism || kdf.memKiB < 8 * kdf.parallelism || kdf.iterations < 1)
    throw new BackupError('params', 'KDF parameters out of range');
  const salt = o.precomputed ? o.precomputed.salt : o.random(SALT_BYTES);
  const nonce = o.random(NONCE_BYTES);
  const { encKey, macKey } = await deriveKeys(o.passphrase, salt, kdf, o.deviceSecret, o.onProgress, o.precomputed?.k0, o.argon2id);
  const header = writeHeader(kdf, salt, nonce, o.payload.length + TAG_BYTES);
  const ct = xchacha20poly1305(encKey, nonce, header).encrypt(o.payload);
  const mac = hmac(sha256, macKey, concat(header, ct));
  return concat(header, ct, mac);
}

/** Header fields without deriving any key; used to validate a file before spending memory on the KDF. */
export function readHeader(file: Uint8Array): { kdf: KdfParams; salt: Uint8Array; nonce: Uint8Array; ctLen: number; header: Uint8Array } {
  if (file.length < HEADER_BYTES + TAG_BYTES + MAC_BYTES || !equal(file.subarray(0, 4), MAGIC)) throw new BackupError('format', 'not a Sanguine backup');
  if (file[4] !== FORMAT_VERSION) throw new BackupError('version', `unsupported backup version ${file[4]}`);
  if (file[5] !== KDF_ARGON2ID) throw new BackupError('params', 'unsupported key derivation');
  const v = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const kdf = { memKiB: v.getUint32(6), iterations: v.getUint32(10), parallelism: file[14] as number };
  if (kdf.memKiB > MAX_KDF.memKiB || kdf.iterations > MAX_KDF.iterations || kdf.parallelism > MAX_KDF.parallelism || kdf.iterations < 1 || kdf.memKiB < 8 * kdf.parallelism || kdf.parallelism < 1)
    throw new BackupError('params', 'key derivation parameters out of range');
  const ctLen = v.getUint32(56);
  if (file.length !== HEADER_BYTES + ctLen + MAC_BYTES || ctLen < TAG_BYTES) throw new BackupError('format', 'backup is truncated or has trailing data');
  return { kdf, salt: file.slice(16, 32), nonce: file.slice(32, 56), ctLen, header: file.slice(0, HEADER_BYTES) };
}

export async function openBackup(file: Uint8Array, passphrase: string, deviceSecret: Uint8Array, onProgress?: (f: number) => void, argon2id?: Argon2id): Promise<Uint8Array> {
  checkSecret(deviceSecret);
  const h = readHeader(file);
  const { encKey, macKey } = await deriveKeys(passphrase, h.salt, h.kdf, deviceSecret, onProgress, undefined, argon2id);
  const ct = file.subarray(HEADER_BYTES, HEADER_BYTES + h.ctLen);
  const mac = file.subarray(HEADER_BYTES + h.ctLen);
  if (!equal(mac, hmac(sha256, macKey, concat(h.header, ct)))) throw new BackupError('auth', 'wrong passphrase or device secret, or the file was changed');
  try {
    return xchacha20poly1305(encKey, h.nonce, h.header).decrypt(ct);
  } catch {
    throw new BackupError('auth', 'wrong passphrase or device secret, or the file was changed');
  }
}
