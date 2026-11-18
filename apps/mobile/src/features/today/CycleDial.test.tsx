import '@/i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CycleDial } from './CycleDial';
import type { DialModel } from './dialModel';

// react-native-svg ships Flow sources vitest cannot load; the drawing is checked on the simulator, this covers words and accessibility
vi.mock('react-native-svg', () => { const n = () => null; return { default: n, Circle: n, Defs: n, G: n, Line: n, Path: n, RadialGradient: n, Stop: n }; });
afterEach(cleanup);
const centre = { kicker: 'CYCLE DAY', big: '3', pill: 'Period', sub: 'Likely ends 3–5 Nov' };
const model: DialModel = {
  days: 31, todayDay: 3, ovulationDay: 15,
  arcs: [
    { from: 1, to: 3, kind: 'period' }, { from: 4, to: 5, kind: 'periodEstimate' }, { from: 27, to: 31, kind: 'periodEstimate' },
    ...[13, 14, 15, 16].map((d) => ({ from: d, to: d, kind: 'fertile' as const, p: 0.3 })),
  ],
};

describe('CycleDial', () => {
  it('is one element with a spoken summary and a legend', () => {
    render(<CycleDial model={model} centre={centre} />);
    const dial = screen.getByTestId('cycle-dial');
    expect(dial.getAttribute('aria-label')).toBe('Cycle day 3. Period logged on days 1 to 3. Likely ending on days 4 to 5. Fertile window estimate, days 13 to 16. Ovulation estimate around day 15. Next period likely days 27 to 31. Period. Likely ends 3–5 Nov.');
    expect(screen.getByText('Fertile window')).toBeTruthy(); // legend present
  });
  it('draws no fertile or ovulation legend when the model has none', () => {
    render(<CycleDial model={{ days: 31, todayDay: 3, arcs: model.arcs.filter((a) => a.kind !== 'fertile') }} centre={centre} />);
    expect(screen.queryByText('Fertile window')).toBeNull();
    expect(screen.queryByText('Ovulation')).toBeNull();
    expect(screen.getByTestId('cycle-dial').getAttribute('aria-label')).not.toMatch(/Fertile|Ovulation/);
  });
  it('shows the bare track with its words when there is no data', () => {
    render(<CycleDial model={{ days: 0, arcs: [] }} centre={{ kicker: 'CYCLE DAY', big: '–', sub: 'No cycle data yet' }} />);
    expect(screen.getByTestId('cycle-dial').getAttribute('aria-label')).toBe('CYCLE DAY – No cycle data yet');
    expect(screen.queryByText('Period')).toBeNull();
  });
});
