// Export (zip with events.jsonl + CSVs + README) and import (Sanguine bundle, CSV of period starts). PLAN.md §8.10.
// Pure over Database/EventStore: file picking and sharing live in services/.
import { ENGINE_VERSION } from '@sanguine/engine';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import exportCopy from '../../../../copy/export.en-AU.json';
import { parseCsv, toCsv } from './csv';
import type { Database } from './database';
import { type EventRow, validateEvent } from './events';
import type { Clock } from './ids';
import type { EventStore } from './store';

export const EXPORT_FORMAT = 'sanguine-export';
export const EXPORT_VERSION = 1;

export interface ExportResult { zip: Uint8Array; eventCount: number }

/** `forBackup` leaves out what came only from HealthKit and the derived CSVs (they would carry the same days): Apple does not allow HealthKit data in iCloud (PLAN.md §7.6). */
export async function exportBundle(db: Database, store: EventStore, clock: Clock, o: { forBackup?: boolean } = {}): Promise<ExportResult> {
  let events = await store.events();
  if (o.forBackup) {
    // by the id prefix the sync writes, not by a link: a link is removed when the platform deletes the record, and the event must stay out of the backup
    const fromHealthKit = new Set(events.filter((e) => e.provenance === 'imported' && e.external_id?.startsWith('healthkit:')).map((e) => e.id));
    events = events.filter((e) => !fromHealthKit.has(e.id) && !(e.retracts && fromHealthKit.has(e.retracts)));
    // a retract of a retract of a left-out event would dangle too: drop until stable
    for (let again = true; again;) { const ids = new Set(events.map((e) => e.id)); const kept = events.filter((e) => !e.retracts || ids.has(e.retracts)); again = kept.length !== events.length; events = kept; }
  }
  const cycles = o.forBackup ? [] : await db.all<Record<string, unknown>>('SELECT * FROM cycle ORDER BY start_day');
  const days = o.forBackup ? [] : await db.all<Record<string, unknown>>('SELECT * FROM daily_log ORDER BY day');
  const bios = o.forBackup ? [] : await db.all<Record<string, unknown>>('SELECT * FROM biomarker ORDER BY day, id');
  const files: Record<string, Uint8Array> = {
    'events.jsonl': strToU8(events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : '')),
    'cycles.csv': strToU8(toCsv(
      ['id', 'start_day', 'end_day', 'next_start', 'length_days', 'bleed_days', 'quality', 'ovulation_day', 'ovulation_sd', 'ovulation_basis', 'luteal_days'],
      cycles.map((c) => [c.id, c.start_day, c.end_day, c.next_start, c.length_days, c.bleed_days, c.quality, c.ov_day, c.ov_sd, c.ov_basis, c.luteal_days]),
    )),
    'daily.csv': strToU8(toCsv(
      ['day', 'flow', 'flow_kind', 'clots', 'symptoms', 'condom_used', 'has_note', 'energy'],
      days.map((d) => [
        d.day, d.flow, d.flow_kind, d.clots ? 'yes' : 'no',
        (JSON.parse(String(d.symptoms)) as Array<{ code: string; intensity: number }>).map((s) => `${s.code}:${s.intensity}`).join(';'),
        d.sex ? ((JSON.parse(String(d.sex)) as { protected: boolean }).protected ? 'yes' : 'no') : '',
        d.notes_cipher ? 'yes' : 'no', d.energy ?? '',
      ]),
    )),
    'biomarkers.csv': strToU8(toCsv(
      ['id', 'day', 'type', 'value', 'measured_at', 'source', 'provenance', 'disturbed'],
      bios.map((b) => [b.id, b.day, b.type, b.value, b.measured_at, b.source, b.provenance, b.disturbed ? 'yes' : 'no']),
    )),
    'profile.json': strToU8(JSON.stringify(await store.profile())),
    'manifest.json': strToU8(JSON.stringify({ format: EXPORT_FORMAT, version: EXPORT_VERSION, exported_at: clock.iso(), engine_version: ENGINE_VERSION, events: events.length, cycles: cycles.length }, null, 2)),
    'README.md': strToU8(exportCopy.readme),
  };
  if (o.forBackup) for (const f of ['cycles.csv', 'daily.csv', 'biomarkers.csv', 'README.md']) delete files[f];
  return { zip: zipSync(files), eventCount: events.length };
}

export interface ImportResult { imported: number; duplicates: number }
export class ImportError extends Error {
  constructor(message: string, readonly details: string[] = []) { super(message); }
}

const EVENT_FIELDS = ['id', 'lamport', 'device_id', 'recorded_at', 'effective_day', 'tz', 'kind', 'payload', 'provenance', 'schema_v'] as const;

/** Reads a Sanguine export and merges its events into the log. All-or-nothing; importing the same file twice adds nothing. */
export async function importBundle(db: Database, store: EventStore, zip: Uint8Array): Promise<ImportResult> {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(zip); } catch { throw new ImportError('not a zip file'); }
  const raw = files['events.jsonl'];
  if (!raw) throw new ImportError('events.jsonl is missing');
  const manifest = files['manifest.json'] ? (JSON.parse(strFromU8(files['manifest.json'])) as { format?: string; version?: number }) : undefined;
  if (manifest && (manifest.format !== EXPORT_FORMAT || (manifest.version ?? 0) > EXPORT_VERSION)) throw new ImportError('unsupported export version');

  const problems: string[] = [];
  const events: EventRow[] = [];
  strFromU8(raw).split('\n').forEach((line, i) => {
    if (line.trim() === '') return;
    try {
      const e = JSON.parse(line) as EventRow;
      for (const f of EVENT_FIELDS) if (e[f] === undefined || e[f] === null) throw new Error(`missing ${f}`);
      if (!Number.isInteger(e.lamport)) throw new Error('lamport');
      const payload = JSON.parse(e.payload) as Record<string, unknown>;
      validateEvent({ kind: e.kind, payload, ...(e.retracts ? { retracts: e.retracts } : {}), effective_day: e.effective_day });
      events.push({ ...e, source_app: e.source_app ?? null, external_id: e.external_id ?? null, retracts: e.retracts ?? null });
    } catch (err) {
      problems.push(`line ${i + 1}: ${(err as Error).message}`);
    }
  });
  if (problems.length) throw new ImportError('the file has invalid lines; nothing was imported', problems.slice(0, 10));

  events.sort((a, b) => a.lamport - b.lamport || (a.id < b.id ? -1 : 1));
  let imported = 0;
  await db.transaction(async (tx) => {
    for (const e of events) {
      const r = await tx.run(
        `INSERT OR IGNORE INTO event (id, lamport, device_id, recorded_at, effective_day, tz, kind, payload, provenance, source_app, external_id, retracts, schema_v)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [e.id, e.lamport, e.device_id, e.recorded_at, e.effective_day, e.tz, e.kind, e.payload, e.provenance, e.source_app, e.external_id, e.retracts, e.schema_v],
      );
      imported += r.changes;
    }
    if (imported > 0) await store.rebuildWithin(tx);
  });
  // a restore on a fresh device also brings the profile (birth year etc.), but never overwrites one that is already set
  if (files['profile.json'] && Object.keys(await store.profile()).length === 0) {
    const profile = JSON.parse(strFromU8(files['profile.json'])) as Record<string, unknown>;
    if (Object.keys(profile).length > 0) await store.setProfile(profile);
  }
  return { imported, duplicates: events.length - imported };
}

// ---------------- CSV of period start dates ----------------
export interface CsvImportResult { added: number; skipped: number; problems: string[] }

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** ISO (YYYY-MM-DD) or day-first D/M/YYYY (the app's locale is en-AU, so 03/04/2026 is 3 April). */
export function parseDateCell(s: string): string | null {
  const t = s.trim();
  let y: number, m: number, d: number;
  const a = ISO.exec(t);
  const b = DMY.exec(t);
  if (a) [y, m, d] = [Number(a[1]), Number(a[2]), Number(a[3])] as [number, number, number];
  else if (b) [d, m, y] = [Number(b[1]), Number(b[2]), Number(b[3])] as [number, number, number];
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Generic CSV: first column (or a `start`/`date` column) holds period start dates; an optional `end` column holds the last day. */
export async function importPeriodCsv(db: Database, store: EventStore, text: string, today: string): Promise<CsvImportResult> {
  const rows = parseCsv(text);
  const problems: string[] = [];
  if (rows.length === 0) return { added: 0, skipped: 0, problems: ['the file is empty'] };
  const head = (rows[0] as string[]).map((c) => c.trim().toLowerCase());
  const hasHeader = !parseDateCell((rows[0] as string[])[0] ?? '');
  const startCol = hasHeader ? Math.max(0, head.findIndex((h) => ['start', 'start_date', 'date', 'period_start', 'start_day'].includes(h))) : 0;
  const endCol = hasHeader ? head.findIndex((h) => ['end', 'end_date', 'period_end', 'end_day'].includes(h)) : -1;
  const existing = new Set((await db.all<{ start_day: string }>('SELECT start_day FROM cycle')).map((r) => r.start_day));
  const seen = new Set<string>();
  const events: Array<{ start: string; end?: string }> = [];
  let skipped = 0;
  (hasHeader ? rows.slice(1) : rows).forEach((r, i) => {
    const line = i + (hasHeader ? 2 : 1);
    const start = parseDateCell(r[startCol] ?? '');
    if (!start) { problems.push(`line ${line}: "${r[startCol] ?? ''}" is not a date`); return; }
    if (existing.has(start) || seen.has(start)) { skipped++; return; }
    seen.add(start);
    const end = endCol >= 0 ? parseDateCell(r[endCol] ?? '') : null;
    if (end && end < start) { problems.push(`line ${line}: the end is before the start`); return; }
    events.push({ start, ...(end ? { end } : {}) });
  });
  if (events.length === 0) return { added: 0, skipped, problems };
  const batch = { source: 'csv', count: events.length };
  await store.appendMany([
    { kind: 'import.batch', payload: batch, effective_day: today, provenance: 'imported', source_app: 'csv' },
    ...events.flatMap((e) => [
      { kind: 'period.start', payload: { day: e.start }, provenance: 'imported' as const, source_app: 'csv' },
      ...(e.end ? [{ kind: 'period.end', payload: { day: e.end }, provenance: 'imported' as const, source_app: 'csv' }] : []),
    ]),
  ]);
  return { added: events.length, skipped, problems };
}
