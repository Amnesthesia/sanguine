import { describe, expect, it } from 'vitest';
import type { Prediction } from '@sanguine/engine';
import { dialModel } from './dialModel';

// Cycle started 2026-11-01 (day 1); today is 2026-11-03 (day 3): the Period frame's sample.
const day = (n: number) => `2026-11-${String(n).padStart(2, '0')}`;
const dateOfDay = (n: number) => { const d = new Date(Date.UTC(2026, 10, n)); return d.toISOString().slice(0, 10); };
const prediction = (over: Partial<Prediction> = {}): Prediction => ({
  engineVersion: 'test', asOf: day(3), flags: [], cycleQuality: [],
  cycleLength: { mean: 29, sd: 2, nu: 5, scale: 2, nCyclesUsed: 4 },
  nextPeriod: { point: dateOfDay(29), i80: { lo: dateOfDay(27), hi: dateOfDay(31) }, i95: { lo: dateOfDay(25), hi: dateOfDay(33) }, confidence: 'medium', daysOfDataUsed: 100 },
  currentBleed: { point: day(4), i80: { lo: day(3), hi: day(5) }, confidence: 'low' },
  ovulation: { point: dateOfDay(15), i80: { lo: dateOfDay(13), hi: dateOfDay(17) }, sd: 1.5, confidence: 'medium', basis: 'calendar' },
  fertileDays: [10, 11, 12, 13, 14, 15, 16].map((n) => ({ date: dateOfDay(n), pInWindow: n === 15 ? 0.3 : 0.2 })),
  currentPhase: { phase: 'menstrual', dayOfCycle: 3 },
  ...over,
});
const base = { today: day(3), periodDays: [day(1), day(2), day(3)], showEstimate: true, includeUncertain: false };

describe('dialModel', () => {
  it('sizes the dial to the upper end of the next-period range and lays out the sample', () => {
    const m = dialModel({ ...base, prediction: prediction() });
    expect(m.days).toBe(31);
    expect(m.todayDay).toBe(3);
    expect(m.ovulationDay).toBe(15);
    expect(m.arcs.filter((a) => a.kind === 'period')).toEqual([{ from: 1, to: 3, kind: 'period' }]);
    expect(m.arcs.filter((a) => a.kind === 'periodEstimate')).toEqual([{ from: 4, to: 5, kind: 'periodEstimate' }, { from: 27, to: 31, kind: 'periodEstimate' }]);
    expect(m.arcs.filter((a) => a.kind === 'fertile').map((a) => [a.from, a.to, a.p])).toEqual([[10, 10, 0.2], [11, 11, 0.2], [12, 12, 0.2], [13, 13, 0.2], [14, 14, 0.2], [15, 15, 0.3], [16, 16, 0.2]]);
  });
  it('merges consecutive logged days into one arc and splits at a gap', () => {
    const m = dialModel({ ...base, prediction: prediction(), periodDays: [day(1), day(2), day(4)] });
    expect(m.arcs.filter((a) => a.kind === 'period')).toEqual([{ from: 1, to: 2, kind: 'period' }, { from: 4, to: 4, kind: 'period' }]);
  });
  it('ignores logged days from earlier cycles', () => {
    const m = dialModel({ ...base, prediction: prediction(), periodDays: ['2026-10-03', '2026-10-04', day(1)] });
    expect(m.arcs.filter((a) => a.kind === 'period')).toEqual([{ from: 1, to: 1, kind: 'period' }]);
  });
  it('draws no bleed estimate when the engine has none', () => {
    const { currentBleed: _c, ...p } = prediction();
    const m = dialModel({ ...base, prediction: p });
    expect(m.arcs.filter((a) => a.kind === 'periodEstimate')).toEqual([{ from: 27, to: 31, kind: 'periodEstimate' }]);
  });
  it('draws no fertile arc and no ovulation when the estimate gate is off, even with includeUncertain', () => {
    for (const includeUncertain of [false, true]) {
      const m = dialModel({ ...base, prediction: prediction(), showEstimate: false, includeUncertain });
      expect(m.arcs.some((a) => a.kind === 'fertile')).toBe(false);
      expect(m.ovulationDay).toBeUndefined();
      expect(m.arcs.some((a) => a.kind === 'periodEstimate')).toBe(true);
    }
  });
  it('a wide ovulation estimate needs includeUncertain', () => {
    const wide = prediction({ ovulation: { point: dateOfDay(15), i80: { lo: dateOfDay(5), hi: dateOfDay(25) }, sd: 6, confidence: 'low', basis: 'calendar' } });
    const off = dialModel({ ...base, prediction: wide });
    expect(off.ovulationDay).toBeUndefined();
    expect(off.arcs.some((a) => a.kind === 'fertile')).toBe(false);
    const on = dialModel({ ...base, prediction: wide, includeUncertain: true });
    expect(on.ovulationDay).toBe(15);
    expect(on.arcs.some((a) => a.kind === 'fertile')).toBe(true);
  });
  it('never draws a single fertile day: one shown day, or one left on the dial after clipping, draws no band', () => {
    const one = dialModel({ ...base, prediction: prediction({ fertileDays: [{ date: dateOfDay(13), pInWindow: 0.05 }, { date: dateOfDay(14), pInWindow: 0.5 }] }) });
    expect(one.arcs.some((a) => a.kind === 'fertile')).toBe(false);
    const clipped = dialModel({ ...base, prediction: prediction({ fertileDays: [{ date: dateOfDay(31), pInWindow: 0.5 }, { date: dateOfDay(32), pInWindow: 0.5 }] }) });
    expect(clipped.arcs.some((a) => a.kind === 'fertile')).toBe(false);
  });
  it('keeps today on the dial when the period is late', () => {
    const m = dialModel({ ...base, prediction: prediction({ currentPhase: { phase: 'late', dayOfCycle: 35 } }), today: dateOfDay(35), periodDays: [day(1)] });
    expect(m.days).toBe(35);
    expect(m.todayDay).toBe(35);
    // the estimate stays the engine's 80% range (days 27 to 31); it is not stretched to today
    expect(m.arcs.filter((a) => a.kind === 'periodEstimate').at(-1)).toEqual({ from: 27, to: 31, kind: 'periodEstimate' });
  });
  it('is empty without a prediction, with suspended estimates or without a next period', () => {
    const empty = { days: 0, arcs: [] };
    expect(dialModel({ ...base, prediction: undefined })).toEqual(empty);
    expect(dialModel({ ...base, prediction: prediction({ suspended: { reason: 'pregnant' } }) })).toEqual(empty);
    const { nextPeriod: _n, ...p } = prediction();
    expect(dialModel({ ...base, prediction: p })).toEqual(empty);
  });
});
