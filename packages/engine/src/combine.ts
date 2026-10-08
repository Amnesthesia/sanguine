// PLAN.md §4.6 conflict resolution, §4.8 confidence, S5 (one temperature series).
import { addDays } from './dates';
import {
  SHIFT_GATE_AFTER_DAYS, SHIFT_GATE_BEFORE_DAYS, SIGNAL_CONFLICT_DAYS,
} from './params';
import { confidenceGrade } from './ovulation';
import type { Confidence, OvulationEstimate } from './types';

const CERVIX_WEIGHT_CAP = 0.25; // fraction of the other signals' total weight
const PRECISE: Array<OvulationEstimate['basis']> = ['lh', 'mucus'];
const TEMPERATURE: Array<OvulationEstimate['basis']> = ['bbt', 'wearable'];

const offsetOf = (e: OvulationEstimate): number => e.offset as number;

/** Combine biomarker estimates for one cycle. Returns null when there is nothing usable. */
export function combineOvulation(estimates: OvulationEstimate[]): OvulationEstimate | null {
  let signals = estimates.filter((e) => !e.indeterminate && e.offset !== undefined);
  if (signals.length === 0) return null;
  let conflict = false;

  // one temperature series only: oral/vaginal BBT before wearable
  const oral = signals.find((e) => e.basis === 'bbt');
  signals = signals.filter((e) => !(e.basis === 'wearable' && oral));

  // temporal gate against the most precise LH/mucus estimate
  const refs = signals.filter((e) => PRECISE.includes(e.basis)).sort((a, b) => a.sd - b.sd);
  const ref = refs[0];
  if (ref) {
    const kept = signals.filter((e) => {
      if (!TEMPERATURE.includes(e.basis)) return true;
      const delta = offsetOf(e) - offsetOf(ref);
      return delta >= -SHIFT_GATE_BEFORE_DAYS && delta <= SHIFT_GATE_AFTER_DAYS;
    });
    if (kept.length !== signals.length) conflict = true;
    signals = kept;
  }

  // disagreement: any two kept signals more than 3 days apart
  const offs = signals.map(offsetOf);
  if (Math.max(...offs) - Math.min(...offs) > SIGNAL_CONFLICT_DAYS) {
    const best = [...signals].sort((a, b) => a.sd - b.sd)[0] as OvulationEstimate;
    return { point: best.point, offset: offsetOf(best), sd: best.sd, basis: best.basis, confidence: 'low', conflict: true };
  }

  if (signals.length === 1) {
    const only = signals[0] as OvulationEstimate;
    return { point: only.point, offset: offsetOf(only), sd: only.sd, basis: only.basis, confidence: capConfidence(only.sd, [only]), ...(conflict ? { conflict } : {}) };
  }

  // inverse-variance weighted mean, cervix weight capped
  const raw = signals.map((e) => 1 / (e.sd * e.sd));
  const others = signals.reduce((s, e, i) => (e.basis === 'cervix' ? s : s + (raw[i] as number)), 0);
  const w = signals.map((e, i) => (e.basis === 'cervix' && others > 0 ? Math.min(raw[i] as number, CERVIX_WEIGHT_CAP * others) : (raw[i] as number)));
  const wSum = w.reduce((a, b) => a + b, 0);
  const offset = signals.reduce((s, e, i) => s + (w[i] as number) * offsetOf(e), 0) / wSum;
  const sd = Math.sqrt(1 / wSum);
  const first = signals[0] as OvulationEstimate;
  return {
    point: addDays(first.point, Math.round(offset - offsetOf(first)) + 0), offset, sd, basis: 'combined',
    confidence: capConfidence(sd, signals), ...(conflict ? { conflict } : {}),
  };
}

/** High needs an LH or mucus signal (§4.8); temperature and cervix alone stay at medium or below. */
function capConfidence(sd: number, kept: OvulationEstimate[]): Confidence {
  const g = confidenceGrade(sd);
  return g === 'high' && !kept.some((e) => PRECISE.includes(e.basis)) ? 'medium' : g;
}
