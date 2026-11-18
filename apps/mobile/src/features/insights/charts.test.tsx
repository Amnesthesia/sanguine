// The SVG text in the charts grows with the system text size, and the unit and direct labels are drawn.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const scale = vi.hoisted(() => ({ value: 1 }));
vi.mock('@/ui/useFontScale', () => ({ useFontScale: () => scale.value, LARGE: 1.3 }));
// react-native-svg's native build does not load in vitest: stand in plain SVG elements with the same props
vi.mock('react-native-svg', () => {
  const el = (tag: string) => ({ children, textAnchor, fontSize, strokeWidth, strokeDasharray, ...p }: Record<string, unknown>) => {
    const Tag = tag as 'g';
    return <Tag {...(p as object)} {...(fontSize === undefined ? {} : { 'font-size': fontSize })}>{children as never}</Tag>;
  };
  return { default: el('svg'), Circle: el('circle'), G: el('g'), Line: el('line'), Polyline: el('polyline'), Rect: el('rect'), Text: el('text') };
});
import { LengthChart, TempChart } from './charts';

afterEach(cleanup);
const series = { points: [{ start: '2026-07-01', length: 28 }, { start: '2026-07-29', length: 30 }, { start: '2026-08-28', length: 27 }], band: { lo: 26, hi: 31 } } as never;
const texts = (c: HTMLElement) => [...c.querySelectorAll('text')];

describe('charts', () => {
  it('draw the unit, band and axis labels at 11 at normal size', () => {
    scale.value = 1;
    const { container } = render(<LengthChart series={series} unit="days" bandLabel="80% range" label="x" />);
    const t = texts(container);
    expect(t.map((x) => x.textContent)).toEqual(expect.arrayContaining(['days', '80% range', '20', '50']));
    expect(new Set(t.map((x) => x.getAttribute('font-size')))).toEqual(new Set(['11']));
  });
  it('scale every label to 150% and grow the chart height', () => {
    scale.value = 1;
    const normal = render(<LengthChart series={series} unit="days" bandLabel="80% range" label="x" />).container.querySelector('svg')?.getAttribute('height');
    cleanup();
    scale.value = 1.5;
    const { container } = render(<TempChart points={[{ day: 1, value: 36.3 }, { day: 2, value: 36.4 }]} coverline={36.5} unitLabel="°C" label="x" coverlineLabel="Coverline" dayLabel={(n) => `Day ${n}`} />);
    expect(texts(container).length).toBeGreaterThan(4);
    expect(new Set(texts(container).map((x) => x.getAttribute('font-size')))).toEqual(new Set(['16.5']));
    expect(Number(container.querySelector('svg')?.getAttribute('height'))).toBeGreaterThan(Number(normal));
  });
});
