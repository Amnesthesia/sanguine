// Import of another app's daily log (P3-13, PLAN.md §8.10): every field Sanguine has an event for, not only period starts.
// Format parsers (Natural Cycles, later Flo and Clue) turn their files into DailyRow; this writer is shared. Pure over Database/EventStore.
import { sealNote } from '@sanguine/crypto';
import type { ISODate } from '@sanguine/engine';
import type { Database } from './database';
import type { FlowKind, NewEvent } from './events';
import type { Clock } from './ids';
import type { EventStore } from './store';

export interface DailyRow {
  day: ISODate;
  flow?: 'spotting' | 'light' | 'medium' | 'heavy';
  flowKind?: FlowKind; // default 'period'
  tempC?: number;
  tempTime?: string; // 'HH:MM'
  tempExcluded?: boolean; // the source app marked the reading as deviating: imported as disturbed, never as a clean reading
  tempSource?: 'oral' | 'vaginal' | 'other'; // the engine's BBT series accepts only these; default 'oral' (Natural Cycles is an oral-thermometer app)
  lh?: 'negative' | 'positive';
  mucus?: 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite';
  sex?: { protected: boolean };
  note?: string;
}
/** `skipped`: fields an earlier import already wrote. `duplicates`: the same day and field repeated inside this file (the first is kept). */
export interface DailyImportResult { added: number; skipped: number; duplicates: number; notesDropped: number }

/** Writes the rows as `imported` events in one transaction. Each event carries `external_id` `<source>:<day>:<field>`, so importing the
 *  same file twice adds nothing. Notes are sealed with the notes key; without a key they are left out and counted. */
export async function importDailyRows(db: Database, store: EventStore, rows: DailyRow[], o: { sourceApp: string; today: ISODate; clock: Clock; noteKey?: Uint8Array }): Promise<DailyImportResult> {
  const known = new Set((await db.all<{ external_id: string }>('SELECT external_id FROM event WHERE source_app = ? AND external_id IS NOT NULL', [o.sourceApp])).map((r) => r.external_id));
  const events: NewEvent[] = [];
  const inFile = new Set<string>();
  let skipped = 0;
  let duplicates = 0;
  let notesDropped = 0;
  const add = (field: string, day: ISODate, kind: string, payload: Record<string, unknown>) => {
    const external_id = `${o.sourceApp}:${day}:${field}`;
    if (inFile.has(external_id)) { duplicates++; return; }
    inFile.add(external_id);
    if (known.has(external_id)) { skipped++; return; }
    events.push({ kind, payload: { day, ...payload }, provenance: 'imported', source_app: o.sourceApp, external_id });
  };
  for (const r of [...rows].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))) {
    if (r.flow) add('flow', r.day, 'flow', { level: r.flow, flow_kind: r.flowKind ?? 'period' });
    if (r.tempC !== undefined && Number.isFinite(r.tempC)) {
      add('bbt', r.day, 'biomarker', {
        type: 'bbt', value: { valueC: Math.round(r.tempC * 100) / 100 }, source: r.tempSource ?? 'oral',
        ...(r.tempTime ? { measured_at: `${r.day}T${r.tempTime}:00` } : {}), ...(r.tempExcluded ? { disturbed: true } : {}),
      });
    }
    if (r.lh) add('lh', r.day, 'biomarker', { type: 'lh', value: { result: r.lh }, source: 'strip' });
    if (r.mucus) add('mucus', r.day, 'biomarker', { type: 'mucus', value: { quality: r.mucus }, source: 'app' });
    if (r.sex) add('sex', r.day, 'sex', { protected: r.sex.protected });
    if (r.note !== undefined && r.note.trim() !== '') {
      if (!o.noteKey) notesDropped++;
      else add('note', r.day, 'note', { cipher: sealNote(o.noteKey, r.note.trim(), (k) => o.clock.randomBytes(k)) });
    }
  }
  if (events.length > 0) {
    await store.appendMany([{ kind: 'import.batch', payload: { source: o.sourceApp, count: events.length }, effective_day: o.today, provenance: 'imported', source_app: o.sourceApp }, ...events]);
  }
  return { added: events.length, skipped, duplicates, notesDropped };
}
