// drip export (P8-1, D-078): drip's CSV of its CycleDay schema, header of dotted paths (`bleeding.value`, `mucus.feeling`, ...).
// Format checked against drip's source (db/schemas/4.js, lib/import-export, components/helpers/labels.js; main, 2026-10-10).
// Parses into DailyRow for the shared writer in importDaily.ts. Anything it cannot map is reported, never guessed.
import { strFromU8 } from 'fflate';
import type { ISODate } from '@sanguine/engine';
import { parseCsv } from './csv';
import { parseDateCell } from './exportImport';
import type { DailyRow } from './importDaily';
import { celsius } from './importNaturalCycles';

export interface DripParse { rows: DailyRow[]; problems: string[] }
type Mucus = NonNullable<DailyRow['mucus']>;
type Cervix = NonNullable<DailyRow['cervix']>;

const FLOW = ['spotting', 'light', 'medium', 'heavy'] as const;
// Sensation and appearance each map to a quality; the higher one wins, as drip's own NFP value does (lib/nfp-mucus.js).
const MUCUS_ORDER: Mucus[] = ['dry', 'sticky', 'creamy', 'watery', 'eggwhite'];
const FEELING: (Mucus | undefined)[] = ['dry', 'dry', 'watery', 'eggwhite']; // dry, nothing, wet, slippery
const TEXTURE: (Mucus | undefined)[] = [undefined, 'creamy', 'eggwhite']; // nothing, creamy, eggWhite
const OPENING: Cervix['opening'][] = ['closed', 'partial', 'open'];
const FIRMNESS: Cervix['firmness'][] = ['firm', 'soft']; // drip: hard, soft
const POSITION: Cervix['position'][] = ['low', 'mid', 'high'];
const DESIRE: (string | null)[] = ['low_libido', null, 'high_libido']; // a usual sex drive is not a symptom
// In schema order; codes from copy/symptoms.json. `null`: drip's word has no Sanguine symptom and is reported.
const PAIN: Record<string, string> = { cramps: 'cramps', ovulationPain: 'mid_cycle_pain', headache: 'headache', backache: 'back_pain', nausea: 'nausea', tenderBreasts: 'breast_tenderness', migraine: 'headache', other: 'other_pain' };
const MOOD: Record<string, string | null> = { happy: 'happy', sad: 'mood_low', stressed: 'stressed', balanced: 'calm', fine: null, anxious: 'anxiety', energetic: 'energetic', fatigue: 'fatigue', angry: 'irritability', other: null };
// Contraceptive ticks are not imported: Sanguine has no contraception feature (CLAUDE.md). Sanguine's sex flag means "condom used".
const CONTRACEPTIVE = ['pill', 'iud', 'patch', 'ring', 'implant', 'diaphragm', 'other'];
const NOTES: [string, string][] = [['note.value', ''], ['temperature.note', 'Temperature: '], ['pain.note', 'Pain: '], ['mood.note', 'Mood: '], ['sex.note', 'Sex: ']];

const isDrip = (header: string[] | undefined) => {
  const h = new Set((header ?? []).map((c) => c.trim()));
  return h.has('date') && h.has('bleeding.value');
};

/** `table[0]` is the header row; columns are found by name, so an older drip schema with fewer columns still imports. */
export function parseDrip(table: string[][]): DripParse {
  const col = new Map((table[0] ?? []).map((h, i) => [h.trim(), i]));
  const rows: DailyRow[] = [];
  const problems: string[] = [];
  const ignored = new Map<string, number>();
  const count = (k: string) => ignored.set(k, (ignored.get(k) ?? 0) + 1);
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (name: string) => (cells[col.get(name) ?? -1] ?? '').trim();
    const yes = (name: string) => get(name).toLowerCase() === 'true';
    const code = <T>(name: string, list: readonly T[]): T | undefined | null => {
      const v = get(name);
      if (v === '') return undefined;
      return /^\d+$/.test(v) && Number(v) < list.length ? (list[Number(v)] as T) : null; // null: present but not a known code
    };
    const rawDate = get('date');
    const day = parseDateCell(rawDate);
    if (!day) { problems.push(`line ${line}: "${rawDate}" is not a date`); return; }
    const r: DailyRow = { day: day as ISODate };

    const flow = code('bleeding.value', FLOW);
    if (flow === null) problems.push(`line ${line}: bleeding "${get('bleeding.value')}" not recognised`);
    else if (flow) { r.flow = flow; if (yes('bleeding.exclude')) r.flowKind = 'intermenstrual'; } // drip's exclude: does not start a cycle

    const temp = get('temperature.value');
    if (temp !== '') {
      const c = celsius(Number(temp));
      if (c === undefined) problems.push(`line ${line}: temperature "${temp}" is out of range`);
      else {
        r.tempC = c;
        const time = get('temperature.time');
        if (/^\d{2}:\d{2}$/.test(time)) r.tempTime = time;
        if (yes('temperature.exclude')) r.tempExcluded = true;
      }
    }

    const feeling = code('mucus.feeling', FEELING);
    const texture = code('mucus.texture', TEXTURE);
    if (feeling === null || texture === null) problems.push(`line ${line}: cervical mucus "${get('mucus.feeling')}/${get('mucus.texture')}" not recognised`);
    else if (feeling !== undefined || texture !== undefined) {
      if (yes('mucus.exclude')) count('mucus marked excluded');
      else r.mucus = [feeling, texture].filter((q): q is Mucus => q !== undefined).reduce((a, b) => (MUCUS_ORDER.indexOf(b) > MUCUS_ORDER.indexOf(a) ? b : a), 'dry');
    }

    const cervix = { opening: code('cervix.opening', OPENING), firmness: code('cervix.firmness', FIRMNESS), position: code('cervix.position', POSITION) };
    const parts = Object.values(cervix);
    if (parts.some((p) => p !== undefined)) {
      if (yes('cervix.exclude')) count('cervix marked excluded');
      else if (parts.every((p) => p)) r.cervix = cervix as Cervix;
      else problems.push(`line ${line}: cervix needs opening, firmness and position, not imported`);
    }

    if (yes('sex.partner')) r.sex = { protected: yes('sex.condom') };
    else if (yes('sex.solo')) count('sex solo');
    for (const c of CONTRACEPTIVE) if (yes(`sex.${c}`)) count(`sex.${c}`);

    const symptoms = new Set<string>();
    for (const [k, s] of Object.entries(PAIN)) if (yes(`pain.${k}`)) symptoms.add(s);
    for (const [k, s] of Object.entries(MOOD)) if (yes(`mood.${k}`)) { if (s) symptoms.add(s); else count(`mood ${k}`); }
    const desire = code('desire.value', DESIRE);
    if (desire === null) problems.push(`line ${line}: desire "${get('desire.value')}" not recognised`);
    else if (desire) symptoms.add(desire);
    if (symptoms.size > 0) r.symptoms = [...symptoms];

    const note = NOTES.map(([name, label]) => (get(name) === '' ? '' : `${label}${get(name)}`)).filter(Boolean).join('\n');
    if (note !== '') r.note = note;

    if (Object.keys(r).length > 1) rows.push(r);
  });
  if (ignored.size > 0) problems.push(`not imported: ${[...ignored].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, n]) => `${k} ×${n}`).join(', ')}`);
  return { rows, problems };
}

/** The export as rows when `bytes` is drip's CSV; otherwise null. */
export function readDrip(bytes: Uint8Array): DripParse | null {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return null; // a zip ("PK"): drip exports plain CSV
  const table = parseCsv(strFromU8(bytes));
  return isDrip(table[0]) ? parseDrip(table) : null;
}
