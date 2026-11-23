// Cases of the old importDaily.test.ts that importSanguineData.test.ts does not cover, as seen through the adapters (D-159).
import { strToU8 } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../database';
import { importSanguineData } from '../format/importSanguineData';
import type { Day } from '../format/sanguineData';
import type { Clock } from '../ids';
import { migrate } from '../migrate';
import { EventStore } from '../store';
import { openTestDb } from '../testDb';
import { naturalCycles } from './naturalCycles';

let n = 0;
const clock: Clock = { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) };
let db: Database;
let store: EventStore;
beforeEach(async () => { db = openTestDb(); await migrate(db); store = new EventStore(db, clock); });
const opts = { sourceApp: 'natural_cycles', today: '2026-10-10' as const, clock };
const HEADER = 'Date,Temperature,Menstruation,Menstruation Quantity,LH test,Data Flag,Notes';
const decode = (lines: string[]) => naturalCycles.decode({ name: 'Daily Entries.csv', bytes: strToU8([HEADER, ...lines].join('\n')) }, {}).data;
const run = (days: Day[]) => importSanguineData(db, store, { ...decode(['2026-01-01,,SPOTTING,,,,']), days }, opts);

describe('Natural Cycles through importSanguineData', () => {
  it('keeps the external ids of the old importer', async () => {
    await importSanguineData(db, store, decode(['2026-09-01,36.3,MENSTRUATION,HEAVY,YES,PAIN_CRAMPS,hi']), { ...opts, noteKey: new Uint8Array(32).fill(7) });
    const ids = (await store.events()).filter((e) => e.kind !== 'import.batch').map((e) => e.external_id).sort();
    expect(ids).toEqual(['bbt', 'flow', 'lh', 'note', 'symptom:cramps'].map((f) => `natural_cycles:2026-09-01:${f}`));
  });
  it('temperatures reach the engine as an oral series; a disturbed one is never clean', async () => {
    await importSanguineData(db, store, decode(['2026-09-01,36.3,,,,,', '2026-09-02,36.4,,,,DEVIATION_REASON_SICK,']), opts);
    const t = (await store.engineInputs()).history.temperatures;
    expect(t.map((r) => [r.date, r.source, r.disturbed ?? false])).toEqual([['2026-09-01', 'oral', false], ['2026-09-02', 'oral', true]]);
    expect(await db.all('SELECT disturbed FROM biomarker ORDER BY id')).toEqual([{ disturbed: 0 }, { disturbed: 1 }]);
  });
  it('a cervix observation reaches the engine', async () => {
    await run([{ date: '2026-09-14', cervix: { position: 'high', firmness: 'soft', opening: 'open' } }]);
    expect((await store.engineInputs()).history.cervix).toEqual([{ date: '2026-09-14', position: 'high', firmness: 'soft', opening: 'open' }]);
  });
  it('a retracted imported entry does not come back on re-import', async () => {
    const data = decode(['2026-09-01,,MENSTRUATION,MEDIUM,,,']);
    await importSanguineData(db, store, data, opts);
    await store.retract((await store.events()).find((x) => x.kind === 'flow')?.id as string);
    expect((await importSanguineData(db, store, data, opts)).added).toBe(0);
  });
  it('a sparse import of a 12-day period with gaps is one period (D-052)', async () => {
    await importSanguineData(db, store, decode(['2026-08-01', '2026-08-02', '2026-08-05', '2026-08-06', '2026-08-09', '2026-08-12'].map((d) => `${d},,MENSTRUATION,LIGHT,,,`)), opts);
    expect(await db.all('SELECT start_day, bleed_days FROM cycle')).toEqual([{ start_day: '2026-08-01', bleed_days: 12 }]);
  });
});
