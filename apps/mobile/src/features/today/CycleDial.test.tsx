import '@/i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contrast } from '../../../../../packages/ui-tokens/src/contrast';
import { colors } from '@sanguine/ui-tokens';
import { CycleDial } from './CycleDial';
import type { DialModel } from './dialModel';

// react-native-svg ships Flow sources vitest cannot load; the drawing is checked on the simulator, this covers words and accessibility
vi.mock('react-native-svg', () => { const n = () => null; const kids = ({ children }: { children?: React.ReactNode }) => <>{children}</>; return { default: kids, Circle: n, Defs: n, G: n, Line: () => <i data-testid="dial-tick" />, Path: n, RadialGradient: n, Stop: n, Text: ({ children, fontSize }: { children?: React.ReactNode; fontSize?: number }) => <b data-testid="dial-knob-day" data-day={String(children)} data-size={fontSize} /> }; });
const env = vi.hoisted(() => ({ scheme: 'light' as 'light' | 'dark' }));
vi.mock('@/theme', async (orig) => { const m = await orig<typeof import('@/theme')>(); return { ...m, useTheme: () => m.buildTheme(env.scheme, 'ios') }; });
const font = vi.hoisted(() => ({ scale: 1 }));
vi.mock('@/ui/useFontScale', () => ({ LARGE: 1.3, useFontScale: () => font.scale }));
afterEach(() => { cleanup(); font.scale = 1; env.scheme = 'light'; });
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
const centre = { kicker: 'CYCLE DAY', big: '3', pill: 'Period', sub: 'Likely ends 3–5 Nov' };
const model: DialModel = {
  days: 31, todayDay: 3, ovulationDay: 15,
  arcs: [
    { from: 1, to: 3, kind: 'period' }, { from: 4, to: 5, kind: 'periodEstimate' }, { from: 27, to: 31, kind: 'periodEstimate' },
    ...[13, 14, 15, 16].map((d) => ({ from: d, to: d, kind: 'fertile' as const, p: 0.3 })),
  ],
};

describe('CycleDial', () => {
  it('colours the centre pill by what it names: fertile window green, never the period rose', () => {
    const bg = (tone: 'period' | 'fertile' | 'neutral', pill: string) => {
      render(<CycleDial model={model} centre={{ ...centre, pill, pillTone: tone }} />);
      const style = screen.getByTestId('dial-pill').style.backgroundColor;
      cleanup();
      return style;
    };
    const fertile = bg('fertile', 'Fertile window · estimate');
    const period = bg('period', 'Period');
    expect(fertile).not.toBe(period);
    expect(fertile).toContain('92, 138, 110'); // colors.light.fertile #5C8A6E at a soft alpha
    expect(period).toContain('244, 220, 224'); // accentSoft
  });
  it('is one element with a spoken summary and a legend', () => {
    render(<CycleDial model={model} centre={centre} />);
    const dial = screen.getByTestId('cycle-dial');
    expect(dial.getAttribute('aria-label')).toBe('Cycle day 3. Period logged on days 1 to 3. Likely ending on days 4 to 5. Fertile window estimate, days 13 to 16. Ovulation estimate around day 15. Next period likely days 27 to 31. Period. Likely ends 3–5 Nov.');
    expect(screen.getByText('Fertile window')).toBeTruthy(); // legend present
  });
  it('the today knob carries the day number and the legend names it, so it is not read as another estimate (D-159)', () => {
    render(<CycleDial model={model} centre={centre} />);
    expect(screen.getByTestId('dial-knob-day').getAttribute('data-day')).toBe('3');
    expect(screen.getByText('Today')).toBeTruthy();
    const legend = screen.getByText('Today').parentElement?.parentElement;
    expect(legend?.firstElementChild?.textContent).toBe('Today'); // named first
    cleanup();
    render(<CycleDial model={{ ...model, days: 120, todayDay: 104 }} centre={centre} />);
    expect(screen.getByTestId('dial-knob-day').getAttribute('data-day')).toBe('104');
    expect(Number(screen.getByTestId('dial-knob-day').getAttribute('data-size'))).toBeLessThan(13); // three digits fit the knob
  });
  it('draws no today knob or legend entry without a cycle day', () => {
    render(<CycleDial model={{ days: 0, arcs: [] }} centre={{ kicker: 'CYCLE DAY', big: '–', sub: 'No cycle data yet' }} />);
    expect(screen.queryByTestId('dial-knob-day')).toBeNull();
    expect(screen.queryByText('Today')).toBeNull();
  });
  it('draws no fertile or ovulation legend when the model has none', () => {
    render(<CycleDial model={{ days: 31, todayDay: 3, arcs: model.arcs.filter((a) => a.kind !== 'fertile') }} centre={centre} />);
    expect(screen.queryByText('Fertile window')).toBeNull();
    expect(screen.queryByText('Ovulation')).toBeNull();
    expect(screen.getByTestId('cycle-dial').getAttribute('aria-label')).not.toMatch(/Fertile|Ovulation/);
  });
  it('shows the bare track with its words when there is no data', () => {
    render(<CycleDial model={{ days: 0, arcs: [] }} centre={{ kicker: 'CYCLE DAY', big: '–', sub: 'No cycle data yet' }} />);
    expect(screen.getByTestId('cycle-dial').getAttribute('aria-label')).toBe('CYCLE DAY. No cycle data yet'); // the dash placeholder is not spoken
    expect(screen.queryByText('Period')).toBeNull();
  });
  it('draws the day ticks on the empty track too (frame Today-Empty: four weeks, a longer one every seventh)', () => {
    render(<CycleDial model={{ days: 0, arcs: [] }} centre={{ kicker: 'CYCLE DAY', big: '–', sub: 'No cycle data yet' }} />);
    expect(screen.getAllByTestId('dial-tick')).toHaveLength(28);
    cleanup();
    render(<CycleDial model={model} centre={centre} />);
    expect(screen.getAllByTestId('dial-tick')).toHaveLength(31);
  });
  it('the legend swatch for an estimate is the estimateSwatch token, in light and in dark', () => {
    for (const scheme of ['light', 'dark'] as const) {
      env.scheme = scheme;
      render(<CycleDial model={model} centre={centre} />);
      const swatch = screen.getByText('Estimate').previousElementSibling as HTMLElement;
      expect(getComputedStyle(swatch).backgroundColor).toBe(rgb(colors[scheme].estimateSwatch));
      cleanup();
    }
  });
  it('speaks a one-day range as one day, and each fertile run on its own', () => {
    const m: DialModel = {
      days: 31, todayDay: 3,
      arcs: [
        { from: 1, to: 1, kind: 'period' }, { from: 4, to: 4, kind: 'periodEstimate' }, { from: 29, to: 29, kind: 'periodEstimate' },
        ...[10, 11, 12, 14, 15].map((d) => ({ from: d, to: d, kind: 'fertile' as const, p: 0.3 })),
      ],
    };
    render(<CycleDial model={m} centre={{ kicker: 'CYCLE DAY', big: '3' }} />);
    expect(screen.getByTestId('cycle-dial').getAttribute('aria-label')).toBe('Cycle day 3. Period logged on day 1. Likely ending on day 4. Fertile window estimate, days 10 to 12. Fertile window estimate, days 14 to 15. Next period likely day 29.');
  });
  it('at large text the kicker, pill and sub leave the dial element and stack beneath it', () => {
    render(<CycleDial model={model} centre={centre} />);
    expect(screen.getByTestId('cycle-dial').textContent).toContain('CYCLE DAY');
    cleanup();
    font.scale = 1.5;
    render(<CycleDial model={model} centre={centre} />);
    const dial = screen.getByTestId('cycle-dial');
    expect(dial.textContent).toBe('3'); // only the number stays in the dial
    expect(screen.getByText('CYCLE DAY')).toBeTruthy();
    expect(screen.getByText('Likely ends 3–5 Nov')).toBeTruthy();
  });
});

describe('dial edge contrast (D-093)', () => {
  // the thin solid rim of each estimate sits on the frames' track colour; it needs 3:1 as non-text
  const track = { light: colors.light.dialTrack, dark: colors.dark.dialTrack };
  for (const scheme of ['light', 'dark'] as const) {
    it(`fertile rim on the track >= 3 in ${scheme}`, () => expect(contrast(colors[scheme].fertile, track[scheme])).toBeGreaterThanOrEqual(3));
  }
  it('period rim on the track >= 3 in light and in dark', () => {
    for (const scheme of ['light', 'dark'] as const) expect(contrast(colors[scheme].period, track[scheme])).toBeGreaterThanOrEqual(3);
  });
});
