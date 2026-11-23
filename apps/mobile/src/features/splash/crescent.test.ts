import { describe, expect, it } from 'vitest';
import { circles, crescentPath, horns, zoomShift, zoomToCover } from './crescent';

const pts = (d: string) => [...d.matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);

describe('splash crescent', () => {
  it('the horns lie on both circles, the left one first', () => {
    const { moon, bite } = circles(200, 400);
    const [l, r] = horns(moon, bite);
    expect(l[0]).toBeLessThan(r[0]);
    for (const [x, y] of [l, r]) {
      expect(Math.hypot(x - moon.x, y - moon.y)).toBeCloseTo(moon.r, 6);
      expect(Math.hypot(x - bite.x, y - bite.y)).toBeCloseTo(bite.r, 6);
    }
  });

  it('the bowl is below the horns: the path reaches the bottom of the moon', () => {
    const ys = pts(crescentPath(200, 400)).map(([, y]) => y);
    expect(Math.max(...ys)).toBeCloseTo(478, 0);
  });

  it('zoomShift keeps the zoom point still: inner view scaled about the centre, outer view shifted', () => {
    const [w, h, s] = [393, 852, 6];
    const at = ([x, y]: number[]) => { const [tx, ty] = zoomShift(203, 414, w, h, s); return [w / 2 + s * (x - w / 2) + tx, h / 2 + s * (y - h / 2) + ty]; };
    const [x0, y0] = at([203, 414]);
    expect(x0).toBeCloseTo(203);
    expect(y0).toBeCloseTo(414);
    const [x1] = at([213, 414]);
    expect(x1).toBeCloseTo(263);
  });

  it('the zoom makes the bite cover every corner of the screen', () => {
    const { bite } = circles(196.5, 426);
    const s = zoomToCover(393, 852, bite);
    for (const [x, y] of [[0, 0], [393, 0], [0, 852], [393, 852]]) expect(Math.hypot(x - bite.x, y - bite.y)).toBeLessThan(bite.r * s);
  });
});
