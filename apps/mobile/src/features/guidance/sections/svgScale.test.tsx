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
// the legend's line samples are fixed-size and hidden from screen readers; only the pictures grow
const heights = (c: HTMLElement) => [...c.querySelectorAll('svg:not([aria-hidden])')].map((s) => Number(s.getAttribute('viewBox')?.split(' ')[3]));
const sizes = (c: HTMLElement) => texts(c).map((x) => Number(x.getAttribute('font-size')));
const estimates = () => render(<EstimateSections prediction={prediction} day="2026-11-02" pastOv={pastOv} cycleStarts={['2026-10-31']} periodDays={new Set(['2026-10-31'])} showEstimate includeUncertain periodLengths={[5, 4]} />).container;
const curve = (phase: 'ovulatory' | 'luteal' = 'ovulatory') => render(<HormoneCurve day={{ phase, expected: false }} />).container;
const curveExtras = () => render(<HormoneCurve day={{ phase: 'luteal', expected: false }} extras />).container;

describe.each([['estimate pictures', estimates], ['hormone curve', curve], ['hormone curve with LH, FSH and temperature', curveExtras]] as const)('%s', (_n, draw) => {
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

describe('curve legend (D-155)', () => {
  it('LH, FSH and temperature are drawn, with a legend, only when extras is on', () => {
    scale.value = 1;
    const plain = curve('luteal');
    expect(plain.querySelector('[data-testid="hormone-legend"]')).toBeNull();
    cleanup();
    const more = curveExtras();
    const legend = more.querySelector('[data-testid="hormone-legend"]');
    expect(legend?.textContent).toMatch(/Estrogen.*Progesterone.*LH.*FSH.*Temperature/);
    expect(more.querySelector('svg')?.getAttribute('aria-label') ?? more.innerHTML).toContain('luteinising');
  });
});

describe('the curve follows the person\'s own cycle (D-155)', () => {
  const own = (extras: boolean, ovulationDay?: number) => render(<HormoneCurve extras={extras} day={{ phase: 'luteal', expected: false, frame: { day: 24, length: 35, bleedDays: 6, ...(ovulationDay === undefined ? {} : { ovulationDay, ovulationRange: { lo: ovulationDay - 2, hi: ovulationDay + 2 } }) } }} />).container;
  const peak = (c: HTMLElement) => {
    const lh = [...c.querySelectorAll('path')].find((p) => (p.getAttribute('d') ?? '').includes(',10.0'));
    return Number(/L([\d.]+),10\.0/.exec(lh?.getAttribute('d') ?? '')?.[1]);
  };
  it('puts the LH peak on the ovulation day, ends on the cycle\'s last day and marks the day', () => {
    scale.value = 1;
    const c = own(true, 20);
    expect(peak(c)).toBeCloseTo((20.5 * 326) / 35, 0);
    expect(texts(c).map((t) => t.textContent)).toContain('Day 35');
    expect(Number(c.querySelector('circle')?.getAttribute('cx'))).toBeCloseTo((24.5 * 326) / 35, 5); // the marker sits on day 25, not the middle of the phase
    expect(c.querySelectorAll('rect').length).toBe(2); // the bleed and the likely range for ovulation
  });
  it('a follicular day in a long cycle stays left of a typical peak, a luteal day right of it (D-162)', () => {
    scale.value = 1;
    const mark = (phase: 'follicular' | 'luteal', day: number) => {
      const c = render(<HormoneCurve extras day={{ phase, expected: false, frame: { day, length: 50, bleedDays: 5 } }} />).container;
      const out = { x: Number(c.querySelector('circle')?.getAttribute('cx')), peak: peak(c) };
      cleanup();
      return out;
    };
    const f = mark('follicular', 28);
    expect(f.x).toBeLessThan(f.peak);
    const l = mark('luteal', 12);
    expect(l.x).toBeGreaterThan(l.peak);
  });
  it('a later ovulation moves the peak right', () => {
    scale.value = 1;
    expect(peak(own(true, 24))).toBeGreaterThan(peak(own(true, 16)));
  });
  it('without the estimate the peak is not placed on the date: the typical place, and no range band', () => {
    scale.value = 1;
    const c = own(false, 20);
    expect(c.querySelectorAll('rect').length).toBe(1);
    expect(texts(c).map((t) => t.textContent)).toContain('Day 35');
  });
  it('without a frame it is the generic 28-day picture', () => {
    scale.value = 1;
    expect(texts(curve('luteal')).map((t) => t.textContent)).toContain('Day 28');
  });
});
