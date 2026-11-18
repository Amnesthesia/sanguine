// Pure helpers for Insights and the cycle page: the length summary shown when cycles vary, the plain sentence under each chart,
// and the cycle timeline. Descriptions of her own logs; none of them feeds the engine.
import type { Confidence, CycleRecord, ISODate, LhTest } from '@sanguine/engine';
import type { Phase } from './insightsModel';

const SUMMARY_CYCLES = 6;
const MIN_SUMMARY_CYCLES = 3;

export interface LengthSummary { min: number; max: number; spread: number; lengths: number[]; confidence: Confidence }

/** Closed cycle lengths, oldest first, when the next-period estimate is rough (§8.2: "cycles that vary so much the range is wider than about 11 days").
 *  An excluded cycle stays in the list: the list shows what happened, the estimate is what leaves it out. */
export function lengthSummary(cycles: CycleRecord[], confidence: Confidence | undefined): LengthSummary | undefined {
  if (confidence !== 'low') return undefined;
  const lengths = cycles.filter((c) => c.length !== undefined).map((c) => c.length as number).slice(-SUMMARY_CYCLES);
  if (lengths.length < MIN_SUMMARY_CYCLES) return undefined;
  const [min, max] = [Math.min(...lengths), Math.max(...lengths)];
  return { min, max, spread: max - min, lengths, confidence };
}

export type LengthReading = { key: 'same'; n: number; len: number } | { key: 'range'; n: number; min: number; max: number };
export function lengthReading(lengths: number[]): LengthReading {
  const [min, max] = [Math.min(...lengths), Math.max(...lengths)];
  return min === max ? { key: 'same', n: lengths.length, len: min } : { key: 'range', n: lengths.length, min, max };
}

/** Only when the last three readings agree; a mixed picture gets no sentence rather than a guess. */
export function tempReading(values: number[], coverline: number | undefined): 'above' | 'below' | undefined {
  if (coverline === undefined || values.length < 3) return undefined;
  const last = values.slice(-3);
  return last.every((v) => v > coverline) ? 'above' : last.every((v) => v < coverline) ? 'below' : undefined;
}

/** The one phase with the strictly highest share; nothing on a tie or when the symptom never appears. */
export function phaseReading(share: Record<Phase, number>): Phase | undefined {
  const order = (Object.keys(share) as Phase[]).sort((a, b) => share[b] - share[a]);
  const [top, next] = order;
  return top && share[top] > 0 && (next === undefined || share[top] > share[next]) ? top : undefined;
}

export interface TimelineEntry { kind: 'started' | 'bleeding' | 'lh' | 'rise' | 'next'; from: ISODate; to?: ISODate }

/** One cycle's signals in date order. LH and temperature rows are fertility signals: dropped when the gate (`fertilityTools`) is off. */
export function cycleTimeline(c: CycleRecord, lh: Array<Pick<LhTest, 'date' | 'result'>>, riseDay: ISODate | undefined, fertilityTools: boolean): TimelineEntry[] {
  const inCycle = (d: ISODate) => d >= c.start && (c.nextStart === undefined || d < c.nextStart);
  const positive = fertilityTools ? lh.filter((x) => (x.result === 'positive' || x.result === 'peak') && inCycle(x.date)).map((x) => x.date).sort()[0] : undefined;
  const rise = fertilityTools && riseDay !== undefined && inCycle(riseDay) ? riseDay : undefined;
  const out: TimelineEntry[] = [{ kind: 'started', from: c.start }];
  if (c.end) out.push({ kind: 'bleeding', from: c.start, to: c.end });
  if (positive) out.push({ kind: 'lh', from: positive });
  if (rise) out.push({ kind: 'rise', from: rise });
  if (c.nextStart) out.push({ kind: 'next', from: c.nextStart });
  return out;
}
