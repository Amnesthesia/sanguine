// P1-1 fills these in. Stubs keep the fixture tests failing for the right reason.
import type { NigPosterior, NigPrior } from './types';

export function fitCycleLength(_lengths: number[], _prior: NigPrior, _lambda: number): NigPosterior {
  throw new Error('NotImplemented: fitCycleLength');
}
export function predictiveInterval(_p: NigPosterior, _level: 0.8 | 0.95): [number, number] {
  throw new Error('NotImplemented: predictiveInterval');
}
