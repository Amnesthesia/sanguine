// Natural Cycles "daily entries" export (P3-13, D-056): xlsx from the app, or the same columns as CSV (plain or in a zip).
// Parses into DailyRow for the shared writer in importDaily.ts. Anything it cannot map is reported, never guessed.
import { strFromU8, unzipSync } from 'fflate';
import type { ISODate } from '@sanguine/engine';
import { parseCsv } from './csv';
import { parseDateCell } from './exportImport';
import type { DailyRow } from './importDaily';

export interface NaturalCyclesParse { rows: DailyRow[]; problems: string[] }

const FLOW = { LIGHT: 'light', MEDIUM: 'medium', HEAVY: 'heavy' } as const;
const YES_NO = { YES: 'positive', NO: 'negative' } as const;
const MUCUS = { DRY: 'dry', STICKY: 'sticky', CREAMY: 'creamy', WATERY: 'watery', EGGWHITE: 'eggwhite' } as const;
// Only flags with a clear Sanguine equivalent (copy/symptoms.json); the rest (positive moods, skin texture, "other") are reported.
const SYMPTOM: Record<string, string> = {
  PAIN_CRAMPS: 'cramps', PAIN_HEADACHE: 'headache', PAIN_BLOATING: 'bloating', PAIN_SORE_BREASTS: 'breast_tenderness', PAIN_BACKACHE: 'back_pain',
  PAIN_NAUSEOUS: 'nausea', PAIN_CRAVINGS: 'food_cravings', SKIN_ACNE: 'acne', MOOD_TIRED: 'fatigue', MOOD_EXHAUSTED: 'fatigue', MOOD_SAD: 'mood_low',
  MOOD_IRRITABLE: 'irritability',
};
const HANDLED = new Set(['date', 'temperature', 'menstruation', 'menstruation quantity', 'lh test', 'pregnancy test', 'cervical mucus consistency', 'notes', 'skipped', 'source', 'data flag']);
const lookup = <T extends Record<string, string>>(map: T, v: string): T[keyof T] | undefined => (Object.hasOwn(map, v) ? map[v as keyof T] : undefined);

function serialDay(serial: number, date1904: boolean): ISODate {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30); // 1899-12-30 absorbs Excel's 1900 leap-year bug for serials after 60
  return new Date(epoch + Math.floor(serial) * 86_400_000).toISOString().slice(0, 10) as ISODate;
}

/** Temperature in °C rounded to 0.01, from °C or °F; undefined when outside any plausible body temperature. */
function celsius(v: number): number | undefined {
  const c = v >= 34 && v <= 42 ? v : v >= 93 && v <= 108 ? ((v - 32) * 5) / 9 : undefined;
  return c === undefined ? undefined : Math.round(c * 100) / 100;
}

/** `table[0]` is the header row; columns are found by name, so order and extra columns do not matter. */
export function parseNaturalCycles(table: string[][], o: { date1904?: boolean } = {}): NaturalCyclesParse {
  const header = (table[0] ?? []).map((h) => h.trim());
  const col = new Map(header.map((h, i) => [h.toLowerCase(), i]));
  const rows: DailyRow[] = [];
  const problems: string[] = [];
  const ignored = new Map<string, number>();
  const otherDevice = new Map<string, number>();
  const count = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (name: string) => (cells[col.get(name) ?? -1] ?? '').trim();
    const rawDate = get('date');
    if (cells.every((c) => c.trim() === '')) return;
    const day = /^\d+(\.\d+)?$/.test(rawDate) ? serialDay(Number(rawDate), o.date1904 === true) : parseDateCell(rawDate);
    if (!day) { problems.push(`line ${line}: "${rawDate}" is not a date`); return; }
    const r: DailyRow = { day: day as ISODate };

    const men = get('menstruation');
    const qty = get('menstruation quantity');
    if (men === 'SPOTTING') r.flow = 'spotting';
    else if (men === 'MENSTRUATION' || men === 'MISCARRIAGE_BLEEDING') {
      // a bleeding day logged without a known amount keeps the day as medium: the day matters for cycles, the amount does not (D-056)
      const level = lookup(FLOW, qty);
      if (!level && qty !== '') problems.push(`line ${line}: menstruation quantity "${qty}" not recognised, imported as medium`);
      r.flow = level ?? 'medium';
      if (men === 'MISCARRIAGE_BLEEDING') r.flowKind = 'post_pregnancy'; // never starts a cycle (D-053)
    } else if (men !== '') problems.push(`line ${line}: menstruation "${men}" not recognised`);

    const flags = get('data flag').split(',').map((f) => f.trim()).filter(Boolean);
    const temp = get('temperature');
    if (temp !== '') {
      const c = celsius(Number(temp));
      const source = get('source');
      if (c === undefined) problems.push(`line ${line}: temperature "${temp}" is out of range`);
      else if (source !== '') count(otherDevice, source); // may be a wearable's skin temperature, which is not BBT
      else {
        r.tempC = c;
        const skipped = get('skipped');
        if (flags.some((f) => f.startsWith('DEVIATION_REASON_')) || (skipped !== '' && skipped !== '0')) r.tempExcluded = true;
      }
    }

    for (const [name, key] of [['lh test', 'lh'], ['pregnancy test', 'pregTest']] as const) {
      const v = get(name);
      if (v === '') continue;
      const result = lookup(YES_NO, v);
      if (result) r[key] = result;
      else problems.push(`line ${line}: ${name} "${v}" not recognised`);
    }
    const mucus = get('cervical mucus consistency');
    if (mucus !== '') {
      const q = lookup(MUCUS, mucus);
      if (q) r.mucus = q;
      else problems.push(`line ${line}: cervical mucus "${mucus}" not recognised`);
    }

    const symptoms = new Set<string>();
    for (const f of flags) {
      const code = lookup(SYMPTOM, f);
      if (code) symptoms.add(code);
      else if (!f.startsWith('DEVIATION_REASON_')) count(ignored, f);
    }
    if (symptoms.size > 0) r.symptoms = [...symptoms];
    const note = get('notes');
    if (note !== '') r.note = note;
    header.forEach((h, k) => { if (!HANDLED.has(h.toLowerCase()) && (cells[k] ?? '').trim() !== '') count(ignored, h); });

    if (Object.keys(r).length > 1) rows.push(r);
  });
  for (const [source, n] of otherDevice) problems.push(`${n} temperature${n === 1 ? '' : 's'} from another device (Source "${source}") not imported`);
  if (ignored.size > 0) problems.push(`not imported: ${[...ignored].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, n]) => `${k} ×${n}`).join(', ')}`);
  return { rows, problems };
}

const isNaturalCycles = (header: string[] | undefined) => {
  const h = new Set((header ?? []).map((c) => c.trim().toLowerCase()));
  // a generic period CSV may also have Date and Menstruation; these columns are Natural Cycles' own
  return h.has('date') && h.has('menstruation') && ['data flag', 'menstruation quantity', 'lh test', 'cervical mucus consistency'].some((c) => h.has(c));
};

/** The export as rows when `bytes` is a Natural Cycles xlsx, a CSV with its columns, or a zip holding "Daily Entries.csv"; otherwise null. */
export function readNaturalCycles(bytes: Uint8Array): NaturalCyclesParse | null {
  const fromCsv = (text: string) => { const t = parseCsv(text); return isNaturalCycles(t[0]) ? parseNaturalCycles(t) : null; };
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return fromCsv(strFromU8(bytes)); // not a zip ("PK")
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes); } catch { return null; }
  const workbook = files['xl/workbook.xml'];
  if (workbook) {
    const table = readXlsxSheet(files);
    return isNaturalCycles(table[0]) ? parseNaturalCycles(table, { date1904: /date1904="(1|true)"/.test(strFromU8(workbook)) }) : null;
  }
  const csv = Object.keys(files).find((n) => /daily.?entries[^/]*\.csv$/i.test(n));
  return csv ? fromCsv(strFromU8(files[csv] as Uint8Array)) : null;
}

// ---------------- minimal xlsx reader: first sheet, cell values as text ----------------
const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unxml = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
  if (e[0] !== '#') return ENTITY[e] ?? m;
  const cp = e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1));
  return cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
});
/** All `<t>` text in a shared string or inline string (rich-text runs joined), without phonetic guides. */
const texts = (xml: string) => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((m) => unxml(m[1] ?? '')).join('');

function readXlsxSheet(files: Record<string, Uint8Array>): string[][] {
  // ponytail: takes sheet1 (where Excel and Natural Cycles put the only sheet); resolve workbook.xml rels if a multi-sheet export appears
  const sheetName = files['xl/worksheets/sheet1.xml'] ? 'xl/worksheets/sheet1.xml' : Object.keys(files).sort().find((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n));
  const sheet = sheetName ? strFromU8(files[sheetName] as Uint8Array) : '';
  const sst = files['xl/sharedStrings.xml'] ? strFromU8(files['xl/sharedStrings.xml']) : '';
  const shared = [...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1] ?? ''));
  const table: string[][] = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row: string[] = [];
    for (const cm of (rm[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1] ?? '';
      const inner = cm[2] ?? '';
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const idx = ref ? [...ref].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 : row.length;
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const v = unxml(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '');
      while (row.length < idx) row.push('');
      row[idx] = type === 's' ? (v === '' ? '' : (shared[Number(v)] ?? '')) : type === 'inlineStr' ? texts(inner) : v;
    }
    table.push(row);
  }
  return table;
}
