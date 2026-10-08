// PLAN.md §4.6 cervical position: last high day of a high/soft/open run followed by low/firm/closed. SD 2.5 (V-07).
import { diffDays } from './dates';
import { CERVIX_SD } from './params';
import type { CervixObs, ISODate, OvulationEstimate } from './types';

const MIN_RUN_DAYS = 2;
const MAX_GAP_TO_CLOSED_DAYS = 3;

export function detectCervixPeak(obs: CervixObs[], cycleStart: ISODate): OvulationEstimate | null {
  const sorted = obs.filter((o) => o.date >= cycleStart).sort((a, b) => (a.date < b.date ? -1 : 1));
  const open = (o: CervixObs) => o.position === 'high' && o.firmness === 'soft' && o.opening === 'open';
  const shut = (o: CervixObs) => o.position === 'low' && o.firmness === 'firm' && o.opening === 'closed';
  let best: ISODate | undefined;
  for (let i = 0; i < sorted.length; i++) {
    const o = sorted[i] as CervixObs;
    if (!open(o)) continue;
    // extend the run over consecutive dates
    let end = i;
    while (end + 1 < sorted.length && open(sorted[end + 1] as CervixObs) && diffDays((sorted[end + 1] as CervixObs).date, (sorted[end] as CervixObs).date) === 1) end++;
    const last = sorted[end] as CervixObs;
    const after = sorted[end + 1];
    if (end - i + 1 >= MIN_RUN_DAYS && after && shut(after) && diffDays(after.date, last.date) <= MAX_GAP_TO_CLOSED_DAYS) best = last.date;
    i = end;
  }
  if (!best) return null;
  return { point: best, offset: diffDays(best, cycleStart), sd: CERVIX_SD, basis: 'cervix', confidence: 'medium' };
}
