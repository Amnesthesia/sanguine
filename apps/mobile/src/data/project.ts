// Pure projection of the event log (PLAN.md §5.3-5.4). Same events in, same rows out, in any input order.
import {
  addDays, analyzeCycles, MIN_VALID_LENGTH, RECENCY_LAMBDA, diffDays,
  type CervixObs, type CycleRecord, type DailyLog, type EngineSettings, type History, type ISODate, type LhTest, type LifeState,
  type MucusObs, type TemperatureReading,
} from '@sanguine/engine';
import type { EventRow } from './events';

export interface Profile { birthYear?: number; birthDate?: string; menarcheYear?: number; recencyLambda?: number; window?: number; usualCycleLength?: number }

export interface CycleRow {
  id: string; start_day: ISODate; end_day: ISODate | null; next_start: ISODate | null; length_days: number | null; bleed_days: number | null;
  quality: CycleRecord['quality']; ov_day: ISODate | null; ov_sd: number | null; ov_basis: string | null; luteal_days: number | null;
}
export interface DailyLogRow {
  day: ISODate; flow: string | null; flow_kind: string | null; clots: number; symptoms: string; sex: string | null;
  notes_cipher: Uint8Array | null; updated_event: string;
}
export interface BiomarkerRow {
  id: string; day: ISODate; type: string; value: string; measured_at: string | null; source: string; provenance: string; disturbed: number; event_id: string;
}
export interface LifeStateRow { id: string; kind: string; detail: string; from_day: ISODate; until_day: ISODate | null; event_id: string }
export interface Projection { cycles: CycleRow[]; dailyLog: DailyLogRow[]; biomarkers: BiomarkerRow[]; lifeStates: LifeStateRow[]; history: History; settings: EngineSettings }

const byOrder = (a: EventRow, b: EventRow) => a.lamport - b.lamport || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** §5.4 (D-052): period days up to 7 days apart are one period, as long as the joined run stays shorter than MIN_VALID_LENGTH (15 d).
 *  A cycle shorter than that is never valid, so a join can only remove fragments the engine would discard, never a real cycle start;
 *  continuous bleeding (gaps of one missing day) is never cut. A user who knows better splits with period.start { merge: false }. */
export const PERIOD_JOIN_DAYS = 7;
const PERIOD_GAP_DAYS = 2; // one missing day: always the same run
/** Explicit "no flow" days inside the gap: one is tolerated (a mistaken day cleared), two or more mean the user said the bleeding stopped. */
export const PERIOD_JOIN_NONE_MAX = 1;

/** Events that have not been retracted, in log order. A retract can itself be retracted, which restores its target. */
export function activeEvents(events: EventRow[]): EventRow[] {
  const sorted = [...events].sort(byOrder);
  const retractedBy = new Map<string, EventRow[]>();
  for (const e of sorted) if (e.retracts) retractedBy.set(e.retracts, [...(retractedBy.get(e.retracts) ?? []), e]);
  const status = new Map<string, boolean>();
  for (let i = sorted.length - 1; i >= 0; i--) {
    const e = sorted[i] as EventRow;
    status.set(e.id, !(retractedBy.get(e.id) ?? []).some((r) => status.get(r.id)));
  }
  return sorted.filter((e) => status.get(e.id));
}

const parse = (e: EventRow): Record<string, unknown> => JSON.parse(e.payload) as Record<string, unknown>;
const HHMM = /T(\d{2}:\d{2})/;

function lifeStateOf(r: LifeStateRow): LifeState & { until?: ISODate } {
  const d = JSON.parse(r.detail) as Record<string, unknown>;
  const until = r.until_day ? { until: r.until_day } : {};
  switch (r.kind) {
    case 'hormonal_contraception': return { kind: 'hormonal_contraception', method: (d.method as never) ?? 'combined_pill', since: r.from_day, ...until };
    case 'post_contraception': return { kind: 'post_contraception', stopped: r.from_day, method: String(d.method ?? ''), ...until };
    case 'pregnant': return { kind: 'pregnant', since: r.from_day, ...until };
    case 'postpartum': return { kind: 'postpartum', delivered: r.from_day, breastfeeding: Boolean(d.breastfeeding), ...until };
    case 'perimenopause': return { kind: 'perimenopause', since: r.from_day, ...until };
    default: return { kind: 'known_irregular', reason: d.reason === 'pcos' ? 'pcos' : 'other', since: r.from_day, ...until };
  }
}

export function project(events: EventRow[], profile: Profile = {}): Projection {
  const active = activeEvents(events);

  // ---- daily log ----
  type Day = { flow: string | null; flow_kind: string | null; clots: boolean; symptoms: Map<string, number>; sex: { protected: boolean } | null; note: string | null; last: string };
  const days = new Map<ISODate, Day>();
  const day = (d: ISODate, id: string): Day => {
    const x = days.get(d) ?? { flow: null, flow_kind: null, clots: false, symptoms: new Map(), sex: null, note: null, last: id };
    x.last = id;
    days.set(d, x);
    return x;
  };
  const periodStarts = new Set<ISODate>();
  const splitStarts = new Set<ISODate>(); // user-confirmed: this day begins a new period even inside the join window
  const joinStarts = new Set<ISODate>(); // user-confirmed: this day belongs to the run before it, even across cleared days
  const periodEnds: ISODate[] = [];
  const excluded: ISODate[] = [];
  const confirmedLong: ISODate[] = [];
  const biomarkers: BiomarkerRow[] = [];
  const lifeStates: LifeStateRow[] = [];

  for (const e of active) {
    const p = parse(e);
    switch (e.kind) {
      case 'flow': { const x = day(e.effective_day, e.id); x.flow = p.level as string; x.flow_kind = p.flow_kind as string; x.clots = p.clots === true; break; }
      case 'symptom': { const x = day(e.effective_day, e.id); if (p.intensity === 0) x.symptoms.delete(p.code as string); else x.symptoms.set(p.code as string, p.intensity as number); break; }
      case 'sex': day(e.effective_day, e.id).sex = { protected: p.protected as boolean }; break;
      case 'note': day(e.effective_day, e.id).note = p.cipher as string; break;
      case 'period.start': periodStarts.add(e.effective_day); if (p.merge === false) splitStarts.add(e.effective_day); else if (p.merge === true) joinStarts.add(e.effective_day); break;
      case 'period.end': periodEnds.push(e.effective_day); break;
      case 'cycle.exclude': excluded.push(p.cycle_start as ISODate); break;
      case 'cycle.confirm_long': confirmedLong.push(p.cycle_start as ISODate); break;
      case 'biomarker':
        biomarkers.push({
          id: e.id, day: e.effective_day, type: p.type as string, value: JSON.stringify(p.value), measured_at: (p.measured_at as string | undefined) ?? null,
          source: p.source as string, provenance: e.provenance, disturbed: p.disturbed === true ? 1 : 0, event_id: e.id,
        });
        break;
      case 'life_state.set':
        lifeStates.push({ id: e.id, kind: p.kind as string, detail: JSON.stringify(p.detail), from_day: e.effective_day, until_day: null, event_id: e.id });
        break;
      case 'life_state.end': {
        const open = [...lifeStates].reverse().find((s) => s.kind === p.kind && s.until_day === null);
        if (open) open.until_day = e.effective_day;
        break;
      }
      default: break; // retract, import.batch: no projection of their own
    }
  }

  const dailyLog: DailyLogRow[] = [...days.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([d, x]) => ({
    day: d, flow: x.flow, flow_kind: x.flow_kind, clots: x.clots ? 1 : 0,
    symptoms: JSON.stringify([...x.symptoms.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([code, intensity]) => ({ code, intensity }))),
    sex: x.sex ? JSON.stringify(x.sex) : null, notes_cipher: x.note === null ? null : new TextEncoder().encode(x.note), updated_event: x.last,
  }));

  // ---- period runs -> cycles ----
  const periodDays = new Set<ISODate>(periodStarts);
  for (const r of dailyLog) if (r.flow_kind === 'period' && (r.flow === 'light' || r.flow === 'medium' || r.flow === 'heavy')) periodDays.add(r.day);
  const sortedDays = [...periodDays].sort();
  const runs: Array<{ start: ISODate; end: ISODate }> = [];
  const noneDays = new Set(dailyLog.filter((r) => r.flow === 'none').map((r) => r.day));
  const explicitNones = (from: ISODate, to: ISODate): number => {
    let n = 0;
    for (let d = addDays(from, 1); d < to; d = addDays(d, 1)) if (noneDays.has(d)) n++;
    return n;
  };
  for (const d of sortedDays) {
    const last = runs.at(-1);
    const gap = last ? diffDays(d, last.end) : Number.POSITIVE_INFINITY;
    const gapJoin = last !== undefined && gap <= PERIOD_JOIN_DAYS && diffDays(d, last.start) < MIN_VALID_LENGTH && (joinStarts.has(d) || explicitNones(last.end, d) <= PERIOD_JOIN_NONE_MAX);
    if (last && !splitStarts.has(d) && (gap <= PERIOD_GAP_DAYS || gapJoin)) last.end = d;
    else runs.push({ start: d, end: d });
  }
  runs.forEach((r, i) => {
    const next = runs[i + 1]?.start;
    const override = periodEnds.filter((d) => d >= r.start && (next === undefined || d < next)).sort().at(-1);
    if (override) r.end = override;
  });

  const records: CycleRecord[] = runs.map((r) => ({ id: `cyc-${r.start}`, start: r.start, end: r.end, quality: 'valid' }));

  // ---- engine history ----
  const temperatures: TemperatureReading[] = [];
  const lh: LhTest[] = [];
  const mucus: MucusObs[] = [];
  const cervix: CervixObs[] = [];
  for (const b of biomarkers) {
    const v = JSON.parse(b.value) as Record<string, string | number>;
    const prov = b.provenance as TemperatureReading['provenance'];
    const time = b.measured_at ? HHMM.exec(b.measured_at)?.[1] : undefined;
    if (b.type === 'bbt' || b.type === 'skin_temp') {
      temperatures.push({
        date: b.day, valueC: v.valueC as number, source: b.source as TemperatureReading['source'], provenance: prov, ...(time ? { timeOfDay: time } : {}),
        ...(b.disturbed ? { disturbed: true } : {}),
      });
    } else if (b.type === 'lh') lh.push({ date: b.day, result: v.result as LhTest['result'], provenance: prov });
    else if (b.type === 'mucus') mucus.push({ date: b.day, quality: v.quality as MucusObs['quality'], provenance: prov });
    else if (b.type === 'cervix') cervix.push({ date: b.day, position: v.position as CervixObs['position'], firmness: v.firmness as CervixObs['firmness'], opening: v.opening as CervixObs['opening'] });
  }
  const logs: DailyLog[] = dailyLog.map((r) => ({
    date: r.day,
    ...(r.flow ? { flow: r.flow as DailyLog['flow'] } : {}), ...(r.flow_kind ? { flowKind: r.flow_kind as DailyLog['flowKind'] } : {}),
    ...(r.clots ? { clots: true } : {}), ...(r.sex ? { sex: JSON.parse(r.sex) } : {}),
    symptoms: JSON.parse(r.symptoms) as NonNullable<DailyLog['symptoms']>,
  }));
  const history: History = { cycles: records, temperatures, lh, mucus, cervix, logs, excluded, confirmedLong };
  const settings: EngineSettings = {
    lifeStates: lifeStates.map(lifeStateOf), recencyLambda: profile.recencyLambda ?? RECENCY_LAMBDA, window: profile.window ?? 12,
    ...(profile.birthYear !== undefined ? { birthYear: profile.birthYear } : {}),
    ...(profile.menarcheYear !== undefined ? { menarcheYear: profile.menarcheYear } : {}),
    ...(profile.usualCycleLength !== undefined ? { usualCycleLength: profile.usualCycleLength } : {}),
  };

  const cycles: CycleRow[] = analyzeCycles(history, settings).map(({ record: c }) => {
    const ov = c.ovulation && c.ovulation.basis !== 'calendar' ? c.ovulation : undefined;
    return {
      id: c.id, start_day: c.start, end_day: c.end ?? null, next_start: c.nextStart ?? null, length_days: c.length ?? null, bleed_days: c.bleedDays ?? null,
      quality: c.quality, ov_day: ov?.point ?? null, ov_sd: ov?.sd ?? null, ov_basis: ov?.basis ?? null,
      luteal_days: ov && c.nextStart ? diffDays(c.nextStart, ov.point) - 1 : null,
    };
  });
  return { cycles, dailyLog, biomarkers: biomarkers.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.id < b.id ? -1 : 1)), lifeStates, history, settings };
}
