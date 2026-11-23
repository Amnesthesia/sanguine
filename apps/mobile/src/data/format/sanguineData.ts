// "Sanguine data v1" (D-159, spec in docs/FORMAT.md): the one day-based format every adapter converts to and from.
// A file in this format always imports. `events.jsonl` (the event log used by backup, restore and sync) is a different file and stays as it is.
// Pure: no I/O. `validateSanguineData` is the trust boundary for everything an adapter or a file hands to the writer.
import type { ISODate } from '@sanguine/engine';
import { FLOW_KINDS, LIFE_STATE_KINDS, PREGNANCY_OUTCOMES, type FlowKind } from '../events';

export const FORMAT = 'sanguine-data';
export const VERSION = 1;

export type Level3 = 'light' | 'medium' | 'heavy';
export type Mucus = 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite';
export type Cervix = { position: 'low' | 'mid' | 'high'; firmness: 'firm' | 'medium' | 'soft'; opening: 'closed' | 'partial' | 'open' };
export type LifeStateKind = (typeof LIFE_STATE_KINDS)[number];
export type Temperature = { valueC: number; type: 'bbt' | 'skin_temp'; time?: string; source?: 'oral' | 'vaginal' | 'other'; disturbed?: boolean };

export interface Day {
  date: ISODate;
  flow?: { level: 'spotting' | Level3; kind?: FlowKind; clots?: boolean };
  /** The first reading of a type is the day's value; more are allowed (several measurements a day). */
  temperatures?: Temperature[];
  lh?: 'negative' | 'positive';
  pregTest?: 'negative' | 'positive';
  mucus?: { quality: Mucus; amount?: Level3 };
  cervix?: Cervix;
  sex?: { protected: boolean };
  /** Codes from copy/symptoms.json. `intensity` 1-3; absent means 1 (source apps that record presence only). */
  symptoms?: Array<{ code: string; intensity?: 1 | 2 | 3 }>;
  energy?: 1 | 2 | 3 | 4 | 5;
  /** Plain text. Our own export writes it decrypted: the file is the user's to keep. */
  note?: string;
}
export interface LifeStateSpan { kind: LifeStateKind; start: ISODate; end?: ISODate; outcome?: (typeof PREGNANCY_OUTCOMES)[number]; detail?: Record<string, unknown> }
export interface CycleMark { cycleStart: ISODate; mark: 'exclude' | 'confirm_long' }
export interface SanguineData {
  format: typeof FORMAT;
  version: typeof VERSION;
  exportedAt?: string;
  source?: { app: string };
  days: Day[];
  lifeStates?: LifeStateSpan[];
  cycleMarks?: CycleMark[];
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const isDay = (v: unknown): v is ISODate => typeof v === 'string' && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);
const LEVEL3 = ['light', 'medium', 'heavy'] as const;
const FLOW_LEVELS = ['spotting', ...LEVEL3] as const;
const MUCUS = ['dry', 'sticky', 'creamy', 'watery', 'eggwhite'] as const;
const RESULT = ['negative', 'positive'] as const;
const TEMP_TYPES = ['bbt', 'skin_temp'] as const;
const TEMP_SOURCES = ['oral', 'vaginal', 'other'] as const;
const CERVIX = { position: ['low', 'mid', 'high'], firmness: ['firm', 'medium', 'soft'], opening: ['closed', 'partial', 'open'] } as const;

/** Keys of `o` not in `known`, as one problem line each. */
function unknownKeys(where: string, o: Record<string, unknown>, known: readonly string[], problems: string[]) {
  for (const k of Object.keys(o)) if (!known.includes(k)) problems.push(`${where}: unknown field "${k}"`);
}

function parseDay(raw: unknown, where: string, problems: string[]): Day | undefined {
  if (!isObj(raw)) { problems.push(`${where}: not an object`); return undefined; }
  if (!isDay(raw.date)) { problems.push(`${where}: date must be YYYY-MM-DD`); return undefined; }
  const w = `${where} (${raw.date})`;
  unknownKeys(w, raw, ['date', 'flow', 'temperatures', 'lh', 'pregTest', 'mucus', 'cervix', 'sex', 'symptoms', 'energy', 'note'], problems);
  const d: Day = { date: raw.date };
  const bad = (field: string, why: string) => problems.push(`${w}: ${field} ${why}`);

  if (raw.flow !== undefined) {
    const f = raw.flow;
    if (!isObj(f) || !oneOf(FLOW_LEVELS, f.level)) bad('flow', 'needs a level of spotting, light, medium or heavy');
    else if (f.kind !== undefined && !oneOf(FLOW_KINDS, f.kind)) bad('flow.kind', 'is not a known kind');
    else if (f.clots !== undefined && typeof f.clots !== 'boolean') bad('flow.clots', 'must be true or false');
    else d.flow = { level: f.level, ...(f.kind !== undefined ? { kind: f.kind as FlowKind } : {}), ...(f.clots !== undefined ? { clots: f.clots as boolean } : {}) };
  }
  if (raw.temperatures !== undefined) {
    if (!Array.isArray(raw.temperatures)) bad('temperatures', 'must be a list');
    else {
      const out: Temperature[] = [];
      for (const t of raw.temperatures) {
        if (!isObj(t) || typeof t.valueC !== 'number' || !Number.isFinite(t.valueC) || t.valueC < 34 || t.valueC > 42) { bad('temperature', 'valueC must be a number from 34 to 42'); continue; }
        if (!oneOf(TEMP_TYPES, t.type)) { bad('temperature', 'type must be bbt or skin_temp'); continue; }
        if (t.time !== undefined && (typeof t.time !== 'string' || !TIME.test(t.time))) { bad('temperature', 'time must be HH:MM'); continue; }
        if (t.source !== undefined && !oneOf(TEMP_SOURCES, t.source)) { bad('temperature', 'source must be oral, vaginal or other'); continue; }
        if (t.disturbed !== undefined && typeof t.disturbed !== 'boolean') { bad('temperature', 'disturbed must be true or false'); continue; }
        out.push({ valueC: t.valueC, type: t.type, ...(t.time ? { time: t.time as string } : {}), ...(t.source ? { source: t.source } : {}), ...(t.disturbed ? { disturbed: true } : {}) });
      }
      if (out.length) d.temperatures = out;
    }
  }
  for (const k of ['lh', 'pregTest'] as const) {
    if (raw[k] === undefined) continue;
    if (oneOf(RESULT, raw[k])) d[k] = raw[k] as 'negative' | 'positive'; else bad(k, 'must be negative or positive');
  }
  if (raw.mucus !== undefined) {
    const m = raw.mucus;
    if (!isObj(m) || !oneOf(MUCUS, m.quality)) bad('mucus', 'needs a quality of dry, sticky, creamy, watery or eggwhite');
    else if (m.amount !== undefined && !oneOf(LEVEL3, m.amount)) bad('mucus.amount', 'must be light, medium or heavy');
    else d.mucus = { quality: m.quality, ...(m.amount ? { amount: m.amount as Level3 } : {}) };
  }
  if (raw.cervix !== undefined) {
    const c = raw.cervix;
    if (!isObj(c) || !oneOf(CERVIX.position, c.position) || !oneOf(CERVIX.firmness, c.firmness) || !oneOf(CERVIX.opening, c.opening)) bad('cervix', 'needs position, firmness and opening');
    else d.cervix = { position: c.position, firmness: c.firmness, opening: c.opening };
  }
  if (raw.sex !== undefined) {
    if (!isObj(raw.sex) || typeof raw.sex.protected !== 'boolean') bad('sex', 'needs protected: true or false');
    else d.sex = { protected: raw.sex.protected };
  }
  if (raw.symptoms !== undefined) {
    if (!Array.isArray(raw.symptoms)) bad('symptoms', 'must be a list');
    else {
      const seen = new Set<string>();
      const out: NonNullable<Day['symptoms']> = [];
      for (const s of raw.symptoms) {
        if (!isObj(s) || typeof s.code !== 'string' || s.code === '') { bad('symptom', 'needs a code'); continue; }
        if (s.intensity !== undefined && s.intensity !== 1 && s.intensity !== 2 && s.intensity !== 3) { bad(`symptom ${s.code}`, 'intensity must be 1, 2 or 3'); continue; }
        if (seen.has(s.code)) { bad(`symptom ${s.code}`, 'is listed twice'); continue; }
        seen.add(s.code);
        out.push({ code: s.code, ...(s.intensity !== undefined ? { intensity: s.intensity as 1 | 2 | 3 } : {}) });
      }
      if (out.length) d.symptoms = out;
    }
  }
  if (raw.energy !== undefined) {
    if (raw.energy === 1 || raw.energy === 2 || raw.energy === 3 || raw.energy === 4 || raw.energy === 5) d.energy = raw.energy; else bad('energy', 'must be 1 to 5');
  }
  if (raw.note !== undefined) {
    if (typeof raw.note !== 'string') bad('note', 'must be text'); else if (raw.note.trim() !== '') d.note = raw.note;
  }
  return d;
}

/**
 * Checks a parsed JSON value against the format. Never throws on content: every defect is a `problems` line and the offending
 * record or field is left out, so a file with one bad day still imports the rest. Throws only when the file is not this format
 * at all, or a newer version than this app reads (`FormatError`).
 */
export class FormatError extends Error {}
export function validateSanguineData(x: unknown): { data: SanguineData; problems: string[] } {
  if (!isObj(x) || x.format !== FORMAT) throw new FormatError('not a Sanguine data file');
  if (typeof x.version !== 'number' || !Number.isInteger(x.version) || x.version < 1) throw new FormatError('the file has no version');
  if (x.version > VERSION) throw new FormatError('this file was made by a newer version of Sanguine');
  const problems: string[] = [];
  unknownKeys('file', x, ['format', 'version', 'exportedAt', 'source', 'days', 'lifeStates', 'cycleMarks'], problems);
  if (!Array.isArray(x.days)) throw new FormatError('the file has no days list');

  const byDate = new Map<string, Day>();
  x.days.forEach((raw, i) => {
    const d = parseDay(raw, `day ${i + 1}`, problems);
    if (!d) return;
    if (byDate.has(d.date)) { problems.push(`day ${i + 1} (${d.date}): the date is listed twice, the first is kept`); return; }
    byDate.set(d.date, d);
  });

  const lifeStates: LifeStateSpan[] = [];
  if (x.lifeStates !== undefined) {
    if (!Array.isArray(x.lifeStates)) problems.push('lifeStates must be a list');
    else x.lifeStates.forEach((s, i) => {
      const w = `life state ${i + 1}`;
      if (!isObj(s) || !oneOf(LIFE_STATE_KINDS, s.kind) || !isDay(s.start)) { problems.push(`${w}: needs a kind and a start date`); return; }
      if (s.end !== undefined && (!isDay(s.end) || s.end < s.start)) { problems.push(`${w}: the end must be a date on or after the start`); return; }
      if (s.outcome !== undefined && (s.kind !== 'pregnant' || !oneOf(PREGNANCY_OUTCOMES, s.outcome))) { problems.push(`${w}: outcome is for a pregnancy and is birth or loss`); return; }
      if (s.detail !== undefined && !isObj(s.detail)) { problems.push(`${w}: detail must be an object`); return; }
      lifeStates.push({ kind: s.kind, start: s.start, ...(s.end ? { end: s.end } : {}), ...(s.outcome ? { outcome: s.outcome } : {}), ...(s.detail ? { detail: s.detail } : {}) });
    });
  }
  const cycleMarks: CycleMark[] = [];
  if (x.cycleMarks !== undefined) {
    if (!Array.isArray(x.cycleMarks)) problems.push('cycleMarks must be a list');
    else x.cycleMarks.forEach((m, i) => {
      if (!isObj(m) || !isDay(m.cycleStart) || !oneOf(['exclude', 'confirm_long'] as const, m.mark)) problems.push(`cycle mark ${i + 1}: needs a cycleStart date and a mark of exclude or confirm_long`);
      else cycleMarks.push({ cycleStart: m.cycleStart, mark: m.mark });
    });
  }
  if (x.source !== undefined && (!isObj(x.source) || typeof x.source.app !== 'string')) problems.push('source needs an app name');
  if (x.exportedAt !== undefined && typeof x.exportedAt !== 'string') problems.push('exportedAt must be text');

  const data: SanguineData = {
    format: FORMAT, version: VERSION,
    ...(typeof x.exportedAt === 'string' ? { exportedAt: x.exportedAt } : {}),
    ...(isObj(x.source) && typeof x.source.app === 'string' ? { source: { app: x.source.app } } : {}),
    days: [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    ...(lifeStates.length ? { lifeStates } : {}),
    ...(cycleMarks.length ? { cycleMarks } : {}),
  };
  return { data, problems };
}

/** An empty file in this format, for adapters to fill. */
export const emptyData = (app: string): SanguineData => ({ format: FORMAT, version: VERSION, source: { app }, days: [] });
