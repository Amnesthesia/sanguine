// PLAN.md §4.4: derive cycle lengths and classify each cycle before the model runs.
import { addDays, diffDays } from './dates';
import { MAX_VALID_LENGTH, MIN_VALID_LENGTH } from './params';
import type { CycleRecord, EngineSettings, ISODate, LifeState } from './types';

export interface ClassifyOptions {
  excluded?: ISODate[]; // cycle starts the user excluded
  confirmedLong?: ISODate[]; // cycle starts the user re-admitted
}
export interface Classified { record: CycleRecord; reason?: string }

/** D-094: fewest cycles in the pool before each cycle is judged by the limit as of its own closure. */
const MAD_AS_OF_MIN_POOL = 6;
const SUSPENDING: Array<LifeState['kind']> = ['hormonal_contraception', 'pregnant'];

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** median + max(floor, 3 * 1.4826 * MAD): the long-cycle exclusion threshold. */
export function madThreshold(lengths: number[], floor: number): number {
  const med = median(lengths);
  const mad = median(lengths.map((x) => Math.abs(x - med)));
  return med + Math.max(floor, 3 * 1.4826 * mad);
}

function lifeStateStart(s: LifeState): ISODate {
  switch (s.kind) {
    case 'none': return '9999-12-31';
    case 'post_contraception': return s.stopped;
    case 'postpartum': return s.delivered;
    default: return s.since;
  }
}

function overlapsSuspendingState(start: ISODate, lastDay: ISODate | undefined, settings: EngineSettings): boolean {
  return settings.lifeStates.some((s) => {
    // the cycle that spans the delivery day is not a normal cycle; cycles after it are handled by the warm-up (lifestate.ts)
    if (s.kind === 'postpartum') return start < s.delivered && (lastDay === undefined || lastDay >= s.delivered);
    if (!SUSPENDING.includes(s.kind)) return false;
    const from = lifeStateStart(s);
    // cycle [start, lastDay] intersects [from, until]; an open cycle has no last day
    return (lastDay === undefined || lastDay >= from) && (s.until === undefined || start <= s.until);
  });
}

export function classifyDetailed(cycles: CycleRecord[], settings: EngineSettings, opts: ClassifyOptions = {}): Classified[] {
  const sorted = [...cycles].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const recs: CycleRecord[] = sorted.map((c, i) => {
    const next = sorted[i + 1];
    const out: CycleRecord = { ...c };
    delete out.nextStart; delete out.length; delete out.bleedDays;
    if (next) { out.nextStart = next.start; out.length = diffDays(next.start, c.start); }
    if (c.end) out.bleedDays = diffDays(c.end, c.start) + 1;
    return out;
  });
  const excluded = new Set(opts.excluded ?? []);
  const confirmed = new Set(opts.confirmedLong ?? []);
  const states = recs.map((c) =>
    overlapsSuspendingState(c.start, c.nextStart ? addDays(c.nextStart, -1) : undefined, settings) ? 'life_state'
      : excluded.has(c.start) ? 'user_excluded' : 'ok');

  // MAD statistics over complete cycles that are in range and not excluded or life-state, as of each cycle's closure
  // (D-094): the cycles up to and including it, so a cycle kept when it closed is not dropped by a later one. Cycles closed
  // before the pool first reaches MAD_AS_OF_MIN_POOL use the limit of that moment; until then the limit over all of them.
  const irregular = settings.lifeStates.some((s) => s.kind === 'known_irregular');
  const floor = irregular ? 14 : 7;
  const pool: number[] = [];
  const asOf = recs.map((c, i) => {
    if (c.length !== undefined && states[i] === 'ok' && c.length >= MIN_VALID_LENGTH && c.length <= MAX_VALID_LENGTH) pool.push(c.length);
    return pool.length >= MAD_AS_OF_MIN_POOL ? madThreshold(pool, floor) : undefined;
  });
  const first = asOf.find((t) => t !== undefined) ?? (pool.length >= 3 ? madThreshold(pool, floor) : Number.POSITIVE_INFINITY);

  return recs.map((c, i) => {
    const threshold = asOf[i] ?? first;
    const out = (quality: CycleRecord['quality'], reason?: string): Classified => ({ record: { ...c, quality }, ...(reason ? { reason } : {}) });
    if (states[i] === 'life_state') return out('life_state', 'overlaps a life state that pauses estimates');
    if (states[i] === 'user_excluded') return out('user_excluded', 'excluded by you');
    const len = c.length;
    if (len === undefined) return out('valid');
    if (len < MIN_VALID_LENGTH) return out('suspect_short', `shorter than ${MIN_VALID_LENGTH} days`);
    if (len > MAX_VALID_LENGTH) return out('suspect_skip', `longer than ${MAX_VALID_LENGTH} days`);
    if (len > threshold && !confirmed.has(c.start)) return out('suspect_skip', `longer than ${threshold.toFixed(1)} days, the usual limit for your cycles`);
    return out('valid');
  });
}

export function classifyCycles(cycles: CycleRecord[], settings: EngineSettings, opts: ClassifyOptions = {}): CycleRecord[] {
  return classifyDetailed(cycles, settings, opts).map((x) => x.record);
}
