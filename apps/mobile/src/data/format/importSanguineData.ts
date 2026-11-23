// The one writer for the day-based format (D-159): every adapter (Natural Cycles, drip, Flo, Clue, our own file) decodes to SanguineData and this imports it.
// Generalises importDaily.ts: external ids for the old fields are kept identical so earlier imports still dedupe.
// Rule "the device's own entry wins": a manual or sensor entry for the same day and field is never overwritten by an import.
import { sealNote } from '@sanguine/crypto';
import type { ISODate } from '@sanguine/engine';
import type { Database } from '../database';
import type { NewEvent } from '../events';
import type { Clock } from '../ids';
import type { EventStore } from '../store';
import type { SanguineData } from './sanguineData';

/** `skipped`: already written by an earlier import, or the device already holds the same value. `duplicates`: the same day and field twice in this file.
 *  `kept`: days where the device holds a different value, so the file's was not written (once per day). */
export interface SanguineImportResult { added: number; skipped: number; duplicates: number; notesDropped: number; kept: number }

type Held = { flow?: string; kind?: string; clots: boolean; symptoms: Map<string, number>; sex?: string; energy?: number; note: boolean; bio: Map<string, string[]> };
const stable = (v: unknown): string => (v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${k}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}` : JSON.stringify(v));

/** What the device itself holds per day: events not imported from this source and not retracted, replayed in log order; biomarkers from the derived table. */
async function deviceHolds(db: Database, sourceApp: string): Promise<Map<string, Held>> {
  const held = new Map<string, Held>();
  const at = (d: string) => { let h = held.get(d); if (!h) { h = { clots: false, symptoms: new Map(), note: false, bio: new Map() }; held.set(d, h); } return h; };
  const evs = await db.all<{ kind: string; payload: string; effective_day: string }>(
    `SELECT kind, payload, effective_day FROM event WHERE kind IN ('flow','symptom','sex','energy','note') AND NOT (provenance = 'imported' AND source_app = ?)
       AND id NOT IN (SELECT retracts FROM event WHERE retracts IS NOT NULL) ORDER BY lamport, id`, [sourceApp]);
  for (const e of evs) {
    const p = JSON.parse(e.payload) as Record<string, unknown>;
    const h = at(e.effective_day);
    if (e.kind === 'flow') { h.flow = p.level as string; h.clots = p.clots === true; h.kind = (p.flow_kind as string) ?? 'period'; }
    else if (e.kind === 'symptom') { if (p.intensity === 0) h.symptoms.delete(p.code as string); else h.symptoms.set(p.code as string, p.intensity as number); }
    else if (e.kind === 'sex') h.sex = stable({ protected: p.protected });
    else if (e.kind === 'energy') h.energy = p.level === 0 ? undefined : (p.level as number);
    else h.note = true;
  }
  const bios = await db.all<{ day: string; type: string; value: string }>(
    `SELECT b.day, b.type, b.value FROM biomarker b JOIN event e ON e.id = b.event_id WHERE NOT (e.provenance = 'imported' AND e.source_app = ?)`, [sourceApp]);
  for (const b of bios) {
    const m = at(b.day).bio;
    m.set(b.type, [...(m.get(b.type) ?? []), stable(JSON.parse(b.value))]);
  }
  return held;
}

/** Writes the data as `imported` events in one transaction. Each event carries `external_id` `<source>:<day>:<field>`, so the same file twice adds nothing.
 *  Notes are sealed with the notes key; without a key they are left out and counted. */
export async function importSanguineData(db: Database, store: EventStore, data: SanguineData, o: { sourceApp: string; today: ISODate; clock: Clock; noteKey?: Uint8Array }): Promise<SanguineImportResult> {
  const known = new Set((await db.all<{ external_id: string }>('SELECT external_id FROM event WHERE source_app = ? AND external_id IS NOT NULL', [o.sourceApp])).map((r) => r.external_id));
  const held = await deviceHolds(db, o.sourceApp);
  const events: NewEvent[] = [];
  const inFile = new Set<string>();
  const keptDays = new Set<string>();
  let skipped = 0;
  let duplicates = 0;
  let notesDropped = 0;
  /** `device`: 'same' | 'differs' | undefined (device holds nothing for this field). */
  const add = (idPart: string, day: ISODate, kind: string, payload: Record<string, unknown>, device?: 'same' | 'differs') => {
    const external_id = `${o.sourceApp}:${idPart}`;
    if (inFile.has(external_id)) { duplicates++; return; }
    inFile.add(external_id);
    if (known.has(external_id)) { skipped++; return; }
    if (device === 'same') { skipped++; return; }
    if (device === 'differs') { keptDays.add(day); return; }
    events.push({ kind, payload, provenance: 'imported', source_app: o.sourceApp, external_id });
  };
  const cmp = (same: boolean, present: boolean) => (present ? (same ? 'same' : 'differs') : undefined);

  for (const d of [...data.days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    const day = d.date;
    const h = held.get(day);
    const id = (f: string) => `${day}:${f}`;
    const bio = (type: string, value: unknown) => { const v = h?.bio.get(type); return cmp(v?.includes(stable(value)) ?? false, v !== undefined); };
    if (d.flow) {
      const kind = d.flow.kind ?? 'period';
      add(id('flow'), day, 'flow', { day, level: d.flow.level, flow_kind: kind, ...(d.flow.clots ? { clots: true } : {}) },
        cmp(h?.flow === d.flow.level && h.kind === kind && h.clots === (d.flow.clots === true), h?.flow !== undefined));
    }
    const seen: Record<string, number> = {};
    for (const t of d.temperatures ?? []) {
      if (!Number.isFinite(t.valueC)) continue;
      const n = (seen[t.type] = (seen[t.type] ?? 0) + 1);
      const value = { valueC: Math.round(t.valueC * 100) / 100 };
      add(id(n === 1 ? t.type : `${t.type}:${n}`), day, 'biomarker', {
        day, type: t.type, value, source: t.source ?? (t.type === 'bbt' ? 'oral' : 'other'),
        ...(t.time ? { measured_at: `${day}T${t.time}:00` } : {}), ...(t.disturbed ? { disturbed: true } : {}),
      }, bio(t.type, value));
    }
    if (d.lh) add(id('lh'), day, 'biomarker', { day, type: 'lh', value: { result: d.lh }, source: 'strip' }, bio('lh', { result: d.lh }));
    if (d.mucus) { const value = { quality: d.mucus.quality, ...(d.mucus.amount ? { amount: d.mucus.amount } : {}) }; add(id('mucus'), day, 'biomarker', { day, type: 'mucus', value, source: 'app' }, bio('mucus', value)); }
    if (d.cervix) add(id('cervix'), day, 'biomarker', { day, type: 'cervix', value: d.cervix, source: 'app' }, bio('cervix', d.cervix));
    if (d.sex) add(id('sex'), day, 'sex', { day, protected: d.sex.protected }, cmp(h?.sex === stable({ protected: d.sex.protected }), h?.sex !== undefined));
    for (const s of d.symptoms ?? []) {
      const intensity = s.intensity ?? 1;
      const have = h?.symptoms.get(s.code);
      add(id(`symptom:${s.code}`), day, 'symptom', { day, code: s.code, intensity }, cmp(have === intensity, have !== undefined));
    }
    if (d.energy !== undefined) add(id('energy'), day, 'energy', { day, level: d.energy }, cmp(h?.energy === d.energy, h?.energy !== undefined));
    if (d.pregTest) add(id('preg_test'), day, 'biomarker', { day, type: 'preg_test', value: { result: d.pregTest }, source: 'strip' }, bio('preg_test', { result: d.pregTest }));
    if (d.note !== undefined && d.note.trim() !== '') {
      if (!o.noteKey) notesDropped++;
      else add(id('note'), day, 'note', { day, cipher: sealNote(o.noteKey, d.note.trim(), (k) => o.clock.randomBytes(k)) }, h?.note ? 'differs' : undefined); // a sealed note cannot be compared, so a manual one is always kept
    }
  }
  for (const s of data.lifeStates ?? []) {
    add(`${s.start}:life:${s.kind}`, s.start, 'life_state.set', { kind: s.kind, detail: s.detail ?? {}, day: s.start });
    if (s.end) add(`${s.end}:life_end:${s.kind}`, s.end, 'life_state.end', { kind: s.kind, ...(s.outcome ? { outcome: s.outcome } : {}), day: s.end });
  }
  for (const m of data.cycleMarks ?? []) add(`${m.cycleStart}:mark:${m.mark}`, m.cycleStart, `cycle.${m.mark}`, { cycle_start: m.cycleStart });

  if (events.length > 0) {
    await store.appendMany([{ kind: 'import.batch', payload: { source: o.sourceApp, count: events.length }, effective_day: o.today, provenance: 'imported', source_app: o.sourceApp }, ...events]);
  }
  return { added: events.length, skipped, duplicates, notesDropped, kept: keptDays.size };
}
