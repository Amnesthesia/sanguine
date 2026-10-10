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
  rangeWeight?: (c: CycleRecord) => number; // during a post-loss warm-up: the range is at least as wide as with these weights (D-094)
  steady: boolean; // no warm-up, perimenopause or known-irregular state: a range from her own errors may narrow (D-094)
}

const WARMUP_CYCLES = 3;
const WARMUP_WEIGHT = 0.5;
/** D-094 (P8-13 item 3): during the warm-up after a pregnancy loss, cycles from before the pregnancy keep this weight
 *  (0 after a birth or stopping contraception). */
const PRE_LOSS_WEIGHT = 0.5;
const PERIMENOPAUSE_LAMBDA = 0.8;
const PERIMENOPAUSE_VARIANCE_SCALE = 2;
const PERIMENOPAUSE_GAP_DAYS = 60;
const STRAW_DIFF_DAYS = 7;
const RANK: Record<Confidence, number> = { none: 0, low: 1, medium: 2, high: 3 };

type Stated = LifeState & { until?: ISODate };

/** The day a life state starts. */
export function lifeStateStart(s: LifeState): ISODate {
  switch (s.kind) {
    case 'none': return '9999-12-31';
    case 'post_contraception': return s.stopped;
    case 'postpartum': return s.delivered;
    default: return s.since;
  }
}
const active = (s: Stated, today: ISODate): boolean => lifeStateStart(s) <= today && (s.until === undefined || today <= s.until);
const lowerCap = (a: Confidence | undefined, b: Confidence): Confidence => (a === undefined || RANK[b] < RANK[a] ? b : a);

export function evaluateLifeStates(cycles: CycleRecord[], settings: EngineSettings, today: ISODate): LifeGate {
  const states = (settings.lifeStates as Stated[]).filter((s) => active(s, today));
  const gate: LifeGate = { lambda: settings.recencyLambda, varianceScale: 1, calendarEstimate: true, cycleWeight: () => 1, steady: true };
  const warmups: Array<{ from: ISODate; loss: boolean }> = []; // post-stop / post-delivery events whose warm-up is still running
  const periods = cycles.filter((c) => c.quality !== 'life_state'); // a paused cycle is not a period for suspension or warm-up (D-053)

  for (const s of states) {
    switch (s.kind) {
      case 'hormonal_contraception': gate.suspended ??= { reason: 'hormonal_contraception' }; break;
      case 'pregnant': gate.suspended ??= { reason: 'pregnant' }; break;
      case 'postpartum': {
        if (!periods.some((c) => c.start >= s.delivered)) { gate.suspended ??= { reason: 'postpartum' }; break; }
        const done = periods.filter((c) => c.start >= s.delivered && c.length !== undefined).length;
        if (done < WARMUP_CYCLES) warmups.push({ from: s.delivered, loss: s.after === 'loss' });
        if (s.breastfeeding && !cycles.some((c) => c.start >= s.delivered && c.ovulation && c.ovulation.basis !== 'calendar')) gate.calendarEstimate = false;
        if (s.breastfeeding) gate.steady = false; // D-094: ranges from her own errors only widen while breastfeeding
        break;
      }
      case 'post_contraception': {
        const done = periods.filter((c) => c.start >= s.stopped && c.length !== undefined).length;
        if (done < WARMUP_CYCLES) warmups.push({ from: s.stopped, loss: false });
        break;
      }
      case 'perimenopause':
        gate.lambda = Math.min(gate.lambda, PERIMENOPAUSE_LAMBDA);
        gate.varianceScale = PERIMENOPAUSE_VARIANCE_SCALE;
        gate.calendarEstimate = false;
        gate.missedGapDays = PERIMENOPAUSE_GAP_DAYS;
        gate.steady = false;
        break;
      case 'known_irregular': gate.confidenceCap = lowerCap(gate.confidenceCap, 'medium'); gate.steady = false; break;
      case 'none': break;
    }
  }
  if (warmups.length > 0) {
    gate.confidenceCap = lowerCap(gate.confidenceCap, 'low');
    gate.steady = false;
    // the most recent event defines which cycles are "before"
    const latest = [...warmups].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0)).at(-1) as { from: ISODate; loss: boolean };
    const after = (c: CycleRecord) => (c.start >= latest.from ? WARMUP_WEIGHT : 0);
    gate.cycleWeight = (c) => (latest.loss && c.start < latest.from ? PRE_LOSS_WEIGHT : after(c));
    // the earlier cycles move the date, not the certainty: the range stays at least as wide as without them
    if (latest.loss) gate.rangeWeight = after;
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
