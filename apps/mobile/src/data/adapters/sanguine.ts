// Adapter for our own day-based format: a plain sanguine-data.json, or a zip holding one (the user's export).
import { strFromU8, strToU8, unzipSync } from 'fflate';
import { FORMAT, validateSanguineData } from '../format/sanguineData';
import type { FormatAdapter, PickedFile } from './types';

const ENTRY = 'sanguine-data.json';
const isZip = (b: Uint8Array) => b.length > 3 && b[0] === 0x50 && b[1] === 0x4b;

function text(f: PickedFile): string | undefined {
  try {
    if (!isZip(f.bytes)) return strFromU8(f.bytes);
    const e = unzipSync(f.bytes, { filter: (x) => x.name === ENTRY })[ENTRY];
    return e ? strFromU8(e) : undefined;
  } catch { return undefined; }
}

export const sanguineAdapter: FormatAdapter = {
  id: 'sanguine',
  detect(f) {
    const t = text(f);
    if (t === undefined) return 'no';
    try { return (JSON.parse(t) as { format?: unknown }).format === FORMAT ? 'yes' : 'no'; } catch { return 'no'; }
  },
  decode(f) {
    const t = text(f);
    if (t === undefined) throw new Error(`no ${ENTRY} in the file`);
    return validateSanguineData(JSON.parse(t));
  },
  encode: (d) => ({ name: ENTRY, bytes: strToU8(JSON.stringify(d, null, 2)) }),
};
