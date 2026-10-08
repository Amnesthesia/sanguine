// Notes are encrypted a second time with a key released only after unlock (PLAN.md §5.2, §6.1, §8.8).
// Format: "n1:" + hex(nonce(24) || XChaCha20-Poly1305 ciphertext). The note key never enters the database.
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import type { Random } from './backup';

const PREFIX = 'n1:';
const NONCE = 24;
export const NOTE_KEY_BYTES = 32;

export function sealNote(key: Uint8Array, text: string, random: Random): string {
  if (key.length !== NOTE_KEY_BYTES) throw new RangeError('note key must be 32 bytes');
  const nonce = random(NONCE);
  const ct = xchacha20poly1305(key, nonce).encrypt(new TextEncoder().encode(text));
  const out = new Uint8Array(NONCE + ct.length);
  out.set(nonce, 0);
  out.set(ct, NONCE);
  return PREFIX + bytesToHex(out);
}

/** Returns the text, or null if the key is wrong or the value was changed. */
export function openNote(key: Uint8Array, sealed: string): string | null {
  if (key.length !== NOTE_KEY_BYTES || !sealed.startsWith(PREFIX)) return null;
  try {
    const raw = hexToBytes(sealed.slice(PREFIX.length));
    return new TextDecoder().decode(xchacha20poly1305(key, raw.slice(0, NONCE)).decrypt(raw.slice(NONCE)));
  } catch {
    return null;
  }
}
