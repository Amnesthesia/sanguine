// Health Connect records <-> health-adapter records (PLAN.md §7.1). Pure and tested; the native calls are in healthConnect.ts.
import type { HealthRecord, HealthType, NewRecord, RecordValue } from '@sanguine/health-adapter';

export const HC_TYPES: Record<HealthType, string> = {
  period_flow: 'MenstruationFlow', intermenstrual: 'IntermenstrualBleeding', bbt: 'BasalBodyTemperature', skin_temp: 'SkinTemperature',
  lh: 'OvulationTest', mucus: 'CervicalMucus', sex: 'SexualActivity',
};
const BY_RECORD = Object.fromEntries(Object.entries(HC_TYPES).map(([k, v]) => [v, k as HealthType])) as Record<string, HealthType>;

/** A record as `readRecords` and `getChanges` return it (units already converted by the library). */
export interface HcResult {
  recordType: string;
  time?: string; startTime?: string; endTime?: string;
  zoneOffset?: { totalSeconds: number } | { id: string; totalSeconds: number };
  startZoneOffset?: { id?: string; totalSeconds: number };
  metadata?: { id?: string; dataOrigin?: string; lastModifiedTime?: string; clientRecordId?: string };
  [k: string]: unknown;
}

const FLOW = { 0: 'medium', 1: 'light', 2: 'medium', 3: 'heavy' } as const; // 0 = unknown: counted as medium (D-060)
const LH = { 0: 'indeterminate', 1: 'negative', 2: 'positive', 3: 'high' } as const;
const MUCUS = { 1: 'dry', 2: 'sticky', 3: 'creamy', 4: 'watery', 5: 'eggwhite' } as const;
const SAVE_FLOW = { spotting: 1, light: 1, medium: 2, heavy: 3 } as const;
const SAVE_LH = { indeterminate: 0, negative: 1, positive: 2, high: 3 } as const;
const SAVE_MUCUS = { dry: 1, sticky: 2, creamy: 3, watery: 4, eggwhite: 5 } as const;

const offset = (sec: number | undefined) => {
  if (sec === undefined) return undefined;
  const a = Math.abs(sec);
  return `${sec < 0 ? '-' : '+'}${String(Math.trunc(a / 3600)).padStart(2, '0')}:${String(Math.trunc((a % 3600) / 60)).padStart(2, '0')}`;
};

export function resultToRecord(r: HcResult, modifiedAt: string): HealthRecord | { skipped: string } | null {
  const type = BY_RECORD[r.recordType];
  if (!type) return null;
  let value: RecordValue;
  switch (type) {
    case 'period_flow': value = { kind: 'flow', level: FLOW[((r.flow as number | undefined) ?? 0) as keyof typeof FLOW] ?? 'medium' }; break;
    case 'intermenstrual': value = { kind: 'bleeding' }; break;
    case 'bbt': value = { kind: 'temp', celsius: (r.temperature as { inCelsius: number }).inCelsius }; break;
    case 'skin_temp': {
      const base = (r.baseline as { inCelsius: number } | undefined)?.inCelsius;
      const deltas = (r.deltas as Array<{ delta: { inCelsius: number } }> | undefined) ?? [];
      if (base === undefined) return { skipped: 'no skin temperature baseline' };
      if (deltas.length === 0) return { skipped: 'no skin temperature deltas' };
      value = { kind: 'temp', celsius: base + deltas.reduce((s, d) => s + d.delta.inCelsius, 0) / deltas.length };
      break;
    }
    case 'lh': value = { kind: 'lh', result: LH[((r.result as number | undefined) ?? 0) as keyof typeof LH] ?? 'indeterminate' }; break;
    case 'mucus': {
      const q = MUCUS[r.appearance as keyof typeof MUCUS];
      if (!q) return { skipped: 'appearance unknown' };
      value = { kind: 'mucus', quality: q };
      break;
    }
    case 'sex':
      if (r.protectionUsed !== 1 && r.protectionUsed !== 2) return { skipped: 'protection unknown' };
      value = { kind: 'sex', protected: r.protectionUsed === 1 };
      break;
  }
  const start = r.time ?? r.startTime ?? '';
  const zone = offset((r.zoneOffset ?? r.startZoneOffset)?.totalSeconds);
  const md = r.metadata ?? {};
  return {
    type, externalId: md.id ?? '', source: md.dataOrigin ?? 'unknown', start, end: r.time ?? r.endTime ?? start,
    ...(zone ? { zone } : {}), modifiedAt: md.lastModifiedTime ?? modifiedAt, ...(md.clientRecordId ? { clientRecordId: md.clientRecordId } : {}), value,
  };
}

/** The record to insert, or null for a type Health Connect is only read from. clientRecordId makes a repeated insert an upsert. */
export function recordToInsert(r: NewRecord): Record<string, unknown> | null {
  const time = new Date(r.start).toISOString();
  const metadata = { clientRecordId: r.clientRecordId, clientRecordVersion: 1 };
  const v = r.value;
  switch (v.kind) {
    case 'flow': return { recordType: 'MenstruationFlow', time, flow: SAVE_FLOW[v.level], metadata };
    case 'bleeding': return { recordType: 'IntermenstrualBleeding', time, metadata };
    case 'temp': return r.type === 'bbt' ? { recordType: 'BasalBodyTemperature', time, temperature: { unit: 'celsius', value: v.celsius }, metadata } : null;
    case 'lh': return { recordType: 'OvulationTest', time, result: SAVE_LH[v.result], metadata };
    case 'mucus': return { recordType: 'CervicalMucus', time, appearance: SAVE_MUCUS[v.quality], metadata };
    case 'sex': return { recordType: 'SexualActivity', time, protectionUsed: v.protected ? 1 : 2, metadata };
  }
}
