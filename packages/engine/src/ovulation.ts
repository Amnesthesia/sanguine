// PLAN.md §4.5 (luteal model, calendar-only ovulation) and §4.8 (confidence).
import { fitCycleLength, predictiveVariance } from './cycleLength';
import { addDays, diffDays } from './dates';
import { CONFIDENCE_HIGH_SD, CONFIDENCE_MEDIUM_SD, LUTEAL_PRIOR, Z80 } from './params';
import type { Confidence, CycleRecord, ISODate, Interval, NigPosterior, OvulationEstimate } from './types';

/** Luteal phase = days after ovulation up to the day before the next period: nextStart - ovulation - 1.
 *  Only valid cycles with a biomarker-dated ovulation count; calendar estimates would be circular. */
export function lutealLengths(cycles: CycleRecord[]): number[] {
  const out: number[] = [];
  for (const c of cycles) {
    if (c.quality !== 'valid' || !c.ovulation || !c.nextStart || c.ovulation.basis === 'calendar') continue;
    out.push(diffDays(c.nextStart, c.ovulation.point) - 1);
  }
  return out;
}

/** Luteal posterior; the luteal phase is the stable quantity so no recency weighting (lambda = 1). */
export function fitLuteal(lengths: number[]): NigPosterior {
  return fitCycleLength(lengths, LUTEAL_PRIOR, 1);
}

export function confidenceGrade(sd: number): Confidence {
  if (sd <= CONFIDENCE_HIGH_SD) return 'high';
  if (sd <= CONFIDENCE_MEDIUM_SD) return 'medium';
  return 'low';
}

/** E[O] = m_n - l_n; SD[O] = sqrt(Var L_next + Var luteal) (§4.5). Offset is days after `cycleStart`. */
export function calendarOvulation(cycle: NigPosterior, luteal: NigPosterior, cycleStart: ISODate): OvulationEstimate {
  const offset = cycle.m - luteal.m;
  const sd = Math.sqrt(predictiveVariance(cycle) + predictiveVariance(luteal));
  return { point: addDays(cycleStart, offset), offset, sd, basis: 'calendar', confidence: confidenceGrade(sd) };
}

/** 80% interval on the normal approximation, as dates. */
export function ovulationInterval(o: OvulationEstimate, cycleStart: ISODate): Interval {
  const offset = o.offset ?? diffDays(o.point, cycleStart);
  return { lo: addDays(cycleStart, offset - Z80 * o.sd), hi: addDays(cycleStart, offset + Z80 * o.sd) };
}
