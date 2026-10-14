// Energy over time (P8-19, D-108): her own 1-5 ratings, averaged by part of the cycle, turned into look-back suggestions. Pure; never feeds the engine.
import { addDays, type ISODate } from '@sanguine/engine';
import type { GuideDay, GuidePhase } from '@/features/guidance/guidance';

export interface EnergyPoint { day: ISODate; level: number }
export interface PhaseEnergy { phase: GuidePhase; mean: number; n: number }
export type EnergySuggestion =
  | { kind: 'lowOverall'; mean: number; n: number }
  | { kind: 'lowPhase' | 'highPhase'; phase: GuidePhase; mean: number; overall: number; n: number };

export const ENERGY_WINDOW_DAYS = 84; // 12 weeks: about three cycles
export const MIN_ENERGY_DAYS = 10;
export const MIN_PHASE_DAYS = 4;
export const PHASE_GAP = 0.5; // on the 1-5 scale
export const LOW_OVERALL_DAYS = 28;
export const LOW_OVERALL_MIN = 10;
export const LOW_OVERALL_MEAN = 2;
export const MIN_CHART_POINTS = 5;
const ORDER: GuidePhase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal', 'premenstrual'];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (x: number) => Math.round(x * 10) / 10;
const lastDays = (points: EnergyPoint[], today: ISODate, days: number) => points.filter((p) => p.day > addDays(today, -days) && p.day <= today);

export function energyInsight(points: EnergyPoint[], today: ISODate, phaseOf: (day: ISODate) => GuideDay | undefined) {
  const window = lastDays(points, today, ENERGY_WINDOW_DAYS);
  const by = new Map<GuidePhase, number[]>();
  for (const p of window) {
    const ph = phaseOf(p.day)?.phase;
    if (ph && ph !== 'general') by.set(ph, [...(by.get(ph) ?? []), p.level]);
  }
  const byPhase: PhaseEnergy[] = ORDER.flatMap((phase) => {
    const xs = by.get(phase);
    return xs ? [{ phase, mean: round1(mean(xs)), n: xs.length }] : [];
  });

  const suggestions: EnergySuggestion[] = [];
  const recent = lastDays(points, today, LOW_OVERALL_DAYS);
  if (recent.length >= LOW_OVERALL_MIN && mean(recent.map((p) => p.level)) <= LOW_OVERALL_MEAN)
    suggestions.push({ kind: 'lowOverall', mean: round1(mean(recent.map((p) => p.level))), n: recent.length });
  const enough = byPhase.filter((b) => b.n >= MIN_PHASE_DAYS);
  if (window.length >= MIN_ENERGY_DAYS && enough.length >= 2) {
    const overall = round1(mean(window.map((p) => p.level)));
    const low = enough.reduce((a, b) => (b.mean < a.mean ? b : a));
    const high = enough.reduce((a, b) => (b.mean > a.mean ? b : a));
    if (low.mean <= overall - PHASE_GAP) suggestions.push({ kind: 'lowPhase', phase: low.phase, mean: low.mean, overall, n: low.n });
    if (high.mean >= overall + PHASE_GAP) suggestions.push({ kind: 'highPhase', phase: high.phase, mean: high.mean, overall, n: high.n });
  }
  return { window, byPhase, suggestions };
}

export const lowPhaseOf = (s: EnergySuggestion[]): GuidePhase | undefined => s.flatMap((x) => (x.kind === 'lowPhase' ? [x.phase] : []))[0];
