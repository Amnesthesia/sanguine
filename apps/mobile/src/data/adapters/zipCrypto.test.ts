import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Inflate, deflateSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import {
  ZipCorrupt,
  ZipPasswordNeeded,
  ZipTooLarge,
  ZipUnsupported,
  ZipWrongPassword,
  readZipFiles,
  listZip,
  readZipEntry,
} from './zipCrypto';

const load = (n: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', n)));
const enc = load('clue-synthetic.zip');
const plain = load('clue-synthetic-plain.zip');
const stored = load('clue-synthetic-stored.zip');
const PW = 'sanguine-test';
const find = (z: Uint8Array, name: string) => listZip(z).find((e) => e.name === name) as ReturnType<typeof listZip>[number];

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

  // Builds a one-entry zip by hand with a chosen method, declared size and payload.
  const handmade = (method: number, payload: Uint8Array, size: number, crc = 0) => {
    const name = new TextEncoder().encode('a.bin');
    const b = new Uint8Array(30 + 5 + payload.length + 46 + 5 + 22);
    const v = new DataView(b.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(8, method, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, payload.length, true);
    v.setUint32(22, size, true);
    v.setUint16(26, 5, true);
    b.set(name, 30);
    b.set(payload, 35);
    const c = 35 + payload.length;
    v.setUint32(c, 0x02014b50, true);
    v.setUint16(c + 10, method, true);
    v.setUint32(c + 16, crc, true);
    v.setUint32(c + 20, payload.length, true);
    v.setUint32(c + 24, size, true);
    v.setUint16(c + 28, 5, true);
    b.set(name, c + 46);
    const e = c + 51;
    v.setUint32(e, 0x06054b50, true);
    v.setUint16(e + 8, 1, true);
    v.setUint16(e + 10, 1, true);
    v.setUint32(e + 12, 51, true);
    v.setUint32(e + 16, c, true);
    return b;
  };

  it('a deflate bomb stops after the first slice', () => {
    const bomb = deflateSync(new Uint8Array(50 * 1024 * 1024));
    const z = handmade(8, bomb, 100);
    const push = vi.spyOn(Inflate.prototype, 'push');
    const t0 = performance.now();
    expect(() => readZipEntry(z, listZip(z)[0])).toThrow(ZipCorrupt);
    expect(performance.now() - t0).toBeLessThan(1000);
    const fed = push.mock.calls.reduce((n, c) => n + (c[0] as Uint8Array).length, 0);
    push.mockRestore();
    expect(fed).toBeLessThanOrEqual(16 * 1024);
  });

  it('a ratio-impossible declaration fails before inflating', () => {
    const z = handmade(8, deflateSync(new Uint8Array(10)), 50 * 1024 * 1024);
    const push = vi.spyOn(Inflate.prototype, 'push');
    expect(() => readZipEntry(z, listZip(z)[0])).toThrow(ZipCorrupt);
    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });

  it('a legit multi-slice entry decodes', () => {
    const raw = new Uint8Array(100_000).map(() => Math.floor(Math.random() * 256)); // incompressible
    const comp = deflateSync(raw);
    expect(comp.length).toBeGreaterThan(32 * 1024);
    let c = 0xffffffff;
    for (const b of raw) {
      let x = (c ^ b) & 0xff;
      for (let k = 0; k < 8; k++) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1;
      c = (x ^ (c >>> 8)) >>> 0;
    }
    const z = handmade(8, comp, raw.length, (c ^ 0xffffffff) >>> 0);
    expect(readZipEntry(z, listZip(z)[0])).toEqual(raw);
  });

  it('declared size above the cap throws ZipTooLarge', () => {
    const z = handmade(8, deflateSync(new Uint8Array(10)), 65 * 1024 * 1024);
    expect(() => readZipEntry(z, listZip(z)[0])).toThrow(ZipTooLarge);
  });

  it('stored entry with compSize != size is corrupt', () => {
    const z = handmade(0, new Uint8Array(10), 5);
    expect(() => readZipEntry(z, listZip(z)[0])).toThrow(ZipCorrupt);
  });

  it('central directory or local offset past EOF is corrupt', () => {
    const z = handmade(0, new Uint8Array(4), 4);
    const e = listZip(z)[0];
    expect(() => readZipEntry(z, { ...e, localOffset: z.length + 10 })).toThrow(ZipCorrupt);
    expect(() => readZipEntry(z, { ...e, compSize: 4, localOffset: z.length - 40 })).toThrow(ZipCorrupt);
    const bad = z.slice();
    new DataView(bad.buffer).setUint32(bad.length - 22 + 16, bad.length + 100, true);
    expect(() => listZip(bad)).toThrow(ZipCorrupt);
  });

  // One stored 4-byte local file at offset 0, then a central directory with the given names, all pointing at offset 0.
  const multi = (names: string[], offsets: number[] = []) => {
    const nb = names.map((n) => new TextEncoder().encode(n));
    const local = 30 + 1 + 4;
    const cdLen = nb.reduce((n, x) => n + 46 + x.length, 0);
    const b = new Uint8Array(local + cdLen + 22);
    const v = new DataView(b.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint32(18, 4, true);
    v.setUint32(22, 4, true);
    v.setUint16(26, 1, true);
    b[30] = 97;
    let p = local;
    nb.forEach((x, i) => {
      v.setUint32(p, 0x02014b50, true);
      v.setUint32(p + 20, 4, true);
      v.setUint32(p + 24, 4, true);
      v.setUint16(p + 28, x.length, true);
      v.setUint32(p + 42, offsets[i] ?? 0, true);
      b.set(x, p + 46);
      p += 46 + x.length;
    });
    v.setUint16(p + 8, names.length, true);
    v.setUint16(p + 10, names.length, true);
    v.setUint32(p + 12, cdLen, true);
    v.setUint32(p + 16, local, true);
    v.setUint32(p, 0x06054b50, true);
    return b;
  };

  it('rejects more than 1000 entries and duplicate names', () => {
    expect(() => listZip(multi(Array.from({ length: 1001 }, (_, i) => `f${i}`)))).toThrow(ZipCorrupt);
    expect(listZip(multi(Array.from({ length: 1000 }, (_, i) => `f${i}`)))).toHaveLength(1000);
    expect(() => listZip(multi(['a', 'b', 'a']))).toThrow(ZipCorrupt);
  });

  it('rejects overlapping wanted regions', () => {
    const z = multi(['a', 'b']);
    expect(() => readZipFiles(z)).toThrow(ZipTooLarge);
    expect(() => readZipFiles(z, (n) => n === 'a')).not.toThrow(ZipTooLarge);
  });

  it('an empty entry in either valid DEFLATE form (stored block, fixed block) still reads', () => {
    for (const stream of [[0x01, 0x00, 0x00, 0xff, 0xff], [0x03, 0x00]]) {
      expect(readZipFiles(handmade(8, new Uint8Array(stream), 0))['a.bin']).toEqual(new Uint8Array(0));
    }
  });

  it('a size-0 entry with a large stream fails fast', () => {
    const z = handmade(8, new Uint8Array(5 * 1024 * 1024), 0);
    const t0 = performance.now();
    expect(() => readZipFiles(z)).toThrow(ZipCorrupt);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});

describe('readZipFiles', () => {
  it('reads only the wanted entries, bounded like readZipEntry', () => {
    const files = readZipFiles(load('clue-synthetic-plain.zip'), (n) => n === 'measurements.json');
    expect(Object.keys(files)).toEqual(['measurements.json']);
  });
  it('needs the password for an encrypted wanted entry and never touches the others', () => {
    const zip = load('clue-synthetic.zip');
    expect(() => readZipFiles(zip, (n) => n === 'measurements.json')).toThrow();
    expect(Object.keys(readZipFiles(zip, (n) => n === 'measurements.json', 'sanguine-test'))).toEqual(['measurements.json']);
  });
});
