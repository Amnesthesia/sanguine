import { openNote } from '@sanguine/crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from './database';
import type { Clock } from './ids';
import { importDailyRows } from './importDaily';
import { migrate } from './migrate';
import { EventStore } from './store';
import { openTestDb } from './testDb';

let n = 0;
const clock: Clock = { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) };
const KEY = new Uint8Array(32).fill(7);
let db: Database;
let store: EventStore;
beforeEach(async () => { db = openTestDb(); await migrate(db); store = new EventStore(db, clock); });
const opts = (o: Partial<{ sourceApp: string; noteKey: Uint8Array }> = {}) => ({ sourceApp: 'natural_cycles', today: '2026-10-10', clock, ...o });

describe('importDailyRows (P3-13): every daily field, not only period starts', () => {
  it('writes flow, temperature, LH, mucus, sex and note with imported provenance and external ids', async () => {
    const r = await importDailyRows(db, store, [
      { day: '2026-09-01', flow: 'medium', tempC: 36.3, tempTime: '06:40', note: 'cramps bad' },
      { day: '2026-09-02', flow: 'heavy', tempC: 36.9, tempExcluded: true },
      { day: '2026-09-14', lh: 'positive', mucus: 'eggwhite', sex: { protected: false } },
    ], opts({ noteKey: KEY }));
    expect(r).toEqual({ added: 8, skipped: 0, notesDropped: 0 });
    const events = await store.events();
    expect(events.filter((e) => e.kind !== 'import.batch').every((e) => e.provenance === 'imported' && e.source_app === 'natural_cycles' && e.external_id)).toBe(true);
    expect(await db.all('SELECT start_day, end_day, bleed_days FROM cycle')).toEqual([{ start_day: '2026-09-01', end_day: '2026-09-02', bleed_days: 2 }]);
    expect(await db.all('SELECT day, type, disturbed, measured_at FROM biomarker ORDER BY day, type')).toEqual([
      { day: '2026-09-01', type: 'bbt', disturbed: 0, measured_at: '2026-09-01T06:40:00' },
      { day: '2026-09-02', type: 'bbt', disturbed: 1, measured_at: null },
      { day: '2026-09-14', type: 'lh', disturbed: 0, measured_at: null },
      { day: '2026-09-14', type: 'mucus', disturbed: 0, measured_at: null },
    ]);
    const note = await db.get<{ notes_cipher: Uint8Array }>("SELECT notes_cipher FROM daily_log WHERE day = '2026-09-01'");
    expect(openNote(KEY, new TextDecoder().decode(note?.notes_cipher))).toBe('cramps bad');
  });
  it('imported temperatures reach the engine as an oral series (source app kept in source_app)', async () => {
    await importDailyRows(db, store, [{ day: '2026-09-01', tempC: 36.3 }, { day: '2026-09-02', tempC: 36.4, tempExcluded: true }], opts());
    const t = (await store.engineInputs()).history.temperatures;
    expect(t.map((r) => [r.date, r.source, r.disturbed ?? false])).toEqual([['2026-09-01', 'oral', false], ['2026-09-02', 'oral', true]]);
  });
  it('excluded temperature is disturbed, never a clean reading', async () => {
    await importDailyRows(db, store, [{ day: '2026-09-02', tempC: 36.9, tempExcluded: true }], opts());
    expect(await db.all('SELECT disturbed FROM biomarker')).toEqual([{ disturbed: 1 }]);
  });
  it('a temperature and an LH test on the same day both import', async () => {
    expect((await importDailyRows(db, store, [{ day: '2026-09-14', tempC: 36.5, lh: 'positive' }], opts())).added).toBe(2);
  });
  it('second import adds nothing', async () => {
    const rows = [{ day: '2026-09-01', flow: 'medium' as const, tempC: 36.4 }];
    await importDailyRows(db, store, rows, opts());
    const before = (await store.events()).length;
    expect(await importDailyRows(db, store, rows, opts())).toEqual({ added: 0, skipped: 2, notesDropped: 0 });
    expect((await store.events()).length).toBe(before);
  });
  it('notes are dropped and counted when no note key is given', async () => {
    expect(await importDailyRows(db, store, [{ day: '2026-09-01', note: 'x' }], opts())).toEqual({ added: 0, skipped: 0, notesDropped: 1 });
    expect(await store.events()).toEqual([]);
  });
  it('a sparse import of a 12-day period with gaps is one period (D-052)', async () => {
    const days = ['2026-08-01', '2026-08-02', '2026-08-05', '2026-08-06', '2026-08-09', '2026-08-12'];
    await importDailyRows(db, store, days.map((day) => ({ day, flow: 'light' as const })), opts());
    expect(await db.all('SELECT start_day, bleed_days FROM cycle')).toEqual([{ start_day: '2026-08-01', bleed_days: 12 }]);
  });
});
