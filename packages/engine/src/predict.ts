// PLAN.md §4.1, §4.11: the engine entry point. Pure and deterministic: no clock, no randomness, no I/O.
// Symptoms are never read here: `DailyLog.symptoms` is carried for the UI and ignored by every function in this package.
import { detectBbtShift, detectWearableShift } from './bbt';
import { classifyDetailed } from './classify';
import { combineOvulation } from './combine';
import { detectCervixPeak } from './cervix';
import { conformalHalfWidths, cyclePrior, fitWeighted, predictiveInterval, predictiveScale, predictiveVariance, selectRecency } from './cycleLength';
import { addDays, diffDays } from './dates';
import { fertileDayProbabilities } from './fertile';
import { evaluateFlags } from './flags';
import { detectLhSurge } from './lh';
import { evaluateLifeStates } from './lifestate';
import { detectMucusPeak } from './mucus';
import { calendarOvulation, confidenceGrade, fitLuteal, lutealLengths, ovulationInterval } from './ovulation';
import { ENGINE_VERSION } from './params';
import type {
  Confidence, CycleRecord, EngineSettings, History, ISODate, NigPosterior, OvulationEstimate, Prediction,
} from './types';

const FERTILE_HORIZON_DAYS = 60;
const DEFAULT_BLEED_DAYS = 5;
const OVULATORY_HALF_WINDOW_DAYS = 1;
const RANK: Record<Confidence, number> = { none: 0, low: 1, medium: 2, high: 3 };
// next-period confidence (D-020)
const NEXT_HIGH_MIN_CYCLES = 6;
const NEXT_HIGH_MAX_HALFWIDTH = 3;
const NEXT_MEDIUM_MAX_HALFWIDTH = 5;

const cap = (c: Confidence, limit?: Confidence): Confidence => (limit !== undefined && RANK[limit] < RANK[c] ? limit : c);

/** Biomarker ovulation for the cycle [start, end) from every signal, or null. */
function cycleBiomarkerOvulation(h: History, start: ISODate, endExclusive: ISODate): OvulationEstimate | null {
  const within = <T extends { date: ISODate }>(xs: T[]) => xs.filter((x) => x.date >= start && x.date < endExclusive);
  const estimates = [
    detectLhSurge(within(h.lh), start),
    detectMucusPeak(within(h.mucus), start),
    detectCervixPeak(within(h.cervix), start),
    detectBbtShift(within(h.temperatures), start)?.ovulation ?? null,
    detectWearableShift(within(h.temperatures), start)?.ovulation ?? null,
  ].filter((e): e is OvulationEstimate => e !== null);
  return combineOvulation(estimates);
}

const predictionBasis = (b: OvulationEstimate['basis']): NonNullable<Prediction['ovulation']>['basis'] =>
  b === 'wearable' ? 'bbt' : b === 'cervix' ? 'combined' : b;

/** Classified cycles with retrospective biomarker ovulation on every closed cycle (a stored estimate is kept when there is no biomarker data). */
export function analyzeCycles(history: History, settings: EngineSettings): Array<{ record: CycleRecord; reason?: string }> {
  const classified = classifyDetailed(history.cycles, settings, { excluded: history.excluded, confirmedLong: history.confirmedLong });
  return classified.map((c) => {
    if (!c.record.nextStart) return c;
    const est = cycleBiomarkerOvulation(history, c.record.start, c.record.nextStart);
    return est
      ? { ...c, record: { ...c.record, ovulation: { point: est.point, offset: est.offset, sd: est.sd, basis: est.basis, confidence: est.confidence } } }
      : c;
  });
}

export function predict(history: History, settings: EngineSettings, today: ISODate): Prediction {
  const classified = analyzeCycles(history, settings);
  const cycles: CycleRecord[] = classified.map((c) => c.record);

  const gate = evaluateLifeStates(cycles, settings, today);
  const prior = cyclePrior(settings.birthYear, today, { varianceScale: gate.varianceScale });

  // cycle-length model over valid cycles (weights: recency x warm-up multiplier); recency and prior strength per user (D-094)
  const kept = cycles.filter((c) => c.quality === 'valid' && c.length !== undefined && gate.cycleWeight(c) > 0);
  const keptLengths = kept.map((c) => c.length as number);
  const recency = selectRecency(keptLengths, prior, gate.lambda, settings.window);
  const usable = kept.slice(-settings.window);
  const n = usable.length;
  const obs = usable.map((c, i) => ({ x: c.length as number, w: recency.lambda ** (n - 1 - i) * gate.cycleWeight(c) }));
  if (settings.usualCycleLength !== undefined) obs.unshift({ x: settings.usualCycleLength, w: 0.5 });
  const post: NigPosterior = fitWeighted(obs, { ...prior, kappa0: recency.kappa0 });
  const nu = 2 * post.alpha;
  const cycleLength = { mean: post.m, sd: Math.sqrt(predictiveVariance(post)), nu, scale: predictiveScale(post), nCyclesUsed: n };

  const open = cycles.at(-1);
  const qualityRows = (openConflict: boolean): Prediction['cycleQuality'] =>
    classified.map((c, i) => ({
      cycleId: c.record.id, quality: c.record.quality,
      ...(c.reason ? { reason: c.reason } : {}),
      ...(openConflict && i === classified.length - 1 ? { conflict: true } : {}),
    }));

  const base = { engineVersion: ENGINE_VERSION, asOf: today, cycleLength };
  if (gate.suspended) return { ...base, suspended: gate.suspended, flags: [], cycleQuality: qualityRows(false) };
  if (!open) return { ...base, flags: [], cycleQuality: qualityRows(false) };

  const start = open.start;
  const [modelLo80, modelHi80] = predictiveInterval(post, 0.8);
  const [modelLo95, modelHi95] = predictiveInterval(post, 0.95);
  // D-094: ranges from her own past forecast errors once there are enough; they widen the model's range always and narrow it
  // only when no life state is shaping the model
  const calib = conformalHalfWidths(keptLengths, prior, gate.lambda, settings.window);
  const sized = (lo: number, hi: number, q: number | undefined): [number, number] =>
    q === undefined ? [lo, hi] : gate.steady ? [post.m - q, post.m + q] : [Math.min(lo, post.m - q), Math.max(hi, post.m + q)];
  // after a loss: never narrower than the range from the post-loss cycles alone, centred on this point (D-094)
  const floorPost = gate.rangeWeight && fitWeighted(usable.filter((c) => (gate.rangeWeight as (c: CycleRecord) => number)(c) > 0)
    .map((c) => ({ x: c.length as number, w: (gate.rangeWeight as (c: CycleRecord) => number)(c) })), prior);
  const floored = (lo: number, hi: number, level: 0.8 | 0.95): [number, number] => {
    if (!floorPost) return [lo, hi];
    const [flo, fhi] = predictiveInterval(floorPost, level);
    const half = (fhi - flo) / 2;
    return [Math.min(lo, post.m - half), Math.max(hi, post.m + half)];
  };
  const [lo80, hi80] = floored(...sized(modelLo80, modelHi80, calib?.q80), 0.8);
  const [lo95, hi95] = floored(...sized(modelLo95, modelHi95, calib?.q95), 0.95);
  const on = (d: number): ISODate => addDays(start, d);
  const halfWidth = (hi80 - lo80) / 2;
  const nextConfidence: Confidence =
    n < 2 || halfWidth > NEXT_MEDIUM_MAX_HALFWIDTH ? 'low'
      : n >= NEXT_HIGH_MIN_CYCLES && halfWidth <= NEXT_HIGH_MAX_HALFWIDTH ? 'high' : 'medium';
  const nextPeriod: NonNullable<Prediction['nextPeriod']> = {
    point: on(post.m), i80: { lo: on(lo80), hi: on(hi80) }, i95: { lo: on(lo95), hi: on(hi95) },
    confidence: cap(nextConfidence, gate.confidenceCap),
    daysOfDataUsed: usable.reduce((s, c) => s + (c.length as number), 0),
  };

  // ovulation for the current cycle: biomarkers first, calendar otherwise (§4.5, §4.6)
  const bio = cycleBiomarkerOvulation(history, start, addDays(today, 1));
  let ov: OvulationEstimate | null = bio;
  if (!ov && gate.calendarEstimate) ov = calendarOvulation(post, fitLuteal(lutealLengths(cycles)), start);
  const ovulation: Prediction['ovulation'] = ov
    ? {
        point: ov.point, i80: ovulationInterval(ov, start), sd: ov.sd,
        confidence: cap(ov.confidence ?? confidenceGrade(ov.sd), gate.confidenceCap), basis: predictionBasis(ov.basis),
      }
    : undefined;
  const fertileDays = ov ? fertileDayProbabilities(ov, start, FERTILE_HORIZON_DAYS) : undefined;

  // phase
  const offset = diffDays(today, start);
  const menstrualEnd = open.end ?? addDays(start, DEFAULT_BLEED_DAYS - 1);
  const ovOffset = ov ? (ov.offset ?? diffDays(ov.point, start)) : undefined;
  const phase: NonNullable<Prediction['currentPhase']>['phase'] =
    today <= menstrualEnd ? 'menstrual'
      : today > nextPeriod.i80.hi ? 'late'
        : ovOffset === undefined ? 'follicular'
          : Math.abs(offset - ovOffset) <= OVULATORY_HALF_WINDOW_DAYS ? 'ovulatory'
            : offset < ovOffset ? 'follicular' : 'luteal';

  const flags = evaluateFlags(cycles, history.logs, settings, today, {
    ...(history.muted ? { muted: history.muted } : {}), ...(history.lastFlagRaised ? { lastRaised: history.lastFlagRaised } : {}),
    upper95: modelHi95, ...(gate.missedGapDays !== undefined ? { gapDays: gate.missedGapDays } : {}),
  });

  return {
    ...base,
    nextPeriod,
    ...(ovulation ? { ovulation } : {}),
    ...(fertileDays ? { fertileDays } : {}),
    currentPhase: { phase, dayOfCycle: offset + 1 },
    flags,
    cycleQuality: qualityRows(Boolean(bio?.conflict)),
  };
}
