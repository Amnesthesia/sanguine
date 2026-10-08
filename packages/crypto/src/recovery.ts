// The recovery code is the 256-bit device secret as 24 words (BIP-39 wordlist, 8-bit checksum). Shown once (PLAN.md §6.3).
import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { DEVICE_SECRET_BYTES, type Random } from './backup';

export function newDeviceSecret(random: Random): Uint8Array {
  return random(DEVICE_SECRET_BYTES);
}
export function secretToRecoveryWords(secret: Uint8Array): string {
  if (secret.length !== DEVICE_SECRET_BYTES) throw new RangeError('device secret must be 32 bytes');
  return entropyToMnemonic(secret, wordlist);
}
const clean = (s: string) => s.normalize('NFKD').toLowerCase().split(/[^a-z]+/).filter(Boolean).join(' ');

/** Returns the secret, or null if a word is wrong or the checksum fails (a typo). Case and spacing are forgiven. */
export function recoveryWordsToSecret(words: string): Uint8Array | null {
  const m = clean(words);
  if (m.split(' ').length !== 24 || !validateMnemonic(m, wordlist)) return null;
  return mnemonicToEntropy(m, wordlist);
}
