// The SVG text in the estimate pictures and the hormone curve grows with the system text size; the pictures grow taller with it.
import type { PastOvulation, Prediction } from '@sanguine/engine';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';

const scale = vi.hoisted(() => ({ value: 1 }));
vi.mock('@/ui/useFontScale', () => ({ useFontScale: () => scale.value, LARGE: 1.3 }));
// react-native-svg's native build does not load in vitest: plain SVG elements with the same props
vi.mock('react-native-svg', () => {
  const el = (tag: string) => ({ children, textAnchor, fontSize, fontWeight, strokeWidth, strokeDasharray, strokeOpacity, fillOpacity, strokeLinecap, ...p }: Record<string, unknown>) => {
    const Tag = tag as 'g';
    return <Tag {...(p as object)} {...(fontSize === undefined ? {} : { 'font-size': fontSize })} {...(textAnchor === undefined ? {} : { 'data-anchor': textAnchor })}>{children as never}</Tag>;
  };
  return { default: el('svg'), Circle: el('circle'), G: el('g'), Line: el('line'), Path: el('path'), Rect: el('rect'), Text: el('text') };
});
import { EstimateSections } from './EstimateSections';
import { HormoneCurve } from './HormoneCurve';

afterEach(cleanup);
const prediction = {
  engineVersion: 'test', asOf: '2026-11-02',
  currentPhase: { phase: 'menstrual', dayOfCycle: 3 },
  currentBleed: { point: '2026-11-04', i80: { lo: '2026-11-03', hi: '2026-11-05' }, confidence: 'low' },
  nextPeriod: { point: '2026-11-28', i80: { lo: '2026-11-26', hi: '2026-11-30' }, i95: { lo: '2026-11-24', hi: '2026-12-02' }, confidence: 'medium', daysOfDataUsed: 56 },
  cycleLength: { mean: 28, sd: 2, nu: 5, scale: 1, nCyclesUsed: 2 },
  ovulation: { point: '2026-11-14', i80: { lo: '2026-11-10', hi: '2026-11-18' }, sd: 3, confidence: 'medium', basis: 'calendar' },
  fertileDays: [{ date: '2026-11-12', pInWindow: 0.3 }],
  flags: [], cycleQuality: [],
} as unknown as Prediction;
const pastOv: PastOvulation[] = [];
const texts = (c: HTMLElement) => [...c.querySelectorAll('svg text')];
const heights = (c: HTMLElement) => [...c.querySelectorAll('svg')].map((s) => Number(s.getAttribute('viewBox')?.split(' ')[3]));
const sizes = (c: HTMLElement) => texts(c).map((x) => Number(x.getAttribute('font-size')));
const estimates = () => render(<EstimateSections prediction={prediction} day="2026-11-02" pastOv={pastOv} showEstimate includeUncertain periodLengths={[5, 4]} />).container;
const curve = (phase: 'ovulatory' | 'luteal' = 'ovulatory') => render(<HormoneCurve day={{ phase, expected: false }} />).container;

describe.each([['estimate pictures', estimates], ['hormone curve', curve]] as const)('%s', (_n, draw) => {
  it('draw their text at the base size at normal text size', () => {
    scale.value = 1;
    const c = draw();
    expect(texts(c).length).toBeGreaterThan(3);
    expect(Math.max(...sizes(c))).toBeLessThanOrEqual(12);
  });
  it('scale every text size by 1.5 and make every picture taller at 150%', () => {
    scale.value = 1;
    const base = draw();
    const b = { sizes: sizes(base), h: heights(base) };
    cleanup();
    scale.value = 1.5;
    const big = draw();
    expect(sizes(big)).toHaveLength(b.sizes.length);
    sizes(big).forEach((s, i) => { expect(s).toBeLessThanOrEqual(b.sizes[i] * 1.5 + 0.01); });
    // every drawing gets taller; the day numbers in the period strip are capped by their circles so only the others are exact
    heights(big).forEach((h, i) => { expect(h).toBeGreaterThan(b.h[i]); });
    expect(sizes(big).filter((s, i) => Math.abs(s - b.sizes[i] * 1.5) < 0.01).length).toBeGreaterThanOrEqual(Math.floor(b.sizes.length * 0.7));
  });
  it('stay readable at the largest setting: nothing drawn past the picture edges', () => {
    scale.value = 3; // clamped to 2
    const c = draw();
    expect(Math.max(...sizes(c))).toBeLessThanOrEqual(24.01);
    for (const t of texts(c)) {
      const x = Number(t.getAttribute('x'));
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(326);
    }
  });
});
