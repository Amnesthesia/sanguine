// PLAN.md §4.6 LH: first positive after a negative; ovulation = test day + 1.
import { addDays, diffDays } from './dates';
import { LH_OFFSET_DAYS, LH_SD, LH_SD_LONG_RUN, LH_SD_NO_PRIOR_NEGATIVE } from './params';
import type { ISODate, LhTest, OvulationEstimate } from './types';

const MAX_NORMAL_RUN_DAYS = 3;

export function detectLhSurge(tests: LhTest[], cycleStart: ISODate): OvulationEstimate | null {
  const inCycle = tests.filter((t) => t.date >= cycleStart).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const positive = (t: LhTest) => t.result === 'positive' || t.result === 'peak';
  const first = inCycle.find(positive);
  if (!first) return null;

  const priorNegative = inCycle.some((t) => t.result === 'negative' && diffDays(first.date, t.date) >= 1 && diffDays(first.date, t.date) <= 2);
  let run = 0;
  while (inCycle.some((t) => t.date === addDays(first.date, run) && positive(t))) run++;
  const long = run > MAX_NORMAL_RUN_DAYS;

  const factor = first.provenance === 'imported' ? 1.5 : 1;
  const baseSd = long ? LH_SD_LONG_RUN : priorNegative ? LH_SD : LH_SD_NO_PRIOR_NEGATIVE;
  const point = addDays(first.date, LH_OFFSET_DAYS);
  return {
    point, offset: diffDays(point, cycleStart), sd: baseSd * factor, basis: 'lh',
    confidence: long ? 'low' : baseSd * factor <= 1.5 ? 'high' : 'medium',
    ...(long ? { indeterminate: true } : {}),
  };
}
