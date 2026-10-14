// P8-19: suspended predictions retain the personal chart, without phase guidance or suggestions.
import { addDays } from '@sanguine/engine';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS } from '@/data/prefs';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { setEnergy } from '@/features/logging/actions';

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('@/state/app', () => ({ useApp: () => app.state }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/ui/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/ui/Segmented', () => ({ Segmented: ({ onChange }: { onChange: (v: string) => void }) => <button type="button" onClick={() => onChange('charts')}>Charts</button> }));
vi.mock('@/features/insights/charts', () => ({
  EnergyChart: ({ label }: { label: string }) => <div data-testid="chart-energy" role="img" aria-label={label} />,
  LengthChart: () => null,
  TempChart: () => null,
}));
import InsightsScreen from '@/app/(tabs)/insights';

afterEach(cleanup);

async function lowEnergy(suspended: boolean) {
  const today = '2026-10-14';
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  const store = new EventStore(db, { nowMs: () => 1_700_000_000_000 + n++, iso: () => `${today}T08:00:00+10:00`, tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) });
  for (let i = 0; i < 10; i++) await setEnergy(store, addDays(today, -i), 1);
  app.state = { db, store, today, prefs: DEFAULT_PREFS, profile: {}, version: 0, prediction: suspended ? { suspended: { reason: 'pregnant' } } : undefined };
  render(<InsightsScreen />);
  fireEvent.click(screen.getByRole('button', { name: 'Charts' }));
  await waitFor(() => expect(screen.getByTestId('chart-energy')).toBeTruthy());
}

describe('Energy card', () => {
  it('shows logs even without closed cycles, with the persistent-low prompt', async () => {
    await lowEnergy(false);
    expect(screen.getByTestId('chart-energy').getAttribute('aria-label')).toContain('10 days logged');
    expect(screen.getByTestId('energy-suggestion-lowOverall')).toBeTruthy();
  });
  it('shows the chart but no averages or suggestions while suspended', async () => {
    await lowEnergy(true);
    expect(screen.queryByText('Average by part of the cycle')).toBeNull();
    expect(screen.queryByText('What your logs show')).toBeNull();
    expect(screen.queryByTestId('energy-suggestion-lowOverall')).toBeNull();
  });
});
