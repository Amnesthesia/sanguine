import { beforeEach, describe, expect, it } from 'vitest';
import { openNote } from '@sanguine/crypto';
import type { Database } from '@/data/database';
import type { Clock } from '@/data/ids';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { dayEvents, dayState, fromC, markNotAPeriod, markSpotting, periodContext, saveCervix, saveLh, saveMucus, saveNote, saveTemperature, setFlow, setSex, setSymptom, toC } from './actions';

let n = 0;
const clock: Clock = { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) };
let db: Database;
let store: EventStore;
beforeEach(async () => { db = openTestDb(); await migrate(db); store = new EventStore(db, clock); });
const cycles = () => db.all<{ start_day: string; end_day: string }>('SELECT start_day, end_day FROM cycle ORDER BY start_day');

describe('period logging: two taps (§8.4)', () => {
  it('one flow write on a day with no open period starts a new period', async () => {
    expect(await periodContext(db, '2026-10-10')).toEqual({ startsNew: true });
    await setFlow(store, '2026-10-10', 'medium');
    expect(await cycles()).toEqual([{ start_day: '2026-10-10', end_day: '2026-10-10' }]);
    expect((await dayState(db, '2026-10-10')).flow).toBe('medium');
  });
  it('the next day of the same period is not a new period', async () => {
    await setFlow(store, '2026-10-10', 'medium');
    expect(await periodContext(db, '2026-10-11')).toEqual({ startsNew: false });
    expect(await periodContext(db, '2026-10-10')).toEqual({ startsNew: false });
    expect(await periodContext(db, '2026-10-12')).toEqual({ startsNew: false }); // one missing day: same period, nothing to ask
    expect(await periodContext(db, '2026-10-13')).toEqual({ startsNew: false, joins: '2026-10-10' }); // up to 7 days: joins, the sheet asks
    expect(await periodContext(db, '2026-10-17')).toEqual({ startsNew: false, joins: '2026-10-10' });
    expect(await periodContext(db, '2026-10-18')).toEqual({ startsNew: true });
  });
  it('a day up to 7 days before a period joins it and becomes its start', async () => {
    await setFlow(store, '2026-10-10', 'medium');
    expect(await periodContext(db, '2026-10-05')).toEqual({ startsNew: true, joins: '2026-10-10' });
    expect(await periodContext(db, '2026-10-02')).toEqual({ startsNew: true }); // 8 days
    await setFlow(store, '2026-10-05', 'medium');
    expect(await cycles()).toEqual([{ start_day: '2026-10-05', end_day: '2026-10-10' }]);
  });
  it('splitAt keeps a joining day as its own period, before or after', async () => {
    await setFlow(store, '2026-09-01', 'medium');
    await setFlow(store, '2026-09-03', 'light');
    await setFlow(store, '2026-09-08', 'medium', { splitAt: '2026-09-08' });
    expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-01', '2026-09-08']);
    await setFlow(store, '2026-08-27', 'medium', { splitAt: '2026-09-01' });
    expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-08-27', '2026-09-01', '2026-09-08']);
  });
  it('no prompt when the join would make the run 15 days or longer', async () => {
    for (const d of ['2026-10-01', '2026-10-05', '2026-10-11']) await setFlow(store, d, 'medium');
    expect(await periodContext(db, '2026-10-17')).toEqual({ startsNew: true });
  });
  it('"Same period" holds even after two cleared days in the gap (mergeAt writes merge:true)', async () => {
    for (const d of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']) await setFlow(store, d, 'medium');
    await setFlow(store, '2026-10-04', 'none');
    await setFlow(store, '2026-10-05', 'none');
    expect(await periodContext(db, '2026-10-08')).toEqual({ startsNew: false, joins: '2026-10-01' });
    await setFlow(store, '2026-10-08', 'light', { mergeAt: '2026-10-08' });
    expect(await cycles()).toEqual([{ start_day: '2026-10-01', end_day: '2026-10-08' }]);
    await setFlow(store, '2026-10-08', 'none'); // clearing drops the answer with the day
    expect(await cycles()).toEqual([{ start_day: '2026-10-01', end_day: '2026-10-03' }]);
  });
  it('clearing the flow on a split day retracts the split', async () => {
    await setFlow(store, '2026-09-01', 'medium');
    await setFlow(store, '2026-09-05', 'medium', { splitAt: '2026-09-05' });
    await setFlow(store, '2026-09-05', 'none');
    expect(await cycles()).toEqual([{ start_day: '2026-09-01', end_day: '2026-09-01' }]);
  });
  it('tapping the same level again is a clear: write level none', async () => {
    await setFlow(store, '2026-10-10', 'medium');
    await setFlow(store, '2026-10-10', 'none');
    expect(await cycles()).toEqual([]);
  });
  it('withdrawal bleeds never start a cycle', async () => {
    await setFlow(store, '2026-10-10', 'medium', { kind: 'withdrawal_bleed' });
    expect(await cycles()).toEqual([]);
    expect((await dayState(db, '2026-10-10')).flowKind).toBe('withdrawal_bleed');
  });
  it('clots are kept with the flow', async () => {
    await setFlow(store, '2026-10-10', 'heavy', { clots: true });
    expect((await dayState(db, '2026-10-10')).clots).toBe(true);
  });
});

describe('symptoms: two taps', () => {
  it('sets, changes and clears intensity; never touches cycles', async () => {
    await setSymptom(store, '2026-10-10', 'cramps', 2);
    await setSymptom(store, '2026-10-10', 'headache', 1);
    expect((await dayState(db, '2026-10-10')).symptoms).toEqual({ cramps: 2, headache: 1 });
    await setSymptom(store, '2026-10-10', 'cramps', 3);
    await setSymptom(store, '2026-10-10', 'headache', 0);
    expect((await dayState(db, '2026-10-10')).symptoms).toEqual({ cramps: 3 });
    expect(await cycles()).toEqual([]);
  });
});

describe('biomarkers: one per type per day', () => {
  it('a temperature is stored in °C and replaces the earlier one the same day', async () => {
    await saveTemperature(store, '2026-10-10', { valueC: 36.4, time: '06:40', source: 'oral' });
    await saveTemperature(store, '2026-10-10', { valueC: 36.55, time: '06:45', source: 'oral' });
    const rows = await db.all<{ value: string; measured_at: string }>('SELECT value, measured_at FROM biomarker');
    expect(rows).toEqual([{ value: '{"valueC":36.55}', measured_at: '2026-10-10T06:45:00' }]);
    expect((await store.events()).filter((e) => e.kind === 'retract')).toHaveLength(1); // the old one is retracted, never edited
  });
  it('wearable temperatures go to their own type; disturbed readings are flagged', async () => {
    await saveTemperature(store, '2026-10-10', { valueC: 36.1, source: 'wrist', wearable: true });
    await saveTemperature(store, '2026-10-10', { valueC: 36.4, source: 'oral', disturbed: true });
    expect(await db.all('SELECT type, disturbed FROM biomarker ORDER BY type')).toEqual([{ type: 'bbt', disturbed: 1 }, { type: 'skin_temp', disturbed: 0 }]);
  });
  it('rejects a non-number', async () => {
    await expect(saveTemperature(store, '2026-10-10', { valueC: Number.NaN, source: 'oral' })).rejects.toThrow();
  });
  it('°F is converted on the way in and out', () => {
    expect(toC(97.7, 'F')).toBeCloseTo(36.5, 6);
    expect(fromC(36.5, 'F')).toBeCloseTo(97.7, 6);
    expect(toC(36.5, 'C')).toBe(36.5);
  });
  it('LH, mucus and cervix replace per day', async () => {
    await saveLh(store, '2026-10-12', 'negative');
    await saveLh(store, '2026-10-12', 'positive');
    await saveMucus(store, '2026-10-12', 'eggwhite');
    await saveCervix(store, '2026-10-12', { position: 'high', firmness: 'soft', opening: 'open' });
    expect(await db.all('SELECT type, value FROM biomarker ORDER BY type')).toEqual([
      { type: 'cervix', value: '{"position":"high","firmness":"soft","opening":"open"}' }, { type: 'lh', value: '{"result":"positive"}' }, { type: 'mucus', value: '{"quality":"eggwhite"}' }]);
  });
});

describe('sex and notes', () => {
  it('sex is stored as condom used yes/no', async () => {
    await setSex(store, '2026-10-10', true);
    expect((await dayState(db, '2026-10-10')).sex).toEqual({ protected: true });
  });
  it('a note is encrypted before it reaches the log', async () => {
    const key = Uint8Array.from({ length: 32 }, (_, i) => i);
    await saveNote(store, '2026-10-10', 'private words', key, clock);
    const ev = (await store.events()).find((e) => e.kind === 'note');
    expect(ev?.payload).not.toContain('private');
    const cipher = (JSON.parse(ev?.payload ?? '{}') as { cipher: string }).cipher;
    expect(openNote(key, cipher)).toBe('private words');
    expect((await dayState(db, '2026-10-10')).hasNote).toBe(true);
  });
});

describe('day detail corrections', () => {
  it('lists active events and drops retracted ones', async () => {
    await setFlow(store, '2026-10-10', 'medium');
    await setSymptom(store, '2026-10-10', 'cramps', 2);
    const before = await dayEvents(store, '2026-10-10');
    expect(before.map((e) => e.kind)).toEqual(['flow', 'symptom']);
    await store.retract(before[1]?.id as string);
    expect((await dayEvents(store, '2026-10-10')).map((e) => e.kind)).toEqual(['flow']);
    expect((await dayEvents(store, '2026-10-11'))).toEqual([]);
  });
  it('"not a period" keeps the bleeding as intermenstrual and removes the cycle', async () => {
    await setFlow(store, '2026-10-10', 'medium');
    await markNotAPeriod(store, db, '2026-10-10');
    expect(await cycles()).toEqual([]);
    expect(await dayState(db, '2026-10-10')).toMatchObject({ flow: 'medium', flowKind: 'intermenstrual' });
  });
  it('"mark as spotting" keeps the day but it no longer counts as a period day', async () => {
    await setFlow(store, '2026-10-10', 'medium');
    await markSpotting(store, '2026-10-10');
    expect(await cycles()).toEqual([]);
    expect((await dayState(db, '2026-10-10')).flow).toBe('spotting');
  });
  it('events carry their provenance for the chips', async () => {
    await store.append({ kind: 'flow', payload: { day: '2026-10-10', level: 'light', flow_kind: 'period' }, provenance: 'imported', source_app: 'csv' });
    const [e] = await dayEvents(store, '2026-10-10');
    expect([e?.provenance, e?.source_app]).toEqual(['imported', 'csv']);
  });
});

describe('bleeding after a pregnancy (P3-12, D-053)', () => {
  const lossOn = (day: string) => store.appendMany([
    { kind: 'life_state.set', payload: { kind: 'pregnant', detail: {}, day: '2026-01-10' } },
    { kind: 'life_state.end', payload: { kind: 'pregnant', day, outcome: 'loss' } },
    { kind: 'life_state.set', payload: { kind: 'postpartum', detail: { breastfeeding: false, after: 'loss' }, day } },
  ]);
  it('within 14 days of a loss the sheet is told, so it can default to post-pregnancy bleeding', async () => {
    await lossOn('2026-03-01');
    expect((await periodContext(db, '2026-03-05')).afterPregnancy).toBe('loss');
    expect((await periodContext(db, '2026-03-15')).afterPregnancy).toBe('loss');
    expect((await periodContext(db, '2026-03-16')).afterPregnancy).toBeUndefined();
    expect((await periodContext(db, '2026-02-20')).afterPregnancy).toBeUndefined();
  });
  it('within 42 days of a birth', async () => {
    await store.append({ kind: 'life_state.set', payload: { kind: 'postpartum', detail: { breastfeeding: true, after: 'birth' }, day: '2026-08-01' } });
    expect((await periodContext(db, '2026-09-12')).afterPregnancy).toBe('birth');
    expect((await periodContext(db, '2026-09-13')).afterPregnancy).toBeUndefined();
  });
  it('a postpartum state from before P3-12 has no outcome and counts as a birth', async () => {
    await store.append({ kind: 'life_state.set', payload: { kind: 'postpartum', detail: { breastfeeding: false }, day: '2026-08-01' } });
    expect((await periodContext(db, '2026-09-01')).afterPregnancy).toBe('birth');
  });
  it('post-pregnancy bleeding never starts a cycle; choosing "My period" does', async () => {
    await lossOn('2026-03-01');
    await setFlow(store, '2026-03-05', 'heavy', { kind: 'post_pregnancy' });
    expect(await cycles()).toEqual([]);
    await setFlow(store, '2026-03-05', 'heavy', { kind: 'period' });
    expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-03-05']);
  });
});
