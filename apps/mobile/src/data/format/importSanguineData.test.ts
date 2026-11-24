import { openNote } from '@sanguine/crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../database';
import type { Clock } from '../ids';
import { migrate } from '../migrate';
import { EventStore } from '../store';
import { openTestDb } from '../testDb';
import { exportSanguineData } from './exportSanguineData';
import { importSanguineData } from './importSanguineData';
import { emptyData, validateSanguineData, type Day, type SanguineData } from './sanguineData';

let n = 0;
const clock: Clock = { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) };
const KEY = new Uint8Array(32).fill(7);
let db: Database;
let store: EventStore;
beforeEach(async () => { db = openTestDb(); await migrate(db); store = new EventStore(db, clock); });
const opts = (o: Partial<{ sourceApp: string; noteKey: Uint8Array }> = {}) => ({ sourceApp: 'natural_cycles', today: '2026-10-10', clock, ...o });
const file = (days: Day[], extra: Partial<SanguineData> = {}): SanguineData => ({ ...emptyData('natural_cycles'), days, ...extra });
const ids = async () => (await store.events()).filter((e) => e.kind !== 'import.batch').map((e) => e.external_id).sort();

describe('importSanguineData (D-159)', () => {
  it('writes every field with the old external ids', async () => {
    const r = await importSanguineData(db, store, file([{
      date: '2026-09-01', flow: { level: 'medium', clots: true }, temperatures: [{ valueC: 36.3, type: 'bbt', time: '06:40' }], lh: 'positive', mucus: { quality: 'eggwhite', amount: 'heavy' },
      cervix: { position: 'high', firmness: 'soft', opening: 'open' }, sex: { protected: false }, symptoms: [{ code: 'cramps' }, { code: 'headache', intensity: 3 }],
      pregTest: 'negative', energy: 4, note: 'hello',
    }]), opts({ noteKey: KEY }));
    expect(r).toEqual({ added: 11, skipped: 0, duplicates: 0, notesDropped: 0, kept: 0 });
    expect(await ids()).toEqual(['bbt', 'cervix', 'energy', 'flow', 'lh', 'mucus', 'note', 'preg_test', 'sex', 'symptom:cramps', 'symptom:headache'].map((f) => `natural_cycles:2026-09-01:${f}`).sort());
    expect(await db.get('SELECT flow, flow_kind, clots, energy FROM daily_log')).toEqual({ flow: 'medium', flow_kind: 'period', clots: 1, energy: 4 });
    expect(JSON.parse((await db.get<{ symptoms: string }>('SELECT symptoms FROM daily_log'))?.symptoms ?? '[]')).toEqual(expect.arrayContaining([{ code: 'cramps', intensity: 1 }, { code: 'headache', intensity: 3 }]));
    const note = await db.get<{ notes_cipher: Uint8Array }>('SELECT notes_cipher FROM daily_log');
    expect(openNote(KEY, new TextDecoder().decode(note?.notes_cipher))).toBe('hello');
    expect(await db.get('SELECT measured_at, source FROM biomarker WHERE type = ?', ['bbt'])).toEqual({ measured_at: '2026-09-01T06:40:00', source: 'oral' });
  });
  it('a second import adds nothing', async () => {
    const f = file([{ date: '2026-09-01', flow: { level: 'light' }, energy: 2, temperatures: [{ valueC: 36.4, type: 'bbt' }] }]);
    await importSanguineData(db, store, f, opts());
    const before = (await store.events()).length;
    expect(await importSanguineData(db, store, f, opts())).toEqual({ added: 0, skipped: 3, duplicates: 0, notesDropped: 0, kept: 0 });
    expect((await store.events()).length).toBe(before);
  });
  it('the same day twice in a file counts duplicates', async () => {
    const r = await importSanguineData(db, store, file([{ date: '2026-09-01', flow: { level: 'light' } }, { date: '2026-09-01', flow: { level: 'heavy' }, lh: 'negative' }]), opts());
    expect(r).toEqual({ added: 2, skipped: 0, duplicates: 1, notesDropped: 0, kept: 0 });
  });
  it('two temperatures of a type get :2 and skin_temp its own ids and default source wrist', async () => {
    await importSanguineData(db, store, file([{ date: '2026-09-01', temperatures: [{ valueC: 36.3, type: 'bbt' }, { valueC: 36.5, type: 'bbt' }, { valueC: 35.1, type: 'skin_temp' }, { valueC: 35.2, type: 'skin_temp', disturbed: true }] }]), opts());
    expect(await ids()).toEqual(['bbt', 'bbt:2', 'skin_temp', 'skin_temp:2'].map((f) => `natural_cycles:2026-09-01:${f}`));
    expect(await db.all('SELECT type, source, disturbed FROM biomarker WHERE type = ? ORDER BY value', ['skin_temp'])).toEqual([{ type: 'skin_temp', source: 'wrist', disturbed: 0 }, { type: 'skin_temp', source: 'wrist', disturbed: 1 }]);
  });
  it('life states and cycle marks write valid events', async () => {
    const r = await importSanguineData(db, store, file([], {
      lifeStates: [{ kind: 'pregnant', start: '2026-01-01', end: '2026-09-20', outcome: 'birth' }, { kind: 'perimenopause', start: '2026-10-01' }],
      cycleMarks: [{ cycleStart: '2026-08-01', mark: 'exclude' }, { cycleStart: '2026-07-01', mark: 'confirm_long' }],
    }), opts());
    expect(r.added).toBe(5);
    expect(await ids()).toEqual(expect.arrayContaining(['natural_cycles:2026-01-01:life:pregnant', 'natural_cycles:2026-01-01:2026-09-20:life_end:pregnant', 'natural_cycles:2026-08-01:mark:exclude', 'natural_cycles:2026-07-01:mark:confirm_long']));
    expect(await db.all('SELECT kind, from_day, until_day FROM life_state ORDER BY from_day')).toEqual([{ kind: 'pregnant', from_day: '2026-01-01', until_day: '2026-09-20' }, { kind: 'perimenopause', from_day: '2026-10-01', until_day: null }]);
  });
  it('notes are dropped and counted without a key', async () => {
    expect(await importSanguineData(db, store, file([{ date: '2026-09-01', note: 'x' }]), opts())).toEqual({ added: 0, skipped: 0, duplicates: 0, notesDropped: 1, kept: 0 });
  });
  describe("the device's own entry wins", () => {
    it('an equal manual entry is skipped, a different one is kept and not overwritten (kept counts days)', async () => {
      await store.append({ kind: 'flow', payload: { day: '2026-09-01', level: 'heavy', flow_kind: 'period' } });
      await store.append({ kind: 'symptom', payload: { day: '2026-09-01', code: 'cramps', intensity: 2 } });
      await store.append({ kind: 'energy', payload: { day: '2026-09-01', level: 3 } });
      await store.append({ kind: 'biomarker', payload: { day: '2026-09-01', type: 'bbt', value: { valueC: 36.4 }, source: 'oral' } });
      const r = await importSanguineData(db, store, file([{
        date: '2026-09-01', flow: { level: 'light' }, symptoms: [{ code: 'cramps', intensity: 2 }, { code: 'acne' }], energy: 3, temperatures: [{ valueC: 36.9, type: 'bbt' }], lh: 'positive',
      }]), opts());
      expect(r).toEqual({ added: 2, skipped: 2, duplicates: 0, notesDropped: 0, kept: 1 });
      expect(await db.get('SELECT flow FROM daily_log')).toEqual({ flow: 'heavy' });
      expect(await db.all('SELECT value FROM biomarker WHERE type = ?', ['bbt'])).toEqual([{ value: JSON.stringify({ valueC: 36.4 }) }]);
    });
    it('a manual note is never overwritten', async () => {
      await store.append({ kind: 'note', payload: { day: '2026-09-01', cipher: 'sealed' } });
      expect(await importSanguineData(db, store, file([{ date: '2026-09-01', note: 'theirs' }]), opts({ noteKey: KEY }))).toEqual({ added: 0, skipped: 0, duplicates: 0, notesDropped: 0, kept: 1 });
    });
    it('a retracted manual entry does not count as present', async () => {
      const e = await store.append({ kind: 'flow', payload: { day: '2026-09-01', level: 'heavy', flow_kind: 'period' } });
      await store.retract(e.id);
      expect((await importSanguineData(db, store, file([{ date: '2026-09-01', flow: { level: 'light' } }]), opts())).added).toBe(1);
    });
    it("an import from the same app is not 'the device', so a changed file still dedupes by id", async () => {
      await importSanguineData(db, store, file([{ date: '2026-09-01', flow: { level: 'light' } }]), opts());
      expect(await importSanguineData(db, store, file([{ date: '2026-09-01', flow: { level: 'heavy' } }]), opts())).toEqual({ added: 0, skipped: 1, duplicates: 0, notesDropped: 0, kept: 0 });
    });
  });
});

describe('review fixes (D-159)', () => {
  const roundTrip = async (from: EventStore, fromDb: Database) => {
    const { data } = await exportSanguineData(fromDb, from, { exportedAt: '2026-10-10T00:00:00Z', noteKey: KEY });
    const checked = validateSanguineData(JSON.parse(JSON.stringify(data)));
    const db2 = openTestDb();
    await migrate(db2);
    const store2 = new EventStore(db2, clock);
    await importSanguineData(db2, store2, checked.data, opts({ sourceApp: 'sanguine', noteKey: KEY }));
    return { problems: checked.problems, db2, store2, data };
  };
  it('skin_temp reaches the wearable engine series, never the oral one', async () => {
    await importSanguineData(db, store, file([{ date: '2026-09-01', temperatures: [{ valueC: 35.1, type: 'skin_temp' }, { valueC: 35.3, type: 'skin_temp', source: 'finger' }, { valueC: 36.4, type: 'bbt' }] }]), opts());
    const t = (await store.engineInputs()).history.temperatures;
    expect(t.map((r) => r.source).sort()).toEqual(['finger', 'oral', 'wrist']);
  });
  it('a wrist reading keeps its source through export, validate and import', async () => {
    await store.append({ kind: 'biomarker', payload: { day: '2026-09-01', type: 'skin_temp', value: { valueC: 35.2 }, source: 'finger' } });
    const { problems, db2 } = await roundTrip(store, db);
    expect(problems).toEqual([]);
    expect(await db2.all('SELECT type, source FROM biomarker')).toEqual([{ type: 'skin_temp', source: 'finger' }]);
  });
  it('the validator leaves out a reading whose source belongs to the other type', () => {
    const { data, problems } = validateSanguineData({ format: 'sanguine-data', version: 1, days: [{ date: '2026-09-01', temperatures: [{ valueC: 36.4, type: 'bbt', source: 'wrist' }, { valueC: 35, type: 'skin_temp', source: 'oral' }, { valueC: 35, type: 'skin_temp' }] }] });
    expect(problems).toHaveLength(2);
    expect(data.days[0]?.temperatures).toEqual([{ valueC: 35, type: 'skin_temp' }]);
  });
  it('a re-import never closes another span: the end is written only with its own start', async () => {
    const span = { kind: 'pregnant' as const, start: '2026-01-01' as const };
    await importSanguineData(db, store, file([], { lifeStates: [span] }), opts());
    await store.append({ kind: 'life_state.end', payload: { kind: 'pregnant', day: '2026-01-10' } });
    await store.append({ kind: 'life_state.set', payload: { kind: 'pregnant', detail: {}, day: '2026-10-01' } });
    const r = await importSanguineData(db, store, file([], { lifeStates: [{ ...span, end: '2026-02-01' }] }), opts());
    expect(r).toEqual({ added: 0, skipped: 1, duplicates: 0, notesDropped: 0, kept: 1 });
    expect(await db.all('SELECT from_day, until_day FROM life_state ORDER BY from_day')).toEqual([{ from_day: '2026-01-01', until_day: '2026-01-10' }, { from_day: '2026-10-01', until_day: null }]);
  });
  it('a span the device already holds over that start is kept, with no end written', async () => {
    await store.append({ kind: 'life_state.set', payload: { kind: 'pregnant', detail: {}, day: '2025-12-01' } });
    const r = await importSanguineData(db, store, file([], { lifeStates: [{ kind: 'pregnant', start: '2026-01-01', end: '2026-02-01' }] }), opts());
    expect(r.added).toBe(0);
    expect(r.kept).toBe(1);
    expect(await db.all('SELECT until_day FROM life_state')).toEqual([{ until_day: null }]);
  });
  it('periods marked only as start/end events survive export and import', async () => {
    await store.append({ kind: 'period.start', payload: { day: '2026-08-01' } });
    await store.append({ kind: 'period.end', payload: { day: '2026-08-05' } });
    await store.append({ kind: 'period.start', payload: { day: '2026-08-29', merge: false } });
    const retracted = await store.append({ kind: 'period.start', payload: { day: '2026-09-15' } });
    await store.retract(retracted.id);
    const before = await db.all('SELECT start_day, end_day, bleed_days FROM cycle ORDER BY start_day');
    expect(before).toHaveLength(2);
    const { data, problems, db2 } = await roundTrip(store, db);
    expect(problems).toEqual([]);
    expect(data.periodMarks).toEqual([{ day: '2026-08-01', mark: 'start' }, { day: '2026-08-05', mark: 'end' }, { day: '2026-08-29', mark: 'start', merge: false }]);
    expect(await db2.all('SELECT start_day, end_day, bleed_days FROM cycle ORDER BY start_day')).toEqual(before);
  });
  it('a start-only period (onboarding) round-trips and a device period mark is not duplicated', async () => {
    await store.append({ kind: 'period.start', payload: { day: '2026-08-01' } });
    const { db2, store2 } = await roundTrip(store, db);
    expect(await db2.all('SELECT start_day FROM cycle')).toEqual([{ start_day: '2026-08-01' }]);
    const f = file([], { periodMarks: [{ day: '2026-08-01', mark: 'start' }] });
    expect(await importSanguineData(db, store, f, opts())).toEqual({ added: 0, skipped: 1, duplicates: 0, notesDropped: 0, kept: 0 });
    expect((await store2.events()).filter((e) => e.kind === 'period.start')).toHaveLength(1);
  });
  it('a retracted retraction restores the manual entry, so the import does not overwrite it', async () => {
    const e = await store.append({ kind: 'flow', payload: { day: '2026-09-01', level: 'heavy', flow_kind: 'period' } });
    const r1 = await store.retract(e.id);
    await store.retract(r1.id);
    const r = await importSanguineData(db, store, file([{ date: '2026-09-01', flow: { level: 'light' } }]), opts());
    expect(r).toEqual({ added: 0, skipped: 0, duplicates: 0, notesDropped: 0, kept: 1 });
    expect(await db.get('SELECT flow FROM daily_log')).toEqual({ flow: 'heavy' });
  });
  it.each(['negative', 'positive', 'high', 'peak', 'indeterminate'] as const)('LH %s survives export, validate and import', async (result) => {
    await store.append({ kind: 'biomarker', payload: { day: '2026-09-14', type: 'lh', value: { result }, source: 'strip' } });
    const { problems, db2 } = await roundTrip(store, db);
    expect(problems).toEqual([]);
    expect(await db2.all('SELECT value FROM biomarker WHERE type = ?', ['lh'])).toEqual([{ value: JSON.stringify({ result }) }]);
  });
});

describe('round trip keeps the projector rules (D-159)', () => {
  const rt = async () => {
    const { data } = await exportSanguineData(db, store, { exportedAt: '2026-10-10T00:00:00Z', noteKey: KEY });
    const checked = validateSanguineData(JSON.parse(JSON.stringify(data)));
    const db2 = openTestDb();
    await migrate(db2);
    const store2 = new EventStore(db2, clock);
    await importSanguineData(db2, store2, checked.data, opts({ sourceApp: 'sanguine', noteKey: KEY }));
    return { problems: checked.problems, db2, data };
  };
  it('a corrected closed span is written as a pair, never a start without its end', async () => {
    await importSanguineData(db, store, file([], { lifeStates: [{ kind: 'pregnant', start: '2026-01-01', end: '2026-02-01' }] }), opts());
    await importSanguineData(db, store, file([], { lifeStates: [{ kind: 'pregnant', start: '2026-01-02', end: '2026-02-01' }] }), opts());
    expect(await db.all('SELECT from_day, until_day FROM life_state ORDER BY from_day')).toEqual([{ from_day: '2026-01-01', until_day: '2026-02-01' }, { from_day: '2026-01-02', until_day: '2026-02-01' }]);
  });
  it('a closed span whose end is already known is skipped whole, not half written', async () => {
    const f = file([], { lifeStates: [{ kind: 'pregnant', start: '2026-01-01', end: '2026-02-01' }] });
    await importSanguineData(db, store, f, opts());
    const r = await importSanguineData(db, store, f, opts());
    expect(r.added).toBe(0);
    expect(await db.all('SELECT until_day FROM life_state')).toEqual([{ until_day: '2026-02-01' }]);
  });
  it('explicit no-flow days keep two periods apart through the round trip', async () => {
    for (const [day, level] of [['2026-09-01', 'medium'], ['2026-09-03', 'none'], ['2026-09-04', 'none'], ['2026-09-06', 'medium']]) await store.append({ kind: 'flow', payload: { day, level, flow_kind: 'period' } });
    const before = await db.all('SELECT start_day, end_day FROM cycle ORDER BY start_day');
    expect(before).toHaveLength(2);
    const { problems, db2 } = await rt();
    expect(problems).toEqual([]);
    expect(await db2.all('SELECT start_day, end_day FROM cycle ORDER BY start_day')).toEqual(before);
  });
  it('a no-flow day that also carries a symptom keeps both', async () => {
    await store.append({ kind: 'flow', payload: { day: '2026-09-03', level: 'none', flow_kind: 'period' } });
    await store.append({ kind: 'symptom', payload: { day: '2026-09-03', code: 'cramps', intensity: 2 } });
    const { db2 } = await rt();
    expect(await db2.get('SELECT flow, symptoms FROM daily_log')).toEqual(await db.get('SELECT flow, symptoms FROM daily_log'));
  });
  it('the latest merge answer for a period start wins, in the export and after import', async () => {
    await store.append({ kind: 'period.start', payload: { day: '2026-09-01' } });
    await store.append({ kind: 'period.start', payload: { day: '2026-09-04', merge: false } });
    await store.append({ kind: 'period.start', payload: { day: '2026-09-04', merge: true } });
    await store.append({ kind: 'period.start', payload: { day: '2026-09-04' } }); // no answer: the earlier answer stands
    const before = await db.all('SELECT start_day, end_day FROM cycle ORDER BY start_day');
    const { data, db2 } = await rt();
    expect(data.periodMarks).toEqual([{ day: '2026-09-01', mark: 'start' }, { day: '2026-09-04', mark: 'start', merge: true }]);
    expect(await db2.all('SELECT start_day, end_day FROM cycle ORDER BY start_day')).toEqual(before);
  });
  it('the validator reports a period mark listed twice and keeps the first', () => {
    const { data, problems } = validateSanguineData({ format: 'sanguine-data', version: 1, days: [], periodMarks: [{ day: '2026-09-01', mark: 'start', merge: false }, { day: '2026-09-01', mark: 'start', merge: true }, { day: '2026-09-01', mark: 'end' }] });
    expect(problems).toHaveLength(1);
    expect(data.periodMarks).toEqual([{ day: '2026-09-01', mark: 'start', merge: false }, { day: '2026-09-01', mark: 'end' }]);
  });
});
