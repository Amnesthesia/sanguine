import { describe, expect, it } from 'vitest';
import { cycleAxis, samplePath, W, warpPath } from './curveShape';

const EST = 'M0,96 C40,96 80,86 110,62 S135,20 146,22 S166,64 186,68 S226,48 242,50 S292,82 326,94';
const peakX = (d: string, y: number): number => Number((d.split(' ').find((p) => p.endsWith(`,${y.toFixed(1)}`)) ?? 'L-1,0').slice(1).split(',')[0]);

describe('cycleAxis', () => {
  it('without a cycle is the generic 28-day picture', () => {
    const a = cycleAxis(undefined);
    expect(a.own).toBe(false);
    expect(a.length).toBe(28);
    expect([0, 48, 146, 326].map(a.x)).toEqual([0, 48, 146, 326]);
  });
  it('puts the bleed end, the ovulation day and the last day on the cycle\'s own dates', () => {
    const a = cycleAxis({ length: 35, bleedDays: 6, ovulationDay: 20 });
    expect(a.perDay).toBeCloseTo(W / 35, 5);
    expect(a.x(0)).toBe(0);
    expect(a.x(48)).toBeCloseTo((6 * W) / 35, 5);
    expect(a.x(146)).toBeCloseTo((20.5 * W) / 35, 5);
    expect(a.x(326)).toBe(W);
    expect(a.length).toBe(35);
  });
  it('moves with the ovulation day: a later ovulation draws the peak further right', () => {
    const early = cycleAxis({ length: 28, bleedDays: 5, ovulationDay: 10 }).ovX;
    const late = cycleAxis({ length: 28, bleedDays: 5, ovulationDay: 18 }).ovX;
    expect(late).toBeGreaterThan(early);
  });
  it('keeps the typical place when the ovulation day is not given, so a hidden estimate does not give the date away', () => {
    const a = cycleAxis({ length: 28, bleedDays: 5 });
    const b = cycleAxis({ length: 28, bleedDays: 5, ovulationDay: 9 });
    expect(a.ovX).toBeCloseTo(146, 5);
    expect(b.ovX).not.toBeCloseTo(a.ovX, 0);
  });
  it('clamps absurd inputs to something drawable', () => {
    const a = cycleAxis({ length: 400, bleedDays: 90, ovulationDay: 500 });
    expect(a.length).toBe(60);
    expect(a.bleedX).toBeLessThanOrEqual(W * 0.3);
    expect(a.ovX).toBeLessThanOrEqual(W - 50);
  });
});

describe('warpPath', () => {
  it('samples the template through its end points', () => {
    const pts = samplePath(EST);
    expect(pts[0]).toEqual([0, 96]);
    expect(pts[pts.length - 1]).toEqual([326, 94]);
    expect(pts.length).toBeGreaterThan(40);
  });
  it('the generic axis leaves the curve where it was and a longer cycle stretches it', () => {
    const generic = warpPath(EST, cycleAxis(undefined));
    expect(peakX(generic, 22)).toBeCloseTo(146, 0);
    const own = warpPath(EST, cycleAxis({ length: 35, bleedDays: 5, ovulationDay: 21 }));
    expect(peakX(own, 22)).toBeCloseTo((21.5 * W) / 35, 0);
  });
});
