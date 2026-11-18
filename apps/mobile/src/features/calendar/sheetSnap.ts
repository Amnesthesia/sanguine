// The day sheet's detents and how a drag settles (P8-23). Pure and worklet-safe: SheetMotion runs these on the UI thread, tests run them directly.

/** closed: the compact bar above the tab bar; small: the open sheet; large: the full detail. */
export type Detent = 'closed' | 'small' | 'large';
/** The sheet's height at each detent, in points. */
export interface Snaps { closed: number; small: number; large: number }

/** A release faster than this (pt/s) is a flick: it goes to the next detent in its direction. */
export const FLICK_VELOCITY = 600;
/** Under Reduce Motion a release still animates, as a short timing instead of a spring. */
export const REDUCED_MS = 160;
export const SPRING = { damping: 26, stiffness: 260, mass: 1 } as const;

/** One step up (1) or down (-1), clamped: the grabber, Show details, the close button and the scrim. */
export function nextDetent(d: Detent, step: 1 | -1): Detent {
  if (step > 0) return d === 'closed' ? 'small' : 'large';
  return d === 'large' ? 'small' : 'closed';
}

/** The sheet's height under the finger: one to one between the bar and the large detent, a fifth of the movement past either end. */
export function dragHeight(start: number, translationY: number, s: Snaps): number {
  'worklet';
  const raw = start - translationY;
  if (raw > s.large) return s.large + (raw - s.large) * 0.2;
  if (raw < s.closed) return s.closed - (s.closed - raw) * 0.2;
  return raw;
}

/** Where a release settles: a flick (velocityY in pt/s, positive down) goes to the next detent past height `h` in its direction; otherwise the nearest. */
export function snapDetent(h: number, velocityY: number, s: Snaps): Detent {
  'worklet';
  if (velocityY < -FLICK_VELOCITY) return s.closed > h + 1 ? 'closed' : s.small > h + 1 ? 'small' : 'large';
  if (velocityY > FLICK_VELOCITY) return s.large < h - 1 ? 'large' : s.small < h - 1 ? 'small' : 'closed';
  const near = (d: Detent, than: Detent) => Math.abs(s[d] - h) < Math.abs(s[than] - h);
  return near('large', 'small') && near('large', 'closed') ? 'large' : near('small', 'closed') ? 'small' : 'closed';
}

/** Which detent's content the sheet shows at height `h`: the next one's once the sheet is a quarter of the way to it. */
export function shownAt(h: number, s: Snaps): Detent {
  'worklet';
  if (h > s.small + (s.large - s.small) * 0.25) return 'large';
  if (h > s.closed + (s.small - s.closed) * 0.25) return 'small';
  return 'closed';
}

export type Settle = { kind: 'spring'; velocity: number } | { kind: 'timing'; duration: number };
/** How the sheet moves to its detent: a spring carrying the finger's velocity (the height grows upward, so it is negated), or a short timing under Reduce Motion. */
export function settle(reduce: boolean, velocityY: number): Settle {
  'worklet';
  return reduce ? { kind: 'timing', duration: REDUCED_MS } : { kind: 'spring', velocity: -velocityY };
}
