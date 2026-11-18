// Cycle detail: the timeline carries the frame's rows (last bleeding day, latest temperature), the temperature row follows the
// fertility gate and the temperature unit, and Leave out / Include write through the shared helper.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS } from '@/data/prefs';

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown>, cycle: {} as Record<string, unknown>, pastOv: [] as Array<Record<string, unknown>> }));
vi.mock('@/state/app', () => ({ useApp: () => app.state }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'c1' }) }));
vi.mock('@/ui/SubScreen', () => ({ SubScreen: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@sanguine/engine', async (orig) => ({ ...(await orig<typeof import('@sanguine/engine')>()), analyzeCycles: () => [{ record: app.cycle }], pastOvulations: () => app.pastOv }));
const setExcluded = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/features/insights/cycleExclude', () => ({ setCycleExcluded: setExcluded }));
import CycleDetail from '@/app/cycle/[id]';

afterEach(() => { cleanup(); setExcluded.mockClear(); });
const temps = [{ date: '2026-10-25', valueC: 36.5, source: 'oral' }, { date: '2026-10-27', valueC: 36.42, source: 'oral' }, { date: '2026-10-28', valueC: 37.5, source: 'oral', disturbed: true }, { date: '2026-10-29', valueC: 35, source: 'wrist' }];

function show(over: { fertility?: boolean; unit?: 'C' | 'F'; quality?: string; pastOv?: Array<Record<string, unknown>>; ovulation?: Record<string, unknown>; hideEstimate?: boolean } = {}) {
  app.cycle = { id: 'c1', start: '2026-10-03', end: '2026-10-06', nextStart: '2026-10-31', length: 28, bleedDays: 4, quality: over.quality ?? 'valid', ...(over.ovulation ? { ovulation: over.ovulation } : {}) };
  app.pastOv = over.pastOv ?? [];
  // under 18 the fertility rows are hidden: a profile born in 2012 is 14 on the test date
  const profile = over.fertility === false ? { birthYear: 2012 } : {};
  app.state = { history: { cycles: [], temperatures: temps, lh: [{ date: '2026-10-13', result: 'positive' }] }, settings: {}, prediction: undefined, store: {}, refresh: vi.fn(async () => {}), prefs: { ...DEFAULT_PREFS, tempUnit: over.unit ?? 'C', showOvulationEstimate: !over.hideEstimate }, profile, today: '2026-11-02' };
  render(<CycleDetail />);
}

describe('cycle timeline', () => {
  it('shows the last bleeding day and the latest counted temperature, in the unit she chose', () => {
    show();
    const rows = within(screen.getByTestId('cycle-timeline'));
    expect(rows.getByText('Last bleeding day 6 Oct 2026')).toBeTruthy();
    expect(rows.getByText('27 Oct · 36.42 °C')).toBeTruthy(); // not the disturbed 28th or the wrist reading
    expect(rows.getByText('13 Oct · LH test positive')).toBeTruthy();
  });
  it('writes the temperature in Fahrenheit when that is her unit', () => {
    show({ unit: 'F' });
    expect(within(screen.getByTestId('cycle-timeline')).getByText('27 Oct · 97.56 °F')).toBeTruthy();
  });
  it('hides the temperature and LH rows under the fertility gate but keeps the last bleeding day', () => {
    show({ fertility: false });
    const rows = within(screen.getByTestId('cycle-timeline'));
    expect(rows.queryByText(/36\.42/)).toBeNull();
    expect(rows.queryByText(/LH test/)).toBeNull();
    expect(rows.getByText('Last bleeding day 6 Oct 2026')).toBeTruthy();
  });
  it('Leave out of estimates, and Include in estimates for an excluded cycle, go through the shared helper', async () => {
    show();
    fireEvent.click(screen.getByTestId('cycle-exclude'));
    await waitFor(() => expect(setExcluded).toHaveBeenCalledWith({}, '2026-10-03', true));
    cleanup();
    show({ quality: 'user_excluded' });
    fireEvent.click(screen.getByTestId('cycle-exclude'));
    await waitFor(() => expect(setExcluded).toHaveBeenLastCalledWith({}, '2026-10-03', false));
  });
});

describe('cycle ovulation estimate', () => {
  const lh = { cycleId: 'c1', cycleStart: '2026-10-03', point: '2026-10-14', i80: { lo: '2026-10-13', hi: '2026-10-15' }, basis: 'lh', confidence: 'high' };
  it('reads as the date range and where it came from, in plain words', () => {
    show({ pastOv: [lh], ovulation: { point: '2026-10-14', sd: 1, basis: 'lh' } });
    const card = within(screen.getByTestId('cycle-ovulation'));
    expect(card.getByText('Ovulation estimate 13\u201315 Oct')).toBeTruthy();
    expect(card.getByText('Worked out from your LH tests.')).toBeTruthy();
    expect(card.getByText('Second half: 16 days')).toBeTruthy();
    expect(screen.getByTestId('cycle-ovulation').textContent).not.toMatch(/Dated by|ovulation:|test\./);
  });
  it('a calendar estimate gives the range and says it comes from cycle lengths', () => {
    show({ pastOv: [{ ...lh, basis: 'calendar', i80: { lo: '2026-10-14', hi: '2026-10-19' } }] });
    const card = within(screen.getByTestId('cycle-ovulation'));
    expect(card.getByText('Ovulation estimate 14\u201319 Oct')).toBeTruthy();
    expect(card.getByText('Estimated from cycle lengths only.')).toBeTruthy();
  });
  it('no ovulation card under 18, when she hides the estimate, or when the engine gives none', () => {
    show({ pastOv: [lh], fertility: false });
    expect(screen.queryByTestId('cycle-ovulation')).toBeNull();
    cleanup();
    show({ pastOv: [lh], hideEstimate: true });
    expect(screen.queryByTestId('cycle-ovulation')).toBeNull();
    cleanup();
    show({ quality: 'user_excluded' });
    expect(screen.queryByTestId('cycle-ovulation')).toBeNull();
  });
});
