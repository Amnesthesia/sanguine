import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ZipCorrupt,
  ZipPasswordNeeded,
  ZipUnsupported,
  ZipWrongPassword,
  listZip,
  readZipEntry,
} from './zipCrypto';

const load = (n: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', n)));
const enc = load('clue-synthetic.zip');
const plain = load('clue-synthetic-plain.zip');
const stored = load('clue-synthetic-stored.zip');
const PW = 'sanguine-test';
const find = (z: Uint8Array, name: string) => listZip(z).find((e) => e.name === name)!;

describe('zipCrypto', () => {
  it('lists entries as encrypted, non-AES', () => {
    const es = listZip(enc);
    expect(es.map((e) => e.name)).toEqual(['measurements.json', 'profile.json']);
    expect(es.every((e) => e.encrypted && !e.aes)).toBe(true);
    expect(listZip(plain).some((e) => e.encrypted)).toBe(false);
  });

  it('right password returns the exact bytes', () => {
    const want = readZipEntry(plain, find(plain, 'measurements.json'));
    expect(readZipEntry(enc, find(enc, 'measurements.json'), PW)).toEqual(want);
    const rows = JSON.parse(new TextDecoder().decode(want));
    expect(rows[0].type).toBe('period');
    expect(JSON.parse(new TextDecoder().decode(readZipEntry(enc, find(enc, 'profile.json'), PW)))).toEqual({
      profileData: { cycle_length: 29 },
    });
  });

  it('wrong passwords throw ZipWrongPassword', () => {
    for (const pw of ['', 'x', 'Sanguine-test', 'sanguine-tesu', 'a'.repeat(40), 'ñandú', 'p1', 'p2', 'p3', 'p4']) {
      expect(() => readZipEntry(enc, find(enc, 'measurements.json'), pw)).toThrow(ZipWrongPassword);
    }
  });

  it('no password throws ZipPasswordNeeded', () => {
    expect(() => readZipEntry(enc, find(enc, 'profile.json'))).toThrow(ZipPasswordNeeded);
  });

  it('plain zip opens without a password', () => {
    expect(readZipEntry(plain, find(plain, 'profile.json')).length).toBeGreaterThan(0);
  });

  it('stored encrypted entry works', () => {
    const e = find(stored, 'profile.json');
    expect(e.method).toBe(0);
    expect(e.encrypted).toBe(true);
    expect(readZipEntry(stored, e, PW)).toEqual(readZipEntry(plain, find(plain, 'profile.json')));
    expect(() => readZipEntry(stored, e, 'nope')).toThrow(ZipWrongPassword);
  });

  it('method 99 throws ZipUnsupported', () => {
    const e = { ...find(enc, 'profile.json'), method: 99 };
    expect(() => readZipEntry(enc, e, PW)).toThrow(ZipUnsupported);
  });

  it('flipped data byte throws ZipWrongPassword or ZipCorrupt', () => {
    const bad = enc.slice();
    const e = find(bad, 'measurements.json');
    bad[e.localOffset + 30 + e.name.length + 20] ^= 0xff; // local extra is 0 for -X
    expect(() => readZipEntry(bad, e, PW)).toThrow(/./);
    try {
      readZipEntry(bad, e, PW);
    } catch (err) {
      expect(err instanceof ZipWrongPassword || err instanceof ZipCorrupt).toBe(true);
    }
    const p = plain.slice();
    const pe = find(p, 'measurements.json');
    p[pe.localOffset + 30 + pe.name.length + 5] ^= 0xff;
    expect(() => readZipEntry(p, pe)).toThrow(ZipCorrupt);
  });

  it('non-zip bytes throw', () => {
    expect(() => listZip(new TextEncoder().encode('hello world, not a zip file at all'))).toThrow(ZipUnsupported);
    expect(() => listZip(new Uint8Array(0))).toThrow(ZipUnsupported);
  });

  it('never puts the password in an error', () => {
    try {
      readZipEntry(enc, find(enc, 'profile.json'), 'secret-pw-xyz');
    } catch (err) {
      expect(String((err as Error).message)).not.toContain('secret-pw-xyz');
    }
  });
});
