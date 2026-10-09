// HealthKit samples <-> health-adapter records (PLAN.md §7.1). Pure: no native module is imported here, so it is tested in vitest.
import type { HealthRecord, HealthType, NewRecord, RecordValue } from '@sanguine/health-adapter';

export const HK_TYPES: Record<HealthType, { kind: 'category' | 'quantity'; id: string }> = {
  period_flow: { kind: 'category', id: 'HKCategoryTypeIdentifierMenstrualFlow' },
  intermenstrual: { kind: 'category', id: 'HKCategoryTypeIdentifierIntermenstrualBleeding' },
  bbt: { kind: 'quantity', id: 'HKQuantityTypeIdentifierBasalBodyTemperature' },
  skin_temp: { kind: 'quantity', id: 'HKQuantityTypeIdentifierAppleSleepingWristTemperature' },
  lh: { kind: 'category', id: 'HKCategoryTypeIdentifierOvulationTestResult' },
  mucus: { kind: 'category', id: 'HKCategoryTypeIdentifierCervicalMucusQuality' },
  sex: { kind: 'category', id: 'HKCategoryTypeIdentifierSexualActivity' },
};

/** The slice of a HealthKit sample the mapping reads. Category samples carry `value`, quantity samples `quantity` and `unit`. */
export interface HkSample {
  uuid: string; startDate: Date; endDate: Date;
  metadata?: Record<string, unknown>;
  sourceRevision?: { source?: { bundleIdentifier?: string } };
  value?: number; quantity?: number; unit?: string;
}

const FLOW = { 1: 'medium', 2: 'light', 3: 'medium', 4: 'heavy' } as const; // 1 = unspecified: counted as medium (D-060)
const LH = { 1: 'negative', 2: 'positive', 3: 'indeterminate', 4: 'indeterminate' } as const; // 4 = estrogen surge: not an LH result
const MUCUS = { 1: 'dry', 2: 'sticky', 3: 'creamy', 4: 'watery', 5: 'eggwhite' } as const;
const SAVE_FLOW = { spotting: 2, light: 2, medium: 3, heavy: 4 } as const; // HealthKit has no spotting level
const SAVE_LH = { negative: 1, positive: 2, indeterminate: 3, high: 3 } as const;
const SAVE_MUCUS = { dry: 1, sticky: 2, creamy: 3, watery: 4, eggwhite: 5 } as const;

const iso = (d: Date) => d.toISOString();
/** HealthKit hands booleans back as 1 and 0 for some keys and true and false for others. */
const asBool = (v: unknown): boolean | undefined => (v === true || v === 1 ? true : v === false || v === 0 ? false : undefined);
const asString = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** A record, `null` for a sample that means "nothing" (flow none), or `{ skipped }` when the sample cannot be mapped without guessing. */
export function sampleToRecord(type: HealthType, s: HkSample, modifiedAt: string, devSeed = false): HealthRecord | { skipped: string } | null {
  const md = s.metadata ?? {};
  const v = s.value ?? 0;
  let value: RecordValue;
  switch (type) {
    case 'period_flow':
      if (v === 5) return null;
      if (!(v in FLOW)) return { skipped: `unknown value ${v}` };
      value = { kind: 'flow', level: FLOW[v as keyof typeof FLOW], ...(asBool(md.HKMenstrualCycleStart) === true ? { cycleStart: true } : {}) };
      break;
    case 'intermenstrual': value = { kind: 'bleeding' }; break;
    case 'bbt':
    case 'skin_temp':
      if (s.unit !== 'degC') return { skipped: `temperature unit ${s.unit ?? 'missing'}` };
      if (typeof s.quantity !== 'number') return { skipped: 'temperature missing' };
      value = { kind: 'temp', celsius: s.quantity };
      break;
    case 'lh':
      if (!(v in LH)) return { skipped: `unknown value ${v}` };
      value = { kind: 'lh', result: LH[v as keyof typeof LH] };
      break;
    case 'mucus':
      if (!(v in MUCUS)) return { skipped: `unknown value ${v}` };
      value = { kind: 'mucus', quality: MUCUS[v as keyof typeof MUCUS] };
      break;
    case 'sex':
      if (asBool(md.HKSexualActivityProtectionUsed) === undefined) return { skipped: 'protection unknown' };
      value = { kind: 'sex', protected: asBool(md.HKSexualActivityProtectionUsed) === true };
      break;
  }
  const zone = asString(md.HKTimeZone);
  const clientRecordId = asString(md['com.sanguine.eventId']);
  return {
    // development only: the simulator attributes every sample to this app, so a seeded sample is given a foreign source to exercise the import path
    type, externalId: s.uuid, source: devSeed && asBool(md['com.sanguine.seed']) === true ? 'dev.seed' : (s.sourceRevision?.source?.bundleIdentifier ?? 'unknown'), start: iso(s.startDate), end: iso(s.endDate),
    ...(zone ? { zone } : {}), modifiedAt, ...(clientRecordId ? { clientRecordId } : {}), value,
  };
}

export type HkSave =
  | { kind: 'category'; id: string; value: number; start: Date; end: Date; metadata: Record<string, unknown> }
  | { kind: 'quantity'; id: string; unit: 'degC'; value: number; start: Date; end: Date; metadata: Record<string, unknown> };

/** What to save for a record, or null for a type HealthKit is only read from. */
export function recordToSave(r: NewRecord): HkSave | null {
  const t = HK_TYPES[r.type];
  const start = new Date(r.start);
  // HealthKit rejects (an uncatchable native exception) a flow sample that lasts a full day: end one second before the next midnight
  const end = r.type === 'period_flow' || r.type === 'intermenstrual' ? new Date(start.getTime() + 86_399_000) : new Date(r.end);
  const metadata: Record<string, unknown> = { 'com.sanguine.eventId': r.clientRecordId };
  if (r.zone && !/^[+-]\d{2}:\d{2}$/.test(r.zone)) metadata.HKTimeZone = r.zone;
  const v = r.value;
  switch (v.kind) {
    case 'flow':
      metadata.HKMenstrualCycleStart = v.cycleStart === true; // required on every menstrual flow sample: HealthKit raises a native exception without it
      return { kind: 'category', id: t.id, value: SAVE_FLOW[v.level], start, end, metadata };
    case 'bleeding': return { kind: 'category', id: t.id, value: 0, start, end, metadata };
    case 'temp': return r.type === 'bbt' ? { kind: 'quantity', id: t.id, unit: 'degC', value: v.celsius, start, end, metadata } : null;
    case 'lh': return { kind: 'category', id: t.id, value: SAVE_LH[v.result], start, end, metadata };
    case 'mucus': return { kind: 'category', id: t.id, value: SAVE_MUCUS[v.quality], start, end, metadata };
    case 'sex':
      metadata.HKSexualActivityProtectionUsed = v.protected;
      return { kind: 'category', id: t.id, value: 0, start, end, metadata };
  }
}
