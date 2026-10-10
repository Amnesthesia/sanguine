// P8-13 item 5 (D-094): a cycle much shorter than hers usually means bleeding between periods was logged as a period. Today
// asks once, with the day-detail actions as answers; nothing is set aside without her answer, since a real short cycle stays.
import { addDays, diffDays, type CycleRecord, type ISODate } from '@sanguine/engine';
import type { Database } from '@/data/database';
import type { EventStore } from '@/data/store';
import { getSetting, setSetting } from '@/data/settings';
import { dayState, markNotAPeriod } from '@/features/logging/actions';

/** §11.1-style constants: under 21 days (FIGO 2018 lower bound of normal) and at least 7 days below her median. */
export const SHORT_CYCLE_MAX_DAYS = 20;
export const SHORT_CYCLE_BELOW_MEDIAN = 7;
const ASK_FOR_DAYS = 7; // asked only while the bleeding that ended the short cycle is recent
const MIN_USUAL = 3; // closed cycles needed to know her usual length
const ANSWERED = 'shortCycleAnswered';

export interface ShortCycleQuestion { start: ISODate; end: ISODate; length: number }

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2; };

/** The latest period start, when the cycle it closed is suspiciously short and she has not answered for it. `records` from analyzeCycles. */
export function shortCycleQuestion(records: CycleRecord[], today: ISODate, answered: ISODate[]): ShortCycleQuestion | undefined {
  const open = records.at(-1);
  const closed = records.at(-2);
  if (!open || !closed || closed.length === undefined) return undefined;
  // answered for this bleed: bleeding logged in the days after a "not a period" answer starts a new run, not a new question
  if (answered.some((a) => open.start >= a && diffDays(open.start, a) < ASK_FOR_DAYS)) return undefined;
  if (diffDays(today, open.start) >= ASK_FOR_DAYS || today < open.start) return undefined;
  const usual = records.slice(0, -2).filter((c) => c.quality === 'valid' && c.length !== undefined).map((c) => c.length as number);
  if (usual.length < MIN_USUAL) return undefined;
  const short = closed.length <= SHORT_CYCLE_MAX_DAYS && closed.length <= median(usual) - SHORT_CYCLE_BELOW_MEDIAN;
  return short ? { start: open.start, end: open.end ?? open.start, length: closed.length } : undefined;
}

export const answeredShortCycles = (db: Database) => getSetting<ISODate[]>(db, ANSWERED, []);
const remember = async (db: Database, start: ISODate) => setSetting(db, ANSWERED, [...(await answeredShortCycles(db)), start]);

/** "It was a period": keep it, do not ask again. */
export const keepAsPeriod = (db: Database, q: ShortCycleQuestion) => remember(db, q.start);

/** "It was not a period": every bleeding day of it becomes bleeding between periods (the day-detail action, day by day). */
export async function notAPeriod(store: EventStore, db: Database, q: ShortCycleQuestion): Promise<void> {
  for (let d = q.start; d <= q.end; d = addDays(d, 1)) {
    const s = await dayState(db, d);
    if (s.flow && s.flow !== 'none') await markNotAPeriod(store, db, d);
  }
  await remember(db, q.start);
}
