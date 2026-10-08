// PLAN.md §4.6 cervical mucus: ovulation = peak day, SD 1.5.
import { addDays, diffDays } from './dates';
import { MUCUS_SD } from './params';
import type { ISODate, MucusObs, OvulationEstimate } from './types';

const PERSIST_DAYS = 3;

export function detectMucusPeak(obs: MucusObs[], cycleStart: ISODate): OvulationEstimate | null {
  const inCycle = obs.filter((o) => o.date >= cycleStart);
  const byDate = new Map(inCycle.map((o) => [o.date, o]));
  const fertile = (o: MucusObs) => o.quality === 'eggwhite' || o.quality === 'watery';
  const dry = (o?: MucusObs) => o !== undefined && (o.quality === 'sticky' || o.quality === 'dry');

  let peak: MucusObs | undefined;
  for (const o of [...inCycle].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (!fertile(o)) continue;
    const confirmed = Array.from({ length: PERSIST_DAYS }, (_, k) => byDate.get(addDays(o.date, k + 1))).every(dry);
    if (confirmed) peak = o; // the last confirmed patch wins
  }
  if (!peak) return null;
  const factor = peak.provenance === 'imported' ? 2 : 1;
  return {
    point: peak.date, offset: diffDays(peak.date, cycleStart), sd: MUCUS_SD * factor, basis: 'mucus',
    confidence: MUCUS_SD * factor <= 1.5 ? 'medium' : 'low',
  };
}
