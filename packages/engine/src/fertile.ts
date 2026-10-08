// PLAN.md §4.8: probability that each calendar day lies inside the six-day fertile window.
import { addDays, diffDays } from './dates';
import { FERTILE_WINDOW_DAYS } from './params';
import { normalCdf } from './studentT';
import type { ISODate, OvulationEstimate } from './types';

const MIN_P = 0.01;

/** p(d) = P(d <= O <= d + 5) with O ~ N(E[O], SD[O]); days are offsets from `cycleStart`. Never a single day. */
export function fertileDayProbabilities(ov: OvulationEstimate, cycleStart: ISODate, horizonDays: number): Array<{ date: ISODate; pInWindow: number }> {
  const e = ov.offset ?? diffDays(ov.point, cycleStart);
  const out: Array<{ date: ISODate; pInWindow: number }> = [];
  for (let d = 0; d <= horizonDays; d++) {
    const p = normalCdf((d + FERTILE_WINDOW_DAYS + 0.5 - e) / ov.sd) - normalCdf((d - 0.5 - e) / ov.sd);
    if (p >= MIN_P) out.push({ date: addDays(cycleStart, d), pInWindow: p });
  }
  return out;
}
