// Event kinds and payload validation (PLAN.md §5.3). `validateEvent` is the trust boundary for everything written to the log.
import type { ISODate } from '@sanguine/engine';

export type Provenance = 'manual' | 'imported' | 'sensor';
export const FLOW_LEVELS = ['none', 'spotting', 'light', 'medium', 'heavy'] as const;
export const FLOW_KINDS = ['period', 'withdrawal_bleed', 'intermenstrual', 'on_contraception'] as const;
export const BIOMARKER_TYPES = ['bbt', 'skin_temp', 'lh', 'mucus', 'cervix', 'preg_test', 'progesterone'] as const;
export const LIFE_STATE_KINDS = ['hormonal_contraception', 'post_contraception', 'pregnant', 'postpartum', 'perimenopause', 'known_irregular'] as const;
export type FlowLevel = (typeof FLOW_LEVELS)[number];
export type FlowKind = (typeof FLOW_KINDS)[number];
export type BiomarkerType = (typeof BIOMARKER_TYPES)[number];

export interface EventRow {
  id: string; lamport: number; device_id: string; recorded_at: string; effective_day: ISODate; tz: string;
  kind: string; payload: string; provenance: Provenance; source_app: string | null; external_id: string | null;
  retracts: string | null; schema_v: number;
}

/** What a caller supplies; the store adds id, lamport, device, recorded_at and tz. */
export interface NewEvent {
  kind: string;
  payload: Record<string, unknown>;
  provenance?: Provenance;
  source_app?: string;
  external_id?: string;
  retracts?: string;
  /** Required for `retract` (the target's day); derived from the payload otherwise. */
  effective_day?: ISODate;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: unknown): v is string => typeof v === 'string' && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const oneOf = <T extends readonly string[]>(list: T, v: unknown): v is T[number] => typeof v === 'string' && (list as readonly string[]).includes(v);
const fail = (kind: string, why: string): never => { throw new Error(`invalid ${kind} event: ${why}`); };

/** Throws on an invalid payload; returns the effective day the event is about. */
export function validateEvent(e: NewEvent): ISODate {
  const p = e.payload;
  const day = (): ISODate => (isDay(p.day) ? p.day : fail(e.kind, 'day must be YYYY-MM-DD'));
  switch (e.kind) {
    case 'period.start':
    case 'period.end':
      return day();
    case 'flow':
      if (!oneOf(FLOW_LEVELS, p.level)) fail(e.kind, 'level');
      if (!oneOf(FLOW_KINDS, p.flow_kind)) fail(e.kind, 'flow_kind');
      if (p.clots !== undefined && typeof p.clots !== 'boolean') fail(e.kind, 'clots');
      return day();
    case 'symptom':
      if (typeof p.code !== 'string' || p.code.length === 0) fail(e.kind, 'code');
      if (!Number.isInteger(p.intensity) || (p.intensity as number) < 0 || (p.intensity as number) > 3) fail(e.kind, 'intensity must be 0-3');
      return day();
    case 'biomarker': {
      if (!oneOf(BIOMARKER_TYPES, p.type)) fail(e.kind, 'type');
      if (typeof p.value !== 'object' || p.value === null) fail(e.kind, 'value must be an object');
      if (typeof p.source !== 'string') fail(e.kind, 'source');
      if (p.type === 'bbt' || p.type === 'skin_temp') {
        const v = (p.value as { valueC?: unknown }).valueC;
        if (typeof v !== 'number' || !Number.isFinite(v)) fail(e.kind, 'valueC must be a number');
      }
      if (p.measured_at !== undefined && typeof p.measured_at !== 'string') fail(e.kind, 'measured_at');
      return day();
    }
    case 'sex':
      if (typeof p.protected !== 'boolean') fail(e.kind, 'protected');
      return day();
    case 'life_state.set':
      if (!oneOf(LIFE_STATE_KINDS, p.kind)) fail(e.kind, 'kind');
      if (typeof p.detail !== 'object' || p.detail === null) fail(e.kind, 'detail must be an object');
      return day();
    case 'life_state.end':
      if (!oneOf(LIFE_STATE_KINDS, p.kind)) fail(e.kind, 'kind');
      return day();
    case 'cycle.exclude':
    case 'cycle.confirm_long':
      if (!isDay(p.cycle_start)) fail(e.kind, 'cycle_start');
      return p.cycle_start as ISODate;
    case 'note':
      if (typeof p.cipher !== 'string') fail(e.kind, 'cipher');
      return day();
    case 'import.batch':
      if (typeof p.source !== 'string' || !Number.isInteger(p.count)) fail(e.kind, 'source and count');
      return isDay(e.effective_day) ? e.effective_day : fail(e.kind, 'effective_day');
    case 'retract':
      if (typeof e.retracts !== 'string' || e.retracts.length === 0) fail(e.kind, 'retracts');
      return isDay(e.effective_day) ? e.effective_day : fail(e.kind, 'effective_day');
    default:
      return fail(e.kind, `unknown kind "${e.kind}"`);
  }
}
