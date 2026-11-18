// Insights > History wiring: the length summary appears only when the next-period estimate is low confidence, and Include in
// estimates on an excluded row retracts the exclusion and then reloads.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS } from '@/data/prefs';

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown>, cycles: [] as Array<Record<string, unknown>> }));
vi.mock('@/state/app', () => ({ useApp: () => app.state }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/ui/Screen', () => ({ Screen: ({ children, chrome }: { children: ReactNode; chrome?: ReactNode }) => <div>{chrome}{children}</div> }));
vi.mock('@/ui/GlassBar', () => ({ GlassBar: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock('@/ui/Segmented', () => ({ Segmented: () => null }));
vi.mock('@sanguine/engine', async (orig) => ({ ...(await orig<typeof import('@sanguine/engine')>()), analyzeCycles: () => app.cycles.map((record) => ({ record })) }));
vi.mock('@/features/insights/charts', () => ({ EnergyChart: () => null, LengthChart: () => null, TempChart: () => null }));
const setExcluded = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/features/insights/cycleExclude', () => ({ setCycleExcluded: setExcluded }));
import InsightsScreen from '@/app/(tabs)/insights';

afterEach(() => { cleanup(); setExcluded.mockClear(); });

const cycle = (n: number, length: number | undefined, quality = 'valid') => ({ id: `c${n}`, start: `2026-0${n}-01`, ...(length ? { length } : {}), quality });
async function show(confidence: 'low' | 'high', refresh = vi.fn(async () => {})) {
  app.cycles = [cycle(1, 24), cycle(2, 45, 'user_excluded'), cycle(3, 31), cycle(4, undefined)];
  app.state = { history: { logs: [], temperatures: [], lh: [] }, settings: { lifeStates: [] }, prediction: { nextPeriod: { confidence }, cycleLength: { mean: 30, sd: 5, nu: 5, scale: 5, nCyclesUsed: 3 } }, store: {}, refresh, prefs: DEFAULT_PREFS, profile: {}, today: '2026-04-10', version: 0, db: undefined };
  render(<InsightsScreen />);
  await screen.findByTestId('history-c1');
  return refresh;
}

describe('Insights history', () => {
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
});
