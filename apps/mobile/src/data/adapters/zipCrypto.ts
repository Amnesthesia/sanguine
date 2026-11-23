// Reader for zips with legacy ZipCrypto (PKWARE traditional) encryption, which fflate
// cannot decrypt. No zip64, no AES. The password is never logged or put in an error.
import { inflateSync } from 'fflate';

export class ZipError extends Error {}
export class ZipPasswordNeeded extends ZipError {}
export class ZipWrongPassword extends ZipError {}
export class ZipUnsupported extends ZipError {}
export class ZipCorrupt extends ZipError {}
export class ZipTooLarge extends ZipError {}

export const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

export type ZipEntry = {
  name: string;
  method: number;
  flags: number;
  crc: number;
  compSize: number;
  size: number;
  localOffset: number;
  time: number; // DOS modification time
  encrypted: boolean;
  aes: boolean;
};

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crcStep = (crc: number, b: number) => (CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8)) >>> 0;
const crc32 = (d: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = crcStep(c, d[i]);
  return (c ^ 0xffffffff) >>> 0;
};

export function listZip(bytes: Uint8Array): ZipEntry[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipUnsupported('not a zip file');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  if (count === 0xffff || p === 0xffffffff) throw new ZipUnsupported('zip64');
  const out: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || v.getUint32(p, true) !== 0x02014b50) throw new ZipCorrupt('bad central directory');
    const flags = v.getUint16(p + 8, true);
    const method = v.getUint16(p + 10, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    if (p + 46 + nameLen + extraLen > bytes.length) throw new ZipCorrupt('bad central directory');
    let aes = method === 99;
    for (let e = p + 46 + nameLen, end = e + extraLen; e + 4 <= end; e += 4 + v.getUint16(e + 2, true)) {
      if (v.getUint16(e, true) === 0x9901) aes = true;
    }
    out.push({
      name: new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen)),
      method,
      flags,
      time: v.getUint16(p + 12, true),
      crc: v.getUint32(p + 16, true),
      compSize: v.getUint32(p + 20, true),
      size: v.getUint32(p + 24, true),
      localOffset: v.getUint32(p + 42, true),
      encrypted: (flags & 1) !== 0,
      aes,
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

export function readZipEntry(bytes: Uint8Array, entry: ZipEntry, password?: string): Uint8Array {
  if (entry.aes) throw new ZipUnsupported('AES encryption');
  if (entry.method !== 0 && entry.method !== 8) throw new ZipUnsupported(`method ${entry.method}`);
  if (entry.size > MAX_ENTRY_BYTES || entry.compSize > MAX_ENTRY_BYTES) throw new ZipTooLarge('entry too large');
  if (entry.method === 0 && entry.compSize !== entry.size + (entry.encrypted ? 12 : 0)) throw new ZipCorrupt('size mismatch');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const o = entry.localOffset;
  if (o + 30 > bytes.length || v.getUint32(o, true) !== 0x04034b50) throw new ZipCorrupt('bad local header');
  const start = o + 30 + v.getUint16(o + 26, true) + v.getUint16(o + 28, true);
  if (start + entry.compSize > bytes.length) throw new ZipCorrupt('entry past end of file');
  let data = bytes.subarray(start, start + entry.compSize);

  if (entry.encrypted) {
    if (password === undefined) throw new ZipPasswordNeeded('password needed');
    if (data.length < 12) throw new ZipCorrupt('entry too short');
    const k = [0x12345678, 0x23456789, 0x34567890];
    const update = (b: number) => {
      k[0] = crcStep(k[0], b);
      k[1] = (Math.imul((k[1] + (k[0] & 0xff)) >>> 0, 134775813) + 1) >>> 0;
      k[2] = crcStep(k[2], k[1] >>> 24);
    };
    for (const b of new TextEncoder().encode(password)) update(b);
    const plain = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const t = (k[2] | 2) & 0xffff;
      plain[i] = data[i] ^ ((Math.imul(t, t ^ 1) >>> 8) & 0xff);
      update(plain[i]);
    }
    const check = entry.flags & 8 ? entry.time >>> 8 : entry.crc >>> 24;
    if (plain[11] !== check) throw new ZipWrongPassword('wrong password');
    data = plain.subarray(12);
  }

  let out: Uint8Array;
  if (entry.method === 0) out = data;
  else {
    try {
      // Fixed output buffer: fflate does not grow it, so memory is bounded by the declared size;
      // an overflowing stream is truncated and then fails the length/CRC check below.
      out = inflateSync(data, { out: new Uint8Array(entry.size) });
    } catch {
      throw entry.encrypted ? new ZipWrongPassword('wrong password') : new ZipCorrupt('inflate failed');
    }
  }
  if (out.length !== entry.size || crc32(out) !== entry.crc) {
    throw entry.encrypted ? new ZipWrongPassword('wrong password') : new ZipCorrupt('checksum mismatch');
  }
  return out;
}
