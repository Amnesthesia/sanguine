// Food, movement and supplement notes by cycle phase (P8-18, D-107). Pure: which phase a date sits in, and how strong each note's evidence is.
// Wording: copy/en-AU.json guidance.*. Research: docs/superpowers/plans/2026-10-14-cycle-food-movement-notes.md.
import { addDays, type CycleRecord, diffDays, type ISODate, LUTEAL_PRIOR, type Prediction } from '@sanguine/engine';
import { ovulationUncertain } from '@/features/today/fertileShown';

export type GuidePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal' | 'premenstrual' | 'general';
export type Evidence = 'strong' | 'some' | 'early' | 'general';
export type SuppId = 'ginger' | 'omega3' | 'zinc' | 'calcium' | 'b6' | 'magnesium';
export type FoodId = 'iron' | 'omega3' | 'vitaminC' | 'bVitamins' | 'zinc' | 'fibre' | 'vitaminDB6' | 'protein' | 'magnesium' | 'b12' | 'calcium' | 'carbs';
/** The person's own cycle in day offsets from its first day (0 = day 1), for drawing the hormone curve on their dates (D-155). */
export interface CycleFrame {
  /** Where the date sits in the cycle. */
  day: number;
  /** Cycle length: the logged length of a closed cycle, else the days to the most likely next period. Absent when there is no forecast. */
  length?: number;
  bleedDays: number;
  /** The ovulation day and, for an open cycle, its 80% range. Absent while the estimate is uncertain or missing, and for a cycle merged by a missed log. */
  ovulationDay?: number;
  ovulationRange?: { lo: number; hi: number };
}
export interface GuideDay { phase: GuidePhase; expected: boolean; frame?: CycleFrame }
export interface PhaseOnInput {
  date: ISODate;
  today: ISODate;
  prediction: Prediction | undefined;
  /** analyzeCycles(history, settings).map((c) => c.record): carries nextStart, quality and biomarker ovulation. */
  cycles: CycleRecord[];
  /** Effective ovulation-estimate preference (teen mode and SHOW_OVULATION_ESTIMATE folded in). Off: no ovulatory phase. */
  showEstimate: boolean;
}

export const GUIDE_PHASES: readonly GuidePhase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal', 'premenstrual', 'general'];
type Graded<T> = ReadonlyArray<{ id: T; evidence: Evidence }>;
/** Evidence grade per food note, movement note and supplement; the plan's research tables justify each one. */
export const GUIDANCE: Record<GuidePhase, { foods: Graded<FoodId>; move: Evidence; supps: Graded<SuppId> }> = {
  menstrual: {
    foods: [{ id: 'iron', evidence: 'strong' }, { id: 'omega3', evidence: 'early' }], move: 'strong',
    supps: [{ id: 'ginger', evidence: 'some' }, { id: 'omega3', evidence: 'some' }, { id: 'zinc', evidence: 'some' }],
  },
  follicular: { foods: [{ id: 'vitaminC', evidence: 'strong' }, { id: 'bVitamins', evidence: 'early' }, { id: 'zinc', evidence: 'early' }], move: 'strong', supps: [] },
  ovulatory: { foods: [{ id: 'fibre', evidence: 'early' }, { id: 'vitaminDB6', evidence: 'early' }], move: 'some', supps: [] },
  luteal: { foods: [{ id: 'protein', evidence: 'early' }, { id: 'magnesium', evidence: 'early' }, { id: 'b12', evidence: 'general' }], move: 'strong', supps: [] },
  premenstrual: {
    foods: [{ id: 'calcium', evidence: 'some' }, { id: 'carbs', evidence: 'early' }], move: 'strong',
    supps: [{ id: 'calcium', evidence: 'some' }, { id: 'b6', evidence: 'early' }, { id: 'magnesium', evidence: 'early' }],
  },
  general: { foods: [{ id: 'iron', evidence: 'strong' }, { id: 'calcium', evidence: 'some' }], move: 'strong', supps: [] },
};

/** D-107: supplements are hidden under 18, and the teen estimate unlock does not change that (conservative default, no clinician). */
export const SUPPLEMENTS_FOR_TEENS = false;
export const showSupplements = (teen: boolean): boolean => !teen || SUPPLEMENTS_FOR_TEENS;

/** Days before the most likely next start that count as premenstrual (Draper 2018's fifth phase). */
export const PREMENSTRUAL_DAYS = 5;
// ponytail: these two mirror private constants in packages/engine/src/predict.ts; this feature must not touch the engine
const OVULATORY_HALF_WINDOW = 1;
const BLEED_DAYS_IF_UNLOGGED = 5;

/** The cycle's own dates as offsets, from the same sources phaseOn() uses below: a closed valid cycle's biomarker ovulation or the luteal prior counted
 *  back from its next start (§4.5); an open cycle's forecast, with its ovulation only while the estimate is not uncertain. */
function frameOf(cycle: CycleRecord, p: Prediction, date: ISODate, bleedEnd: ISODate): CycleFrame {
  const off = (d: ISODate): number => diffDays(d, cycle.start);
  const frame: CycleFrame = { day: off(date), bleedDays: Math.max(1, off(bleedEnd) + 1) };
  if (cycle.nextStart) {
    frame.length = off(cycle.nextStart);
    if (cycle.quality === 'valid') frame.ovulationDay = off(cycle.ovulation?.point ?? addDays(cycle.start, Math.round(frame.length - LUTEAL_PRIOR.m0 - 1)));
  } else if (p.nextPeriod) {
    frame.length = off(p.nextPeriod.point);
    if (p.ovulation && !ovulationUncertain(p)) { frame.ovulationDay = off(p.ovulation.point); frame.ovulationRange = { lo: off(p.ovulation.i80.lo), hi: off(p.ovulation.i80.hi) }; }
  }
  return frame;
}

export function phaseOn({ date, today, prediction: p, cycles, showEstimate }: PhaseOnInput): GuideDay | undefined {
  if (!p || p.suspended) return undefined;
  let cycle: CycleRecord | undefined;
  for (const c of cycles) if (c.start <= date && (!cycle || c.start > cycle.start)) cycle = c;
  if (!cycle || cycle.quality === 'life_state') return undefined;
  const expected = date > today;
  const bleedEnd = !cycle.nextStart && p.currentBleed ? p.currentBleed.point : (cycle.end ?? addDays(cycle.start, BLEED_DAYS_IF_UNLOGGED - 1));
  const frame = frameOf(cycle, p, date, bleedEnd);
  const at = (phase: GuidePhase): GuideDay => ({ phase, expected, frame });
  if (date <= bleedEnd) return at('menstrual');

  let nextStart: ISODate;
  let ovulationDay: ISODate;
  if (cycle.nextStart) {
    if (cycle.quality !== 'valid') return at('general');
    nextStart = cycle.nextStart;
    ovulationDay = cycle.ovulation?.point ?? addDays(cycle.start, Math.round(diffDays(nextStart, cycle.start) - LUTEAL_PRIOR.m0 - 1)); // §4.5 offset m − ℓ − 1
  } else {
    const next = p.nextPeriod;
    if (!next || date > next.i80.hi) return expected ? undefined : at('general'); // late, or beyond the forecast
    if (expected && date >= next.i80.lo) return at('menstrual');
    if (!p.ovulation || ovulationUncertain(p)) return at('general');
    nextStart = next.point;
    ovulationDay = p.ovulation.point;
  }
  if (date >= addDays(nextStart, -PREMENSTRUAL_DAYS)) return at('premenstrual');
  const d = diffDays(date, ovulationDay);
  if (Math.abs(d) <= OVULATORY_HALF_WINDOW && showEstimate) return at('ovulatory');
  return at(d < 0 ? 'follicular' : 'luteal');
}
