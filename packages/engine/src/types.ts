// PLAN.md §4.2. Types marked "added" are not spelled out in the plan but are required by §4.11.
export type ISODate = string; // 'YYYY-MM-DD', local calendar day
export type Provenance = 'manual' | 'imported' | 'sensor';

export interface CycleRecord {
  id: string;
  start: ISODate; // first day of bleeding (not spotting)
  end?: ISODate; // last bleeding day
  nextStart?: ISODate; // derived: start of following cycle
  length?: number; // derived: nextStart - start, days
  bleedDays?: number;
  quality: 'valid' | 'suspect_skip' | 'suspect_short' | 'user_excluded' | 'life_state';
  ovulation?: OvulationEstimate; // retrospective, from biomarkers
}

export interface TemperatureReading {
  date: ISODate;
  valueC: number;
  timeOfDay?: string; // 'HH:MM'
  source: 'oral' | 'wrist' | 'finger' | 'vaginal' | 'other';
  provenance: Provenance;
  disturbed?: boolean;
  disturbanceReason?: string;
}
export interface LhTest {
  date: ISODate;
  result: 'negative' | 'positive' | 'high' | 'peak' | 'indeterminate';
  provenance: Provenance;
}
export interface MucusObs {
  date: ISODate;
  quality: 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite';
  provenance: Provenance;
}
export interface CervixObs {
  date: ISODate;
  position: 'low' | 'mid' | 'high';
  firmness: 'firm' | 'medium' | 'soft';
  opening: 'closed' | 'partial' | 'open';
}

export type LifeState =
  | { kind: 'none' }
  | { kind: 'hormonal_contraception'; method: 'combined_pill' | 'pop' | 'implant' | 'injection' | 'hormonal_iud' | 'ring' | 'patch'; since: ISODate }
  | { kind: 'post_contraception'; stopped: ISODate; method: string }
  | { kind: 'pregnant'; since: ISODate }
  | { kind: 'postpartum'; delivered: ISODate; breastfeeding: boolean }
  | { kind: 'perimenopause'; since: ISODate }
  | { kind: 'known_irregular'; reason: 'pcos' | 'other'; since: ISODate };

export interface EngineSettings {
  birthYear?: number;
  menarcheYear?: number;
  lifeStates: Array<LifeState & { until?: ISODate }>;
  recencyLambda: number; // default 0.92
  window: number; // default 12 cycles
  usualCycleLength?: number; // optional onboarding value, one observation of weight 0.5 (§4.3)
}

export interface Interval {
  lo: ISODate;
  hi: ISODate;
}
export type Confidence = 'high' | 'medium' | 'low' | 'none';

// added: ovulation estimate attached to a cycle or to a prediction
export interface OvulationEstimate {
  point: ISODate;
  offset?: number; // days after cycle start, fractional; `point` is its rounded date
  sd: number; // days
  basis: 'calendar' | 'bbt' | 'wearable' | 'lh' | 'mucus' | 'cervix' | 'combined';
  confidence?: Confidence;
  conflict?: boolean;
}

// added: §4.10 flag. `code` is the key into copy/flags.en-AU.json; the engine never produces wording.
export type FlagCode =
  | 'short' | 'long' | 'longSingle' | 'variability' | 'heavy' | 'prolonged'
  | 'intermenstrual' | 'missed' | 'missedFrom40' | 'shortLuteal';
export interface HealthFlag {
  code: FlagCode;
  params: Record<string, number>;
  insightOnly?: boolean;
  raisedOn: ISODate;
}

// added: per-day log, used by flag rules (bleeding) only. Symptoms are carried but never read by `predict`.
export interface DailyLog {
  date: ISODate;
  flow?: 'none' | 'spotting' | 'light' | 'medium' | 'heavy';
  flowKind?: 'period' | 'withdrawal_bleed' | 'intermenstrual' | 'on_contraception';
  clots?: boolean;
  symptoms?: Array<{ code: string; intensity: 1 | 2 | 3 }>;
  sex?: { protected: boolean };
}

// added: everything `predict` reads. Cycles carry start/end; derived fields are recomputed by classifyCycles.
export interface History {
  cycles: CycleRecord[];
  temperatures: TemperatureReading[];
  lh: LhTest[];
  mucus: MucusObs[];
  cervix: CervixObs[];
  logs: DailyLog[];
  muted?: Array<{ code: FlagCode; until: ISODate }>;
  confirmedLong?: ISODate[]; // cycle starts the user re-admitted (`cycle.confirm_long`)
  excluded?: ISODate[]; // cycle starts the user excluded (`cycle.exclude`)
  lastFlagRaised?: Partial<Record<FlagCode, ISODate>>; // for the 90-day rate limit
}

export interface Prediction {
  engineVersion: string;
  asOf: ISODate;
  suspended?: { reason: string }; // life state blocks prediction
  nextPeriod?: { point: ISODate; i80: Interval; i95: Interval; confidence: Confidence; daysOfDataUsed: number };
  cycleLength: { mean: number; sd: number; nu: number; scale: number; nCyclesUsed: number };
  ovulation?: { point: ISODate; i80: Interval; sd: number; confidence: Confidence; basis: 'calendar' | 'bbt' | 'lh' | 'mucus' | 'combined' };
  fertileDays?: Array<{ date: ISODate; pInWindow: number }>; // Wilcox 6-day window, probability-weighted
  currentPhase?: { phase: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'late'; dayOfCycle: number };
  flags: HealthFlag[];
  cycleQuality: Array<{ cycleId: string; quality: CycleRecord['quality']; reason?: string; conflict?: boolean }>;
}

// added: §4.3 model types
export interface NigPrior { m0: number; kappa0: number; alpha0: number; beta0: number }
export interface NigPosterior { m: number; kappa: number; alpha: number; beta: number; weight: number; n: number }
export interface ShiftResult { firstHighDate: ISODate; coverlineC: number; ovulation: OvulationEstimate }
