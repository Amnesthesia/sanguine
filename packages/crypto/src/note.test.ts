import { describe, expect, it } from 'vitest';
import { openNote, sealNote } from './note';

const key = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
let c = 0;
const random = (n: number) => Uint8Array.from({ length: n }, () => c++ % 256);

describe('notes', () => {
  it('round-trips, including unicode', () => {
    for (const text of ['', 'felt tired', 'café ☕ 36.5°C']) expect(openNote(key, sealNote(key, text, random))).toBe(text);
  });
  it('the sealed value shows nothing of the text and is different each time', () => {
    const a = sealNote(key, 'private words', random);
    const b = sealNote(key, 'private words', random);
    expect(a).not.toContain('private');
    expect(a).not.toBe(b);
    expect(a.startsWith('n1:')).toBe(true);
  });
  it('a wrong key, a changed byte or a malformed value gives null, never garbage', () => {
    const sealed = sealNote(key, 'hello', random);
    const other = key.slice();
    other[0] = (other[0] as number) ^ 1;
    expect(openNote(other, sealed)).toBeNull();
    const flipped = `${sealed.slice(0, -2)}${sealed.endsWith('00') ? '11' : '00'}`;
    expect(openNote(key, flipped)).toBeNull();
    expect(openNote(key, 'n1:zz')).toBeNull();
    expect(openNote(key, 'plain text')).toBeNull();
  });
  it('rejects a key of the wrong size', () => expect(() => sealNote(new Uint8Array(5), 'x', random)).toThrow());
});
