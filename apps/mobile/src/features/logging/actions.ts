// Everything the logging sheet and day detail can do, as writes to the event log (PLAN.md §8.4). No UI imports.
import { diffDays, type ISODate, MIN_VALID_LENGTH } from '@sanguine/engine';
import { sealNote } from '@sanguine/crypto';
import type { Database } from '@/data/database';
import type { EventRow, FlowKind, FlowLevel, NewEvent } from '@/data/events';
import type { Clock } from '@/data/ids';
import { activeEvents, PERIOD_JOIN_DAYS } from '@/data/project';
import type { EventStore } from '@/data/store';

export interface DayState {
  flow: FlowLevel | null;
  flowKind: FlowKind | null;
  clots: boolean;
  symptoms: Record<string, number>;
  sex: { protected: boolean } | null;
  hasNote: boolean;
}

export async function dayState(db: Database, day: ISODate): Promise<DayState> {
  const r = await db.get<{ flow: string | null; flow_kind: string | null; clots: number; symptoms: string; sex: string | null; notes_cipher: Uint8Array | null }>('SELECT * FROM daily_log WHERE day = ?', [day]);
  return {
    flow: (r?.flow as FlowLevel | null) ?? null, flowKind: (r?.flow_kind as FlowKind | null) ?? null, clots: Boolean(r?.clots),
    symptoms: Object.fromEntries((JSON.parse(r?.symptoms ?? '[]') as Array<{ code: string; intensity: number }>).map((s) => [s.code, s.intensity])),
    sex: r?.sex ? (JSON.parse(r.sex) as { protected: boolean }) : null, hasNote: Boolean(r?.notes_cipher),
  };
}

export interface PeriodContext {
  /** True when logging a period flow on this day would begin a new period. */
  startsNew: boolean;
  /** The period (by start day) this day would join across a gap of 3 to 7 days, before or after: the sheet asks whether it is the same period (§5.4, D-052). */
  joins?: ISODate;
  /** Within POST_PREGNANCY_BLEED_DAYS after a birth or loss: the sheet defaults to post-pregnancy bleeding, which is not a period (D-053). */
  afterPregnancy?: 'birth' | 'loss';
}

/** §11.1 (D-053): bleeding this soon after a pregnancy is not a period unless the user says so. Birth: lochia up to 6 weeks; loss: 2 weeks. */
export const POST_PREGNANCY_BLEED_DAYS = { birth: 42, loss: 14 } as const;

async function afterPregnancy(db: Database, day: ISODate): Promise<'birth' | 'loss' | undefined> {
  const pp = await db.get<{ from_day: string; detail: string }>("SELECT from_day, detail FROM life_state WHERE kind = 'postpartum' AND from_day <= ? ORDER BY from_day DESC LIMIT 1", [day]);
  if (!pp) return undefined;
  const after = (JSON.parse(pp.detail) as { after?: unknown }).after ?? 'birth'; // states written before P3-12 only ever meant a birth
  return (after === 'birth' || after === 'loss') && diffDays(day, pp.from_day) <= POST_PREGNANCY_BLEED_DAYS[after] ? after : undefined;
}

export async function periodContext(db: Database, day: ISODate): Promise<PeriodContext> {
  const after = await afterPregnancy(db, day);
  const ctx = await periodRunContext(db, day);
  return after ? { ...ctx, afterPregnancy: after } : ctx;
}

async function periodRunContext(db: Database, day: ISODate): Promise<PeriodContext> {
  const cycles = await db.all<{ start_day: string; end_day: string | null }>('SELECT start_day, end_day FROM cycle ORDER BY start_day');
  const covering = cycles.find((c) => c.start_day <= day && day <= (c.end_day ?? c.start_day));
  if (covering) return { startsNew: false };
  // a period day directly after an ongoing period (one missing day allowed) extends it
  const before = [...cycles].reverse().find((c) => c.start_day <= day);
  const gap = before ? diffDays(day, before.end_day ?? before.start_day) : Number.POSITIVE_INFINITY;
  if (before && gap <= 2) return { startsNew: false }; // one missing day: obviously the same period
  if (before && gap <= PERIOD_JOIN_DAYS && diffDays(day, before.start_day) < MIN_VALID_LENGTH) return { startsNew: false, joins: before.start_day };
  const next = cycles.find((c) => c.start_day > day && diffDays(c.start_day, day) <= PERIOD_JOIN_DAYS);
  return next ? { startsNew: true, joins: next.start_day } : { startsNew: true };
}

/** Sets or clears the flow for a day. Tapping the level already set clears it. `splitAt` records the user's answer that a day inside the
 *  join window is a separate period: that day (this one, or the start of the period it would join) begins a new period (D-052). */
export async function setFlow(store: EventStore, day: ISODate, level: FlowLevel, o: { kind?: FlowKind; clots?: boolean; splitAt?: ISODate; mergeAt?: ISODate } = {}): Promise<void> {
  const kind = o.kind ?? 'period';
  // clearing a day also drops a split written on it, or a bleed-less one-day period would remain (a split is itself a period day)
  if (level === 'none') for (const e of await dayEvents(store, day)) if (e.kind === 'period.start' && typeof e.data.merge === 'boolean') await store.retract(e.id);
  const events: NewEvent[] = [{ kind: 'flow', payload: { day, level, flow_kind: kind, ...(o.clots ? { clots: true } : {}) } }];
  if (o.splitAt && kind === 'period' && level !== 'none' && level !== 'spotting') events.unshift({ kind: 'period.start', payload: { day: o.splitAt, merge: false } });
  else if (o.mergeAt && kind === 'period' && level !== 'none' && level !== 'spotting') events.unshift({ kind: 'period.start', payload: { day: o.mergeAt, merge: true } });
  await store.appendMany(events);
}

export async function setSymptom(store: EventStore, day: ISODate, code: string, intensity: 0 | 1 | 2 | 3): Promise<void> {
  await store.append({ kind: 'symptom', payload: { day, code, intensity } });
}

export type DayEvent = EventRow & { data: Record<string, unknown> };
const SHOWN = new Set(['flow', 'symptom', 'biomarker', 'sex', 'note', 'period.start', 'period.end']);

/** Active (not retracted) events about a day, newest last, for the day detail list. */
export async function dayEvents(store: EventStore, day: ISODate): Promise<DayEvent[]> {
  return activeEvents(await store.events())
    .filter((e) => e.effective_day === day && SHOWN.has(e.kind))
    .map((e) => ({ ...e, data: JSON.parse(e.payload) as Record<string, unknown> }));
}

/** One biomarker of a type per day: earlier ones are retracted, then the new one is written. */
async function replaceBiomarker(store: EventStore, day: ISODate, type: string, payload: Record<string, unknown>): Promise<void> {
  const old = (await dayEvents(store, day)).filter((e) => e.kind === 'biomarker' && e.data.type === type);
  for (const e of old) await store.retract(e.id);
  await store.append({ kind: 'biomarker', payload: { day, type, ...payload } });
}

export const toC = (v: number, unit: 'C' | 'F'): number => (unit === 'F' ? ((v - 32) * 5) / 9 : v);
export const fromC = (v: number, unit: 'C' | 'F'): number => (unit === 'F' ? (v * 9) / 5 + 32 : v);

/** Temperatures are stored in °C; the unit is a display preference. */
export async function saveTemperature(store: EventStore, day: ISODate, o: { valueC: number; time?: string | undefined; source: string; disturbed?: boolean; wearable?: boolean }): Promise<void> {
  if (!Number.isFinite(o.valueC)) throw new Error('temperature must be a number');
  await replaceBiomarker(store, day, o.wearable ? 'skin_temp' : 'bbt', {
    value: { valueC: Math.round(o.valueC * 100) / 100 }, source: o.source, ...(o.time ? { measured_at: `${day}T${o.time}:00` } : {}), ...(o.disturbed ? { disturbed: true } : {}),
  });
}
export const saveLh = (store: EventStore, day: ISODate, result: string) => replaceBiomarker(store, day, 'lh', { value: { result }, source: 'strip' });
export const saveMucus = (store: EventStore, day: ISODate, quality: string) => replaceBiomarker(store, day, 'mucus', { value: { quality }, source: 'app' });
export const saveCervix = (store: EventStore, day: ISODate, v: { position: string; firmness: string; opening: string }) => replaceBiomarker(store, day, 'cervix', { value: v, source: 'app' });
export const setSex = (store: EventStore, day: ISODate, protectedSex: boolean) => store.append({ kind: 'sex', payload: { day, protected: protectedSex } });

export async function saveNote(store: EventStore, day: ISODate, text: string, noteKey: Uint8Array, clock: Clock): Promise<void> {
  await store.append({ kind: 'note', payload: { day, cipher: sealNote(noteKey, text, (n) => clock.randomBytes(n)) } });
}

/** "Not a period": keep the bleeding but record it as bleeding between periods. */
export async function markNotAPeriod(store: EventStore, db: Database, day: ISODate): Promise<void> {
  const s = await dayState(db, day);
  await store.append({ kind: 'flow', payload: { day, level: s.flow && s.flow !== 'none' ? s.flow : 'light', flow_kind: 'intermenstrual' } });
}
/** "Mark as spotting": keep it as period-kind bleeding but too light to count as a period day. */
export async function markSpotting(store: EventStore, day: ISODate): Promise<void> {
  await store.append({ kind: 'flow', payload: { day, level: 'spotting', flow_kind: 'period' } });
}
