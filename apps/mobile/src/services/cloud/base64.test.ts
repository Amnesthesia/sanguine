import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './base64';

describe('base64', () => {
  it('round-trips empty, small and large byte arrays', () => {
    for (const n of [0, 1, 2, 3, 255, 70_000]) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 31) % 256);
      expect(base64ToBytes(bytesToBase64(b))).toEqual(b);
    }
  });
  it('matches the standard encoding', () => expect(bytesToBase64(new Uint8Array([72, 105, 33]))).toBe('SGkh'));
});
