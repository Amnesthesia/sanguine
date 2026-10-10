import { addDays, type CycleRecord, type ISODate } from '@sanguine/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '@/data/database';
import type { Clock } from '@/data/ids';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { setFlow } from '@/features/logging/actions';
import { answeredShortCycles, keepAsPeriod, notAPeriod, shortCycleQuestion } from './shortCycle';

// closed cycles of the given lengths, then the open one
function records(first: ISODate, lens: number[]): CycleRecord[] {
  let s = first;
  const out = lens.map((len, i) => { const c = { id: `c${i}`, start: s, nextStart: addDays(s, len), length: len, quality: 'valid' } as CycleRecord; s = addDays(s, len); return c; });
  return [...out, { id: 'open', start: s, end: addDays(s, 2), quality: 'valid' } as CycleRecord];
}
const usual = records('2026-05-01', [28, 29, 28, 17]); // 17 days after a run of 28s: the last bleed was probably not a period
const opened = usual.at(-1)?.start as ISODate;

describe('shortCycleQuestion (P8-13 item 5, D-094)', () => {
  it('asks about the bleeding that closed a cycle far shorter than hers', () =>
    expect(shortCycleQuestion(usual, addDays(opened, 2), [])).toEqual({ start: opened, end: addDays(opened, 2), length: 17 }));
  it('does not ask once answered, after a week, or before it started', () => {
    expect(shortCycleQuestion(usual, addDays(opened, 2), [opened])).toBeUndefined();
    expect(shortCycleQuestion(usual, addDays(opened, 2), [addDays(opened, -3)])).toBeUndefined(); // bleeding that went on after a no
    expect(shortCycleQuestion(usual, addDays(opened, 7), [])).toBeUndefined();
    expect(shortCycleQuestion(usual, addDays(opened, -1), [])).toBeUndefined();
  });
  it('does not ask for an ordinary cycle, a short cycle for a user whose cycles are short anyway, or without three cycles to compare', () => {
    expect(shortCycleQuestion(records('2026-05-01', [28, 29, 28, 26]), opened, [])).toBeUndefined();
    const shortUser = records('2026-05-01', [22, 21, 23, 19]);
    expect(shortCycleQuestion(shortUser, shortUser.at(-1)?.start as ISODate, [])).toBeUndefined(); // 19 is not 7 below 22
    const few = records('2026-05-01', [28, 28, 17]);
    expect(shortCycleQuestion(few, few.at(-1)?.start as ISODate, [])).toBeUndefined();
  });
});

describe('answering', () => {
  let n = 0;
  const clock: Clock = { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) };
  let db: Database;
  let store: EventStore;
  beforeEach(async () => { db = openTestDb(); await migrate(db); store = new EventStore(db, clock); });
  const starts = async () => (await db.all<{ start_day: string }>('SELECT start_day FROM cycle ORDER BY start_day')).map((r) => r.start_day);

  it('"not a period": every bleeding day becomes bleeding between periods, the cycle start goes, and it is not asked again', async () => {
    await setFlow(store, '2026-09-10', 'medium');
    for (const d of ['2026-09-27', '2026-09-28', '2026-09-29']) await setFlow(store, d, 'light');
    await notAPeriod(store, db, { start: '2026-09-27', end: '2026-09-29', length: 17 });
    expect(await starts()).toEqual(['2026-09-10']);
    expect(await answeredShortCycles(db)).toEqual(['2026-09-27']);
  });
  it('"it was a period": nothing changes but the answer is kept', async () => {
    await setFlow(store, '2026-09-10', 'medium');
    await setFlow(store, '2026-09-27', 'light');
    await keepAsPeriod(db, { start: '2026-09-27', end: '2026-09-27', length: 17 });
    expect(await starts()).toEqual(['2026-09-10', '2026-09-27']);
    expect(await answeredShortCycles(db)).toEqual(['2026-09-27']);
  });
});
