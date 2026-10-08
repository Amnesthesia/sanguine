// PLAN.md §4.1, §4.11: the engine entry point. Pure and deterministic: no clock, no randomness, no I/O.
// Symptoms are never read here: `DailyLog.symptoms` is carried for the UI and ignored by every function in this package.
import { detectBbtShift, detectWearableShift } from './bbt';
import { classifyDetailed } from './classify';
import { combineOvulation } from './combine';
import { detectCervixPeak } from './cervix';
import { cyclePrior, fitWeighted, predictiveInterval, predictiveScale, predictiveVariance } from './cycleLength';
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

export function predict(history: History, settings: EngineSettings, today: ISODate): Prediction {
  const classified = classifyDetailed(history.cycles, settings, { excluded: history.excluded, confirmedLong: history.confirmedLong });
  let cycles: CycleRecord[] = classified.map((c) => c.record);

  // retrospective biomarker ovulation for closed cycles; a stored estimate stays when no biomarker data exists
  cycles = cycles.map((c) => {
    if (!c.nextStart) return c;
    const est = cycleBiomarkerOvulation(history, c.start, c.nextStart);
    return est ? { ...c, ovulation: { point: est.point, offset: est.offset, sd: est.sd, basis: est.basis, confidence: est.confidence } } : c;
  });

  const gate = evaluateLifeStates(cycles, settings, today);
  const prior = cyclePrior(settings.birthYear, today, { varianceScale: gate.varianceScale });

  // cycle-length model over valid cycles (weights: recency x warm-up multiplier)
  const usable = cycles.filter((c) => c.quality === 'valid' && c.length !== undefined && gate.cycleWeight(c) > 0).slice(-settings.window);
  const n = usable.length;
  const obs = usable.map((c, i) => ({ x: c.length as number, w: gate.lambda ** (n - 1 - i) * gate.cycleWeight(c) }));
  if (settings.usualCycleLength !== undefined) obs.unshift({ x: settings.usualCycleLength, w: 0.5 });
  const post: NigPosterior = fitWeighted(obs, prior);
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
  const [lo80, hi80] = predictiveInterval(post, 0.8);
  const [lo95, hi95] = predictiveInterval(post, 0.95);
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
    upper95: hi95, ...(gate.missedGapDays !== undefined ? { gapDays: gate.missedGapDays } : {}),
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
