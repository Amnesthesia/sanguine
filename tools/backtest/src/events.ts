// P8-12 (D-091): synthetic users with one life event each, as dated timelines. Parameters from the D-091 research:
// early loss at 6-12 weeks, first bleed 4-6 weeks later (ACOG), first post-loss cycles somewhat longer; anovulatory long
// cycles add 2-4 weeks; luteal 12.4 d (Bull 2019, 95% range 7-17). Tooling only; the engine never uses randomness.
import { addDays, diffDays } from '@sanguine/engine';
import type { CycleRecord, EngineSettings, History, ISODate, LhTest } from '@sanguine/engine';
import type { Rng } from './rng';
import type { User } from './synth';

export type EventKind = 'none' | 'skip' | 'long' | 'short' | 'loss' | 'step';
export const EVENTS: EventKind[] = ['none', 'skip', 'long', 'short', 'loss', 'step'];
export const EVENT_AT = 8; // the event happens in the ninth cycle

export interface Timeline {
  /** True period starts (a loss's ending bleed is not one: it is listed in `lossBleed`). */
  starts: ISODate[];
  /** What the user logged: `skip` leaves one start out, `short` adds a mid-cycle bleed logged as a period. */
  observed: ISODate[];
  /** True ovulation day per true start (none for the pregnancy cycle). */
  ovulation: Map<ISODate, ISODate>;
  lossBleed?: ISODate; // first day of bleeding after a loss
  /** Life states the user would mark for the event (only `loss`). */
  lifeStates: EngineSettings['lifeStates'];
}

const T0: ISODate = '2024-01-01';
const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(x)));

export function timeline(rng: Rng, u: User, n: number, event: EventKind): Timeline {
  const starts: ISODate[] = [T0];
  const ovulation = new Map<ISODate, ISODate>();
  const observed: ISODate[] = [];
  let lossBleed: ISODate | undefined;
  let lifeStates: EngineSettings['lifeStates'] = [];
  for (let i = 0; i < n; i++) {
    const start = starts[i] as ISODate;
    const mu = u.mu + (event === 'step' && i >= EVENT_AT ? 5 : 0) + (event === 'loss' && (i === EVENT_AT + 1 || i === EVENT_AT + 2) ? rng.uniform(0, 7) : 0);
    let len = clip(rng.normal(mu, u.sig), 18, 60);
    if (event === 'long' && i === EVENT_AT) len += Math.round(rng.uniform(14, 28));
    const luteal = clip(rng.normal(12.4, 1.5), 8, 17);
    if (event === 'loss' && i === EVENT_AT) {
      const loss = addDays(start, Math.round(rng.uniform(42, 84)));
      lossBleed = loss;
      lifeStates = [{ kind: 'pregnant', since: start, until: loss }, { kind: 'postpartum', delivered: loss, breastfeeding: false, after: 'loss' }];
      len = diffDays(addDays(loss, Math.round(rng.uniform(28, 42))), start);
    } else ovulation.set(start, addDays(start, Math.max(8, len - luteal - 1)));
    starts.push(addDays(start, len));
    if (!(event === 'skip' && i === EVENT_AT + 1)) observed.push(start);
    if (event === 'short' && i === EVENT_AT) observed.push(addDays(start, Math.min(len - 3, Math.round(rng.uniform(15, 19))))); // a mid-cycle bleed logged as a period
  }
  observed.push(starts[n] as ISODate);
  return { starts, observed, ovulation, ...(lossBleed ? { lossBleed } : {}), lifeStates };
}

/** Engine history from logged starts, plus LH tests (negative two days before, positive the day before ovulation) up to `until`. */
export function historyFrom(observed: ISODate[], until: ISODate, ovulation?: Map<ISODate, ISODate>): History {
  const cycles: CycleRecord[] = observed.filter((s) => s <= until).map((start, i) => ({ id: `c${i}`, start, end: addDays(start, 4), quality: 'valid' }));
  const lh: LhTest[] = [];
  for (const ov of ovulation?.values() ?? []) {
    for (const [d, result] of [[-2, 'negative'], [-1, 'positive']] as const) if (addDays(ov, d) <= until) lh.push({ date: addDays(ov, d), result, provenance: 'manual' });
  }
  return { cycles, temperatures: [], lh, mucus: [], cervix: [], logs: [] };
}
