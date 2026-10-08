// Golden fixtures A-I, PLAN.md §4.12. Helpers to build the histories.
import { addDays } from './dates';
import type { CycleRecord, EngineSettings, History, ISODate } from './types';

export const LAST_START: ISODate = '2026-10-01';
export const TODAY: ISODate = '2026-10-10';

/** Fixtures use lambda = 1: the plan's numbers were computed with the prototype (no recency weighting). See D-015. */
export const FIXTURE_SETTINGS: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };

export function emptyHistory(): History {
  return { cycles: [], temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
}

/** Cycle lengths oldest first; the last logged start is `lastStart`, so there is one open cycle at the end. */
export function historyFromLengths(lengths: number[], lastStart: ISODate = LAST_START): History {
  const starts: ISODate[] = [lastStart];
  for (let i = lengths.length - 1; i >= 0; i--) starts.unshift(addDays(starts[0] as ISODate, -(lengths[i] as number)));
  const cycles: CycleRecord[] = starts.map((start, i) => ({
    id: `c${i + 1}`, start, end: addDays(start, 4), quality: 'valid' as const,
  }));
  return { ...emptyHistory(), cycles };
}
