// The splash's large crescent (D-154): the emblem's own crescent fitted with two circles by
// docs/design/splash-transition/trace.py and scaled so the moon's radius is 78 pt. The bite is the circle taken out of the
// moon's disk; the app is revealed through it at the end of the splash.

/** The bite's centre relative to the moon's centre, and its radius, in points (the left horn is the higher one, as in the emblem). */
export const MOON_R = 78;
export const BITE = { dx: 6.35, dy: -12.28, r: 73.11 } as const;

export type Circle = { x: number; y: number; r: number };

export function circles(cx: number, cy: number): { moon: Circle; bite: Circle } {
  return { moon: { x: cx, y: cy, r: MOON_R }, bite: { x: cx + BITE.dx, y: cy + BITE.dy, r: BITE.r } };
}

/** The two points where the circles cross: the horn tips, left one first. */
export function horns(a: Circle, b: Circle): [[number, number], [number, number]] {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const along = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(a.r * a.r - along * along, 0));
  const mx = a.x + (along * (b.x - a.x)) / d, my = a.y + (along * (b.y - a.y)) / d;
  const p: [number, number] = [mx + (h * (b.y - a.y)) / d, my - (h * (b.x - a.x)) / d];
  const q: [number, number] = [mx - (h * (b.y - a.y)) / d, my + (h * (b.x - a.x)) / d];
  return p[0] < q[0] ? [p, q] : [q, p];
}

/** Points on circle c from p0 to p1 the long way round (under the bowl). */
function arc(c: Circle, p0: [number, number], p1: [number, number], n: number): string[] {
  const a0 = Math.atan2(p0[1] - c.y, p0[0] - c.x);
  let da = (Math.atan2(p1[1] - c.y, p1[0] - c.x) - a0 + 4 * Math.PI) % (2 * Math.PI);
  if (da < Math.PI) da -= 2 * Math.PI;
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + (da * i) / n;
    return `${(c.x + c.r * Math.cos(a)).toFixed(2)} ${(c.y + c.r * Math.sin(a)).toFixed(2)}`;
  });
}

/** SVG path of the crescent: the moon's edge from the left horn to the right, then the bite's edge back. */
export function crescentPath(cx: number, cy: number): string {
  const { moon, bite } = circles(cx, cy);
  const [l, r] = horns(moon, bite);
  return `M${arc(moon, l, r, 96).join(' L')} L${arc(bite, r, l, 96).join(' L')} Z`;
}

/** The screen-sized field with the bite cut out of it (even-odd fill). */
export function fieldWithHole(w: number, h: number, bite: Circle): string {
  const { x, y, r } = bite;
  return `M0 0H${w}V${h}H0Z M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
}

/** How far to scale about the bite's centre so the bite covers the whole screen. */
export function zoomToCover(w: number, h: number, bite: Circle): number {
  const far = Math.max(...[[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => Math.hypot(x - bite.x, y - bite.y)));
  return (1.05 * far) / bite.r;
}
