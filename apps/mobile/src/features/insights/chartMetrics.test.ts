// Chart text follows the system text size (150% requirement): type, margins and height grow together so nothing clips.
import { describe, expect, it } from 'vitest';
import { chartMetrics } from './chartMetrics';

describe('chartMetrics', () => {
  it('at normal size it keeps the original layout', () => {
    const m = chartMetrics(1);
    expect(m.fs).toBe(11);
    expect(m.H).toBe(200);
    expect(m.PAD).toEqual({ l: 34, r: 12, t: 26, b: 30 });
    expect(m.maxXLabels).toBe(5);
  });
  it('at 150% the type is 150% and the margins and height leave room for it', () => {
    const m = chartMetrics(1.5);
    expect(m.fs).toBe(16.5);
    expect(m.PAD.l).toBe(51);
    expect(m.PAD.t).toBeGreaterThanOrEqual(m.fs + 10);
    expect(m.PAD.b).toBeGreaterThanOrEqual(m.fs + 10);
    expect(m.H - m.PAD.t - m.PAD.b).toBeGreaterThanOrEqual(144); // the plot is never smaller than at normal size
    expect(m.maxXLabels).toBe(3);
  });
  it('is capped at 200% and never below 100%', () => {
    expect(chartMetrics(3).fs).toBe(22);
    expect(chartMetrics(0.8).fs).toBe(11);
  });
});
