import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv';
import type { Database } from './database';
import { exportBundle, ImportError, importBundle, importPeriodCsv, parseDateCell } from './exportImport';
import type { Clock } from './ids';
import { migrate } from './migrate';
import { EventStore } from './store';
import { openTestDb } from './testDb';

function clock(seed = 0): Clock {
  let n = seed;
  return { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n * 7 + i + seed) % 256) };
}
async function fresh(seed = 0): Promise<{ db: Database; store: EventStore; clk: Clock }> {
  const db = openTestDb();
  await migrate(db);
  const clk = clock(seed);
  return { db, store: new EventStore(db, clk), clk };
}
const dump = async (db: Database) => JSON.stringify(await Promise.all(['cycle', 'daily_log', 'biomarker', 'life_state'].map((t) => db.all(`SELECT * FROM ${t} ORDER BY 1`))));
async function populate(store: EventStore) {
  for (const d of ['2026-08-04', '2026-09-01', '2026-09-30']) await store.append({ kind: 'flow', payload: { day: d, level: 'medium', flow_kind: 'period' } });
  await store.append({ kind: 'symptom', payload: { day: '2026-10-01', code: 'cramps', intensity: 2 } });
  await store.append({ kind: 'energy', payload: { day: '2026-10-01', level: 2 } });
  await store.append({ kind: 'sex', payload: { day: '2026-10-02', protected: true } });
  await store.append({ kind: 'note', payload: { day: '2026-10-02', cipher: 'zz' } });
  await store.append({ kind: 'biomarker', payload: { day: '2026-10-10', type: 'bbt', value: { valueC: 36.42 }, source: 'oral', measured_at: '2026-10-10T06:40:00+10:00' } });
  const mistake = await store.append({ kind: 'flow', payload: { day: '2026-10-05', level: 'heavy', flow_kind: 'period' } });
  await store.retract(mistake.id);
  await store.append({ kind: 'life_state.set', payload: { kind: 'perimenopause', detail: {}, day: '2026-01-01' } });
}

describe('csv helpers', () => {
  it('quotes commas, quotes and newlines and parses them back', () => {
    const rows = [['a,b', 'say "hi"', 'x\ny', '']];
    expect(parseCsv(toCsv(['c1', 'c2', 'c3', 'c4'], rows))[1]).toEqual(rows[0]);
  });
  it('handles CRLF, BOM and blank lines', () => expect(parseCsv('﻿a,b\r\n\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]));
});

describe('export', () => {
  it('contains events.jsonl, the CSVs, manifest.json and README.md', async () => {
    const { db, store, clk } = await fresh();
    await populate(store);
    const { zip, eventCount } = await exportBundle(db, store, clk);
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(['README.md', 'biomarkers.csv', 'cycles.csv', 'daily.csv', 'events.jsonl', 'manifest.json', 'profile.json']);
    const lines = strFromU8(files['events.jsonl'] as Uint8Array).trim().split('\n');
    expect(lines).toHaveLength(eventCount);
    expect(lines.map((l) => JSON.parse(l).kind)).toContain('retract');
    expect(JSON.parse(strFromU8(files['manifest.json'] as Uint8Array))).toMatchObject({ format: 'sanguine-export', version: 1, events: eventCount });
    const cycles = parseCsv(strFromU8(files['cycles.csv'] as Uint8Array));
    expect(cycles[0]).toContain('start_day');
    expect(cycles).toHaveLength(4); // header + 3 cycles (the retracted period day is gone)
    const daily = parseCsv(strFromU8(files['daily.csv'] as Uint8Array));
    const row = daily.find((r) => r[0] === '2026-10-01');
    expect(row?.[4]).toBe('cramps:2');
    expect(daily[0]?.at(-1)).toBe('energy');
    expect(daily.find((r) => r[0] === '2026-10-01')?.at(-1)).toBe('2');
    expect(daily.find((r) => r[0] === '2026-10-02')?.slice(5, 7)).toEqual(['yes', 'yes']);
    expect(strFromU8(files['README.md'] as Uint8Array)).toContain('events.jsonl');
  });
  it('an empty log exports an empty events.jsonl', async () => {
    const { db, store, clk } = await fresh();
    const files = unzipSync((await exportBundle(db, store, clk)).zip);
    expect(strFromU8(files['events.jsonl'] as Uint8Array)).toBe('');
  });
});

describe('import (Sanguine bundle)', () => {
  it('round-trips: a fresh device ends with identical projections and engine inputs', async () => {
    const a = await fresh(1);
    await populate(a.store);
    const { zip } = await exportBundle(a.db, a.store, a.clk);
    const b = await fresh(2);
    const r = await importBundle(b.db, b.store, zip);
    expect(r.imported).toBe(a.store ? (await a.store.events()).length : 0);
    expect(await dump(b.db)).toBe(await dump(a.db));
    expect(JSON.stringify(await b.store.engineInputs())).toBe(JSON.stringify(await a.store.engineInputs()));
    // the prediction ledger is rebuilt too
    expect((await b.db.all('SELECT * FROM prediction_score')).length).toBe((await a.db.all('SELECT * FROM prediction_score')).length);
  });
  it('is idempotent: importing the same file twice adds nothing', async () => {
    const a = await fresh(1);
    await populate(a.store);
    const { zip } = await exportBundle(a.db, a.store, a.clk);
    const b = await fresh(2);
    await importBundle(b.db, b.store, zip);
    const again = await importBundle(b.db, b.store, zip);
    expect(again.imported).toBe(0);
    expect(again.duplicates).toBe((await b.store.events()).length);
  });
  it('merges into a log that already has data and keeps local events', async () => {
    const a = await fresh(1);
    await a.store.append({ kind: 'flow', payload: { day: '2026-08-04', level: 'medium', flow_kind: 'period' } });
    const b = await fresh(2);
    await b.store.append({ kind: 'flow', payload: { day: '2026-09-01', level: 'medium', flow_kind: 'period' } });
    await importBundle(b.db, b.store, (await exportBundle(a.db, a.store, a.clk)).zip);
    expect((await b.db.all<{ start_day: string }>('SELECT start_day FROM cycle ORDER BY start_day')).map((r) => r.start_day)).toEqual(['2026-08-04', '2026-09-01']);
    await b.store.append({ kind: 'flow', payload: { day: '2026-09-30', level: 'medium', flow_kind: 'period' } }); // new local writes still work
    expect((await b.store.events()).at(-1)?.lamport).toBeGreaterThan(1);
  });
  it('rejects bad input atomically', async () => {
    const { db, store } = await fresh();
    await expect(importBundle(db, store, strToU8('not a zip'))).rejects.toBeInstanceOf(ImportError);
    await expect(importBundle(db, store, zipSync({ 'other.txt': strToU8('x') }))).rejects.toThrow(/events.jsonl is missing/);
    const good = JSON.stringify({ id: 'e1', lamport: 1, device_id: 'd', recorded_at: 'x', effective_day: '2026-10-01', tz: 'UTC', kind: 'flow', payload: JSON.stringify({ day: '2026-10-01', level: 'medium', flow_kind: 'period' }), provenance: 'manual', schema_v: 1 });
    const bad = JSON.stringify({ id: 'e2', lamport: 2, device_id: 'd', recorded_at: 'x', effective_day: '2026-10-02', tz: 'UTC', kind: 'teleport', payload: '{}', provenance: 'manual', schema_v: 1 });
    await expect(importBundle(db, store, zipSync({ 'events.jsonl': strToU8(`${good}\n${bad}\nnot json\n`) }))).rejects.toMatchObject({ details: [expect.stringContaining('line 2'), expect.stringContaining('line 3')] });
    expect(await store.events()).toEqual([]);
    await expect(importBundle(db, store, zipSync({ 'events.jsonl': strToU8(good), 'manifest.json': strToU8(JSON.stringify({ format: 'other', version: 1 })) }))).rejects.toThrow(/unsupported/);
  });
  it('keeps original provenance when restoring', async () => {
    const a = await fresh(1);
    await a.store.append({ kind: 'flow', payload: { day: '2026-08-04', level: 'light', flow_kind: 'period' }, provenance: 'sensor' });
    const b = await fresh(2);
    await importBundle(b.db, b.store, (await exportBundle(a.db, a.store, a.clk)).zip);
    expect((await b.store.events())[0]?.provenance).toBe('sensor');
  });
});

describe('CSV of period starts', () => {
  it('parseDateCell: ISO and day-first, strict', () => {
    expect(parseDateCell('2026-03-04')).toBe('2026-03-04');
    expect(parseDateCell('3/4/2026')).toBe('2026-04-03'); // en-AU: day first
    expect(parseDateCell('31/12/2026')).toBe('2026-12-31');
    expect(parseDateCell('31/02/2026')).toBeNull();
    expect(parseDateCell('2026-13-01')).toBeNull();
    expect(parseDateCell('yesterday')).toBeNull();
  });
  it('imports dates with a header, as imported/csv provenance, and builds cycles', async () => {
    const { db, store } = await fresh();
    const r = await importPeriodCsv(db, store, 'date\n2026-08-04\n2026-09-01\n2026-09-30\n', '2026-10-10');
    expect(r).toEqual({ added: 3, skipped: 0, problems: [] });
    expect((await db.all('SELECT start_day, next_start FROM cycle ORDER BY start_day'))).toEqual([
      { start_day: '2026-08-04', next_start: '2026-09-01' }, { start_day: '2026-09-01', next_start: '2026-09-30' }, { start_day: '2026-09-30', next_start: null }]);
    const ev = await store.events();
    expect(ev.filter((e) => e.kind === 'period.start').every((e) => e.provenance === 'imported' && e.source_app === 'csv')).toBe(true);
    expect(ev.find((e) => e.kind === 'import.batch')?.payload).toBe(JSON.stringify({ source: 'csv', count: 3 }));
  });
  it('accepts headerless files, day-first dates and an end column', async () => {
    const { db, store } = await fresh();
    await importPeriodCsv(db, store, 'start,end\n04/08/2026,08/08/2026\n01/09/2026,\n', '2026-10-10');
    expect(await db.all('SELECT start_day, end_day FROM cycle ORDER BY start_day')).toEqual([{ start_day: '2026-08-04', end_day: '2026-08-08' }, { start_day: '2026-09-01', end_day: '2026-09-01' }]);
    const b = await fresh();
    expect((await importPeriodCsv(b.db, b.store, '2026-08-04\n2026-09-01\n', '2026-10-10')).added).toBe(2);
  });
  it('skips dates already logged or repeated, and reports junk rows without failing the rest', async () => {
    const { db, store } = await fresh();
    await store.append({ kind: 'flow', payload: { day: '2026-08-04', level: 'medium', flow_kind: 'period' } });
    const r = await importPeriodCsv(db, store, 'date\n2026-08-04\n2026-09-01\n2026-09-01\nnot a date\n2026-10-01,\n', '2026-10-10');
    expect(r.added).toBe(2);
    expect(r.skipped).toBe(2);
    expect(r.problems).toEqual(['line 5: "not a date" is not a date']);
  });
  it('an empty or all-invalid file changes nothing', async () => {
    const { db, store } = await fresh();
    expect((await importPeriodCsv(db, store, '', '2026-10-10')).added).toBe(0);
    expect((await importPeriodCsv(db, store, 'date\nfoo\n', '2026-10-10')).added).toBe(0);
    expect(await store.events()).toEqual([]);
  });
});
