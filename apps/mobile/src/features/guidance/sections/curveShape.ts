// The hormone curve drawn on the person's own cycle (D-155). The template curves are the typical 28-day shapes in a 326 wide picture; their x is
// stretched piecewise so the bleed ends where this cycle's bleed ends, the LH peak sits on this cycle's ovulation day and the picture ends on its last day.
export const W = 326;
/** Template x of the end of the bleed and of the ovulation peak, and the end of the cycle. */
const T_BLEED = 48;
const T_OV = 146;

type P = [number, number];

/** The points of a template path (absolute M, L, C and S only), curves sampled `steps` times; lines are cut up too so a stretch bends at the anchors. */
export function samplePath(d: string, steps = 14): P[] {
  const t = d.match(/[MLCS]|-?\d+(?:\.\d+)?/g) ?? [];
  const out: P[] = [];
  let i = 0;
  let cmd = '';
  let cur: P = [0, 0];
  let lastC2: P | undefined;
  const num = (): number => Number(t[i++]);
  while (i < t.length) {
    if (/[MLCS]/.test(t[i] as string)) cmd = t[i++] as string;
    if (cmd === 'M') { cur = [num(), num()]; out.push(cur); lastC2 = undefined; cmd = 'L'; continue; }
    if (cmd === 'L') {
      const e: P = [num(), num()];
      for (let s = 1; s <= steps; s++) out.push([cur[0] + ((e[0] - cur[0]) * s) / steps, cur[1] + ((e[1] - cur[1]) * s) / steps]);
      cur = e; lastC2 = undefined; continue;
    }
    const c1: P = cmd === 'C' ? [num(), num()] : lastC2 ? [2 * cur[0] - lastC2[0], 2 * cur[1] - lastC2[1]] : cur;
    const c2: P = [num(), num()];
    const e: P = [num(), num()];
    for (let s = 1; s <= steps; s++) {
      const u = s / steps; const v = 1 - u;
      out.push([v * v * v * cur[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * e[0], v * v * v * cur[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * e[1]]);
    }
    cur = e; lastC2 = c2;
  }
  return out;
}

/** Where the anchors fall on this cycle, in picture x. */
export interface Axis {
  /** Picture width per day. */
  perDay: number;
  /** End of the bleed. */
  bleedX: number;
  /** Centre of the ovulation day, or the typical place when the estimate is not drawn. */
  ovX: number;
  /** Whether this is the person's own cycle (else the generic 28-day picture). */
  own: boolean;
  /** Last day of the cycle, for the right-hand label. */
  length: number;
  x: (template: number) => number;
}

/** `ovulationDay` is a 0-based offset from day 1; leave it out to keep the typical place (the estimate is hidden, so the picture must not give the date away). */
export function cycleAxis(f: { length?: number | undefined; bleedDays: number; ovulationDay?: number | undefined } | undefined): Axis {
  const length = f?.length !== undefined ? Math.min(Math.max(Math.round(f.length), 18), 60) : undefined;
  if (!f || length === undefined) return { perDay: W / 28, bleedX: T_BLEED, ovX: T_OV, own: false, length: 28, x: (v) => v };
  const perDay = W / length;
  const bleedX = Math.min(Math.max(f.bleedDays * perDay, 20), W * 0.3);
  const typicalOv = T_OV * (length / 28);
  const ovX = Math.min(Math.max(f.ovulationDay === undefined ? typicalOv : (f.ovulationDay + 0.5) * perDay, bleedX + 20), W - 50);
  const x = (v: number): number => (v <= T_BLEED ? (v / T_BLEED) * bleedX : v <= T_OV ? bleedX + ((v - T_BLEED) / (T_OV - T_BLEED)) * (ovX - bleedX) : ovX + ((v - T_OV) / (W - T_OV)) * (W - ovX));
  return { perDay, bleedX, ovX, own: true, length, x };
}

/** A template path as an SVG path with its x moved through the axis. */
export function warpPath(d: string, a: Axis): string {
  return samplePath(d).map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${a.x(x).toFixed(1)},${y.toFixed(1)}`).join(' ');
}
