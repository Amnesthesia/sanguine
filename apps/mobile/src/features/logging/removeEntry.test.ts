import { afterEach, beforeEach, expect, it } from 'vitest';
import type { Database } from '@/data/database';
import type { Clock } from '@/data/ids';
import { migrate } from '@/data/migrate';
import { activeEvents } from '@/data/project';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { dayEvents, dayState, saveTemperature, setEnergy, setFlow, setSymptom, type DayEvent } from './actions';
import { removeEntry, undoRemoval, visibleEntries } from './removeEntry';

let n = 0;
const clock: Clock = { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) };
const day = '2026-10-10';
let db: Database;
let store: EventStore;
beforeEach(async () => { db = openTestDb(); await migrate(db); store = new EventStore(db, clock); });
afterEach(async () => { await db.close(); });
const entries = async () => visibleEntries(await dayEvents(store, day));
const entry = async (kind: string) => {
  const found = (await dayEvents(store, day)).find((e) => e.kind === kind);
  expect(found).toBeDefined();
  return found as DayEvent;
};

it('removing flow hides its chip', async () => {
  await setFlow(store, day, 'light');
  await setFlow(store, day, 'heavy', { kind: 'intermenstrual' });
  const original = await entry('flow');
  const latest = (await dayEvents(store, day)).filter((e) => e.kind === 'flow').at(-1)!;
  expect(await entries()).toEqual([latest]);
  const written = await removeEntry(store, db, latest);
  expect((await entries()).filter((e) => e.kind === 'flow')).toEqual([]);
  expect((await dayState(db, day)).flowKind).toBe('intermenstrual');
  await undoRemoval(store, written);
  expect(await entries()).toEqual([latest]);
  expect((await dayEvents(store, day)).some((e) => e.id === original.id)).toBe(true);
});

it('removes a symptom and undo restores it', async () => {
  await setSymptom(store, day, 'cramps', 2);
  await setSymptom(store, day, 'headache', 1);
  const before = await entries();
  const written = await removeEntry(store, db, await entry('symptom'));
  expect((await dayState(db, day)).symptoms).toEqual({ headache: 1 });
  await undoRemoval(store, written);
  expect(await entries()).toEqual(before);
  expect((await dayState(db, day)).symptoms).toEqual({ cramps: 2, headache: 1 });
});

it('removing energy then undo', async () => {
  await setEnergy(store, day, 4);
  const before = await entries();
  const written = await removeEntry(store, db, await entry('energy'));
  expect(await entries()).toEqual([]);
  expect((await dayState(db, day)).energy).toBeNull();
  await undoRemoval(store, written);
  expect(await entries()).toEqual(before);
  expect((await dayState(db, day)).energy).toBe(4);
});

it('undo after removing a cycle-start flow restores cycles and join answers', async () => {
  await setFlow(store, '2026-10-05', 'medium');
  await setFlow(store, day, 'medium', { splitAt: day, askedOn: day });
  const cycles = () => db.all('SELECT * FROM cycle ORDER BY start_day');
  const starts = async () => activeEvents(await store.events()).filter((e) => e.kind === 'period.start');
  const beforeCycles = await cycles();
  const beforeStarts = await starts();
  expect(beforeCycles).toHaveLength(2);
  expect(beforeStarts).toHaveLength(1);
  expect(JSON.parse(beforeStarts[0]!.payload)).toEqual({ day, merge: false, asked_on: day });
  const written = await removeEntry(store, db, await entry('flow'));
  expect(await cycles()).not.toEqual(beforeCycles);
  expect(await cycles()).toHaveLength(1);
  expect(await starts()).toEqual([]);
  expect(written.map((e) => e.kind)).toEqual(['retract', 'flow']);
  await undoRemoval(store, written);
  expect(await cycles()).toEqual(beforeCycles);
  expect(await starts()).toEqual(beforeStarts);
});

it('retracts a temperature and undo restores it', async () => {
  await saveTemperature(store, day, { valueC: 36.5, source: 'oral' });
  const before = await entries();
  const biomarkers = await db.all('SELECT * FROM biomarker');
  const log = await store.events();
  const written = await removeEntry(store, db, await entry('biomarker'));
  expect(written.map((e) => e.kind)).toEqual(['retract']);
  expect(await entries()).toEqual([]);
  expect(await db.all('SELECT * FROM biomarker')).toEqual([]);
  await undoRemoval(store, written);
  expect(await entries()).toEqual(before);
  expect(await db.all('SELECT * FROM biomarker')).toEqual(biomarkers);
  expect((await store.events()).slice(0, log.length)).toEqual(log);
});
