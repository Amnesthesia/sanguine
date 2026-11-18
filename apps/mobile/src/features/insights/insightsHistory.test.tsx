// Insights > History wiring: the length summary appears only when the next-period estimate is low confidence, and Include in
// estimates on an excluded row retracts the exclusion and then reloads.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS } from '@/data/prefs';

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown>, cycles: [] as Array<Record<string, unknown>>, pastOv: [] as Array<Record<string, unknown>> }));
vi.mock('@/state/app', () => ({ useApp: () => app.state }));
const link = vi.hoisted(() => ({ params: {} as Record<string, string> }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }), useLocalSearchParams: () => link.params }));
// This cycle has its own test (ThisCycle.test.tsx); here only which segment shows matters
vi.mock('@/features/insights/ThisCycle', () => ({ ThisCycle: () => <div data-testid="this-cycle" /> }));
vi.mock('@/ui/Screen', () => ({ Screen: ({ children, chrome }: { children: ReactNode; chrome?: ReactNode }) => <div>{chrome}{children}</div> }));
vi.mock('@/ui/GlassBar', () => ({ GlassBar: ({ title, below }: { title: string; below?: ReactNode }) => <header data-testid="bar"><h1>{title}</h1>{below}</header> }));
vi.mock('@/ui/Segmented', () => ({ Segmented: ({ inGlass, testIDPrefix }: { inGlass?: boolean; testIDPrefix?: string }) => <nav data-testid={testIDPrefix} data-inglass={String(!!inGlass)} /> }));
vi.mock('@sanguine/engine', async (orig) => ({ ...(await orig<typeof import('@sanguine/engine')>()), analyzeCycles: () => app.cycles.map((record) => ({ record })), pastOvulations: () => app.pastOv }));
vi.mock('@/features/insights/charts', () => ({ EnergyChart: () => null, LengthChart: () => null, TempChart: () => null }));
const setExcluded = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/features/insights/cycleExclude', () => ({ setCycleExcluded: setExcluded }));
import InsightsScreen from '@/app/(tabs)/insights';

afterEach(() => { cleanup(); setExcluded.mockClear(); link.params = {}; });

const cycle = (n: number, length: number | undefined, quality = 'valid') => ({ id: `c${n}`, start: `2026-0${n}-01`, ...(length ? { length, nextStart: `2026-0${n + 1}-01` } : {}), quality });
async function show(confidence: 'low' | 'high', refresh = vi.fn(async () => {}), profile: Record<string, unknown> = {}) {
  app.cycles = [cycle(1, 24), cycle(2, 45, 'user_excluded'), cycle(3, 31), cycle(4, undefined)];
  app.pastOv = [{ cycleId: 'c3', cycleStart: '2026-03-01', point: '2026-03-15', i80: { lo: '2026-03-13', hi: '2026-03-17' }, basis: 'lh', confidence: 'high' }];
  const ovulation = { point: '2026-04-15', i80: { lo: '2026-04-13', hi: '2026-04-17' }, sd: 1.5, confidence: 'medium', basis: 'calendar' };
  app.state = { history: { logs: [], temperatures: [], lh: [] }, settings: { lifeStates: [] }, prediction: { nextPeriod: { confidence }, ovulation, cycleLength: { mean: 30, sd: 5, nu: 5, scale: 5, nCyclesUsed: 3 } }, store: {}, refresh, prefs: DEFAULT_PREFS, profile, today: '2026-04-10', version: 0, db: undefined };
  render(<InsightsScreen />);
  await screen.findByTestId('history-c1');
  return refresh;
}

describe('Insights history', () => {
  it('puts the segmented control in the glass toolbar (one glass surface), without its own surface', async () => {
    await show('high');
    const tabs = screen.getByTestId('insights-tab');
    expect(screen.getByTestId('bar').contains(tabs)).toBe(true);
    expect(tabs.getAttribute('data-inglass')).toBe('true');
  });
  it('shows the length summary at low confidence, with the excluded cycle in the list', async () => {
    await show('low');
    expect(screen.getByTestId('length-summary')).toBeTruthy();
    expect(screen.getByText('24–45 days')).toBeTruthy();
  });
  it('shows no length summary when the estimate is not low confidence', async () => {
    await show('high');
    expect(screen.queryByTestId('length-summary')).toBeNull();
  });
  it('Include in estimates retracts the exclusion for that cycle, then reloads', async () => {
    const refresh = await show('high');
    fireEvent.click(screen.getByTestId('include-cycle-c2'));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(setExcluded).toHaveBeenCalledWith({}, '2026-02-01', false);
  });
  it('each cycle row gives its ovulation date range from the engine, never the word calendar', async () => {
    await show('high');
    expect(screen.getByTestId('history-c3').textContent).toContain('Ovulation estimate 13\u201317 Mar \u00b7 from your LH tests');
    expect(screen.getByTestId('history-c4').textContent).toContain('Ovulation estimate 13\u201317 Apr');
    // no engine estimate for these cycles: no ovulation words
    expect(screen.getByTestId('history-c1').textContent).not.toMatch(/ovulation/i);
    expect(screen.getByTestId('history-c2').textContent).not.toMatch(/ovulation/i);
    expect(document.body.textContent).not.toMatch(/calendar/);
  });
  it('teen mode hides every ovulation estimate', async () => {
    await show('high', undefined, { birthYear: 2012 });
    expect(document.body.textContent).not.toMatch(/ovulation/i);
  });
});

describe('Insights > This cycle link (D-134)', () => {
  it('Today\'s Read more and More about this cycle open the This cycle segment in every build', async () => {
    link.params = { tab: 'this-cycle', at: '1' };
    app.cycles = [];
    app.state = { history: { logs: [], temperatures: [], lh: [] }, settings: { lifeStates: [] }, prediction: undefined, prefs: DEFAULT_PREFS, profile: {}, today: '2026-04-10', version: 0, db: undefined };
    render(<InsightsScreen />);
    expect(await screen.findByTestId('this-cycle')).toBeTruthy();
    expect(screen.queryByTestId('insights-empty')).toBeNull();
  });
  it('any other tab value from a link is ignored outside a dev build', async () => {
    link.params = { tab: 'charts' };
    app.cycles = [];
    app.state = { history: { logs: [], temperatures: [], lh: [] }, settings: { lifeStates: [] }, prediction: undefined, prefs: DEFAULT_PREFS, profile: {}, today: '2026-04-10', version: 0, db: undefined };
    render(<InsightsScreen />);
    expect(screen.queryByTestId('this-cycle')).toBeNull();
    expect(screen.queryByTestId('card-energy')).toBeNull(); // still on History: the Charts segment always has its energy card
  });
});
