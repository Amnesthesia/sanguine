// PLAN.md §4.9 life-state gates. Pure: turns the user's life states into engine parameters.
import type { Confidence, CycleRecord, EngineSettings, ISODate, LifeState } from './types';

export interface LifeGate {
  suspended?: { reason: string }; // a code: the UI writes the wording
  lambda: number;
  varianceScale: number; // multiplies the variance prior
  confidenceCap?: Confidence;
  calendarEstimate: boolean; // false: ovulation and the fertile band only from biomarkers
  missedGapDays?: number; // replaces the 90-day missed-period rule (perimenopause)
  cycleWeight: (c: CycleRecord) => number; // 0 excludes the cycle from the cycle-length model
}

const WARMUP_CYCLES = 3;
const WARMUP_WEIGHT = 0.5;
const PERIMENOPAUSE_LAMBDA = 0.8;
const PERIMENOPAUSE_VARIANCE_SCALE = 2;
const PERIMENOPAUSE_GAP_DAYS = 60;
const STRAW_DIFF_DAYS = 7;
const RANK: Record<Confidence, number> = { none: 0, low: 1, medium: 2, high: 3 };

type Stated = LifeState & { until?: ISODate };

function from(s: LifeState): ISODate {
  switch (s.kind) {
    case 'none': return '9999-12-31';
    case 'post_contraception': return s.stopped;
    case 'postpartum': return s.delivered;
    default: return s.since;
  }
}
const active = (s: Stated, today: ISODate): boolean => from(s) <= today && (s.until === undefined || today <= s.until);
const lowerCap = (a: Confidence | undefined, b: Confidence): Confidence => (a === undefined || RANK[b] < RANK[a] ? b : a);

export function evaluateLifeStates(cycles: CycleRecord[], settings: EngineSettings, today: ISODate): LifeGate {
  const states = (settings.lifeStates as Stated[]).filter((s) => active(s, today));
  const gate: LifeGate = { lambda: settings.recencyLambda, varianceScale: 1, calendarEstimate: true, cycleWeight: () => 1 };
  const warmups: ISODate[] = []; // post-stop / post-delivery dates whose warm-up is still running

  for (const s of states) {
    switch (s.kind) {
      case 'hormonal_contraception': gate.suspended ??= { reason: 'hormonal_contraception' }; break;
      case 'pregnant': gate.suspended ??= { reason: 'pregnant' }; break;
      case 'postpartum': {
        if (!cycles.some((c) => c.start >= s.delivered)) { gate.suspended ??= { reason: 'postpartum' }; break; }
        const done = cycles.filter((c) => c.start >= s.delivered && c.length !== undefined).length;
        if (done < WARMUP_CYCLES) warmups.push(s.delivered);
        if (s.breastfeeding && !cycles.some((c) => c.start >= s.delivered && c.ovulation && c.ovulation.basis !== 'calendar')) gate.calendarEstimate = false;
        break;
      }
      case 'post_contraception': {
        const done = cycles.filter((c) => c.start >= s.stopped && c.length !== undefined).length;
        if (done < WARMUP_CYCLES) warmups.push(s.stopped);
        break;
      }
      case 'perimenopause':
        gate.lambda = Math.min(gate.lambda, PERIMENOPAUSE_LAMBDA);
        gate.varianceScale = PERIMENOPAUSE_VARIANCE_SCALE;
        gate.calendarEstimate = false;
        gate.missedGapDays = PERIMENOPAUSE_GAP_DAYS;
        break;
      case 'known_irregular': gate.confidenceCap = lowerCap(gate.confidenceCap, 'medium'); break;
      case 'none': break;
    }
  }
  if (warmups.length > 0) {
    gate.confidenceCap = lowerCap(gate.confidenceCap, 'low');
    const latest = [...warmups].sort().at(-1) as ISODate; // the most recent event defines "prior only"
    gate.cycleWeight = (c) => (c.start < latest ? 0 : WARMUP_WEIGHT);
  }
  if (gate.suspended) gate.confidenceCap = 'none';
  return gate;
}

/** STRAW+10 early transition: age >= 40 and at least two of the last three consecutive-cycle differences are >= 7 days. */
export function suggestPerimenopause(cycles: CycleRecord[], settings: EngineSettings, today: ISODate): boolean {
  if (settings.birthYear === undefined || Number(today.slice(0, 4)) - settings.birthYear < 40) return false;
  if (settings.lifeStates.some((s) => s.kind === 'perimenopause')) return false;
  const lens = cycles.filter((c) => c.quality === 'valid' && c.length !== undefined).map((c) => c.length as number);
  if (lens.length < 4) return false;
  const last = lens.slice(-4);
  const diffs = last.slice(1).map((x, i) => Math.abs(x - (last[i] as number)));
  return diffs.filter((d) => d >= STRAW_DIFF_DAYS).length >= 2;
}
