// Pure mapping between platform records and Sanguine events (PLAN.md §5.5, §7.1). Zone maths uses Intl only: no clock, no I/O.
import type { HealthRecord, HealthType, ISODate, NewRecord, RecordValue, SinkEvent } from './types';
import { READ_ONLY_TYPES } from './types';

const OFFSET = /^([+-])(\d{2}):(\d{2})$/;
const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, '0');

const formatters = new Map<string, Intl.DateTimeFormat>();
function fmt(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    formatters.set(zone, f);
  }
  return f;
}

/** Minutes the zone is ahead of UTC at the instant `ms`. */
function offsetMinutes(ms: number, zone: string): number {
  const m = OFFSET.exec(zone);
  if (m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
  const p: Record<string, number> = {};
  for (const part of fmt(zone).formatToParts(new Date(ms))) if (part.type !== 'literal') p[part.type] = Number(part.value);
  const wall = Date.UTC(p.year ?? 1970, (p.month ?? 1) - 1, p.day ?? 1, p.hour ?? 0, p.minute ?? 0, p.second ?? 0);
  return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60000);
}

/** The local calendar day of an instant in a zone. */
function wallDay(instant: string, zone: string): ISODate {
  const ms = Date.parse(instant);
  const d = new Date(ms + offsetMinutes(ms, zone) * 60000);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(day: ISODate, n: number): ISODate {
  const d = new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** An instant as wall-clock time in a zone with that zone's offset ("2026-10-09T05:30:00+10:00"): the time the person saw where
 *  they were, which the BBT time check needs, while the offset keeps the instant exact (D-093). */
export function wallClockIso(instant: string, zone: string): string {
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) return instant;
  const off = offsetMinutes(ms, zone);
  const d = new Date(ms + off * 60000);
  const sign = off < 0 ? '-' : '+';
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}${sign}${pad(Math.trunc(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

/** The ISO instant (with the zone's offset) of local `HH:MM` on `day`. */
export function localIso(day: ISODate, hhmm: string, zone: string): string {
  const [h, mi] = hhmm.split(':').map(Number);
  const guess = Date.parse(`${day}T00:00:00Z`) + ((h ?? 0) * 60 + (mi ?? 0)) * 60000;
  let off = offsetMinutes(guess, zone);
  off = offsetMinutes(guess - off * 60000, zone); // the offset at the instant itself, across a daylight-saving change
  const sign = off < 0 ? '-' : '+';
  return `${day}T${hhmm}:00${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
}

/** §5.5: the local day a record belongs to. A night's skin temperature belongs to the morning it ends. */
export function recordDay(r: HealthRecord, deviceZone: string): ISODate {
  return wallDay(r.type === 'skin_temp' ? r.end : r.start, r.zone ?? deviceZone);
}

const stable = (v: unknown): string => {
  if (typeof v === 'number') return v.toFixed(2);
  if (v && typeof v === 'object') return `{${Object.entries(v).filter(([k]) => k !== 'cycleStart').sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => `${k}:${stable(x)}`).join(',')}}`;
  return JSON.stringify(v);
};
/** Identity of an observation regardless of which app wrote it: the second echo guard and the duplicate check (§7.3). */
export const contentHash = (day: ISODate, type: HealthType, value: RecordValue): string => `${day}|${type}|${stable(value)}`;

export function recordToEvent(r: HealthRecord, day: ISODate, deviceZone: string): { kind: string; payload: Record<string, unknown> } {
  const v = r.value;
  switch (v.kind) {
    case 'flow': return { kind: 'flow', payload: { day, level: v.level, flow_kind: 'period' } };
    case 'bleeding': return { kind: 'flow', payload: { day, level: 'spotting', flow_kind: 'intermenstrual' } };
    case 'temp': return { kind: 'biomarker', payload: { day, type: r.type === 'skin_temp' ? 'skin_temp' : 'bbt', value: { valueC: v.celsius }, source: r.type === 'skin_temp' ? 'wrist' : 'oral', measured_at: wallClockIso(r.start, r.zone ?? deviceZone) } };
    case 'lh': return { kind: 'biomarker', payload: { day, type: 'lh', value: { result: v.result }, source: 'strip' } };
    case 'mucus': return { kind: 'biomarker', payload: { day, type: 'mucus', value: { quality: v.quality }, source: 'manual' } };
    case 'sex': return { kind: 'sex', payload: { day, protected: v.protected } };
  }
}

/** Which synced health type an event belongs to, or null when it is never written to a platform. */
export function syncedType(e: SinkEvent): HealthType | null {
  const p = e.payload;
  switch (e.kind) {
    case 'flow':
      if (p.level === 'none') return null;
      return p.flow_kind === 'period' ? 'period_flow' : p.flow_kind === 'intermenstrual' ? 'intermenstrual' : null;
    case 'biomarker':
      return p.type === 'bbt' || p.type === 'skin_temp' || p.type === 'lh' || p.type === 'mucus' ? (p.type as HealthType) : null;
    case 'sex': return 'sex';
    default: return null;
  }
}

/** The observation an event carries, for any synced type (including read-only ones), or null. */
export function eventValue(e: SinkEvent): RecordValue | null {
  const type = syncedType(e);
  const p = e.payload;
  switch (type) {
    case 'period_flow': return { kind: 'flow', level: p.level as 'light' };
    case 'intermenstrual': return { kind: 'bleeding' };
    case 'bbt':
    case 'skin_temp': return { kind: 'temp', celsius: (p.value as { valueC: number }).valueC };
    case 'lh': { const r = (p.value as { result: string }).result; return { kind: 'lh', result: (r === 'peak' ? 'positive' : r) as 'positive' }; }
    case 'mucus': return { kind: 'mucus', quality: (p.value as { quality: string }).quality as 'dry' };
    case 'sex': return { kind: 'sex', protected: p.protected === true };
    default: return null;
  }
}

/** The record to write for an event, or null (symptoms, notes, life states and read-only types are never written). */
export function eventToRecord(e: SinkEvent, zone: string, o: { cycleStart?: boolean } = {}): NewRecord | null {
  const type = syncedType(e);
  const value = eventValue(e);
  if (!type || !value || READ_ONLY_TYPES.includes(type)) return null;
  const day = e.effectiveDay;
  const base = { type, zone, clientRecordId: e.id } as const;
  const span = type === 'period_flow' || type === 'intermenstrual';
  if (span) return { ...base, start: localIso(day, '00:00', zone), end: localIso(addDays(day, 1), '00:00', zone), value: value.kind === 'flow' && o.cycleStart ? { ...value, cycleStart: true } : value };
  const at = type === 'bbt' && typeof e.payload.measured_at === 'string' ? e.payload.measured_at : localIso(day, type === 'bbt' ? '06:00' : '12:00', zone);
  return { ...base, start: at, end: at, value };
}
