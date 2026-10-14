// P8-19: returning from the log sheet refreshes changed and cleared energy entries.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS } from '@/data/prefs';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { setEnergy } from './actions';

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('@/state/app', () => ({ useApp: () => app.state }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }), useLocalSearchParams: () => ({ date: '2026-10-14' }) }));
vi.mock('@/ui/SubScreen', () => ({ SubScreen: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
import DayDetail from '@/app/day/[date]';

afterEach(cleanup);

it('re-reads the day after energy changes or clears in the sheet', async () => {
  const today = '2026-10-14';
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  const store = new EventStore(db, { nowMs: () => 1_700_000_000_000 + n++, iso: () => `${today}T08:00:00+10:00`, tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) });
  await setEnergy(store, today, 2);
  app.state = { db, store, today, prefs: DEFAULT_PREFS, profile: {}, version: 0 };
  const view = render(<DayDetail />);
  await screen.findByText('Energy: Low (2 of 5)');
  await setEnergy(store, today, 4);
  app.state = { ...app.state, version: 1 };
  view.rerender(<DayDetail />);
  await screen.findByText('Energy: Good (4 of 5)');
  expect(screen.queryByText('Energy: Low (2 of 5)')).toBeNull();
  await setEnergy(store, today, 0);
  app.state = { ...app.state, version: 2 };
  view.rerender(<DayDetail />);
  await waitFor(() => expect(screen.queryByTestId('event-energy')).toBeNull());
});
