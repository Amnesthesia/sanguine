// P8-19: returning from the log sheet refreshes changed and cleared energy entries.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS } from '@/data/prefs';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { setEnergy, setFlow, setSymptom } from './actions';

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
const route = vi.hoisted(() => ({ date: '2026-10-14' }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('@/state/app', () => ({ useApp: () => app.state }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }), useLocalSearchParams: () => ({ date: route.date }) }));
const sections = vi.hoisted(() => ({ estimate: vi.fn(), guidance: vi.fn() }));
vi.mock('@/features/guidance/sections/EstimateSections', () => ({ EstimateSections: (p: unknown) => { sections.estimate(p); return <div data-testid="estimate-sections" />; } }));
vi.mock('@/features/guidance/sections/GuidanceSections', () => ({ GuidanceSections: (p: unknown) => { sections.guidance(p); return <div data-testid="guidance-sections" />; } }));
vi.mock('@/ui/SubScreen', () => ({ SubScreen: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
import { ToastHost } from '@/ui/Toast';
import DayDetail from '@/app/day/[date]';

beforeEach(() => {
  Object.assign(AccessibilityInfo, { isReduceTransparencyEnabled: vi.fn().mockResolvedValue(true), addEventListener: vi.fn(() => ({ remove: vi.fn() })), announceForAccessibility: vi.fn() });
  sections.estimate.mockClear();
  sections.guidance.mockClear();
  route.date = '2026-10-14';
});
afterEach(cleanup);

async function setup(today: string) {
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  const store = new EventStore(db, { nowMs: () => 1_700_000_000_000 + n++, iso: () => `${today}T08:00:00+10:00`, tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) });
  return { db, store };
}
const prediction = { asOf: '2026-10-14', suspended: false, flags: [], cycleQuality: [] };

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

it('lists entries as chips; remove has no confirm alert and the toast Undo brings it back', async () => {
  const today = '2026-10-14';
  const { db, store } = await setup(today);
  await setSymptom(store, today, 'cramps', 2);
  const refresh = vi.fn();
  app.state = { db, store, today, prefs: DEFAULT_PREFS, profile: {}, version: 0, refresh };
  const alert = vi.spyOn(Alert, 'alert');
  render(<><DayDetail /><ToastHost /></>);
  const remove = await screen.findByRole('button', { name: /^Remove: Cramps/ });
  fireEvent.click(remove);
  await waitFor(() => expect(screen.queryByTestId('event-symptom')).toBeNull());
  expect(alert).not.toHaveBeenCalled();
  expect(refresh).toHaveBeenCalled();
  await screen.findByText(/^Removed: Cramps/);
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(screen.getByTestId('event-symptom')).toBeTruthy());
});

it('keeps Not a period and Mark as spotting on a period day, and the log button on a past day', async () => {
  const today = '2026-10-14';
  const { db, store } = await setup(today);
  await setFlow(store, today, 'medium', { kind: 'period' });
  app.state = { db, store, today, prefs: DEFAULT_PREFS, profile: {}, version: 0, refresh: vi.fn() };
  render(<DayDetail />);
  await screen.findByTestId('day-not-period');
  expect(screen.getByTestId('day-spotting')).toBeTruthy();
  expect(screen.getByTestId('day-edit')).toBeTruthy();
});

it('mounts the full estimate and guidance sections with the engine inputs', async () => {
  const today = '2026-10-14';
  const { db, store } = await setup(today);
  const history = { cycles: [{ id: 'a', start: '2026-09-01', end: '2026-09-05', quality: 'valid' }, { id: 'b', start: '2026-09-29', end: '2026-10-02', quality: 'valid' }], temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
  app.state = { db, store, today, prefs: DEFAULT_PREFS, profile: {}, version: 0, refresh: vi.fn(), prediction, history, settings: { lifeStates: [] } };
  render(<DayDetail />);
  await screen.findByTestId('estimate-sections');
  expect(sections.estimate.mock.calls.at(-1)?.[0]).toMatchObject({ prediction, day: '2026-10-14', showEstimate: true, pastOv: expect.any(Array), periodLengths: [5] });
  await screen.findByTestId('guidance-sections');
  expect(sections.guidance.mock.calls.at(-1)?.[0]).toMatchObject({ compact: false });
});

it('shows only estimates on a future day: no chips, no nothing-logged line, no log button', async () => {
  const today = '2026-10-14';
  const { db, store } = await setup(today);
  await setSymptom(store, '2026-10-20', 'cramps', 1); // cannot happen in the app; the screen still must not list it
  app.state = { db, store, today, prefs: DEFAULT_PREFS, profile: {}, version: 0, refresh: vi.fn(), prediction };
  route.date = '2026-10-20';
  render(<DayDetail />);
  await screen.findByTestId('estimate-sections');
  expect(sections.estimate.mock.calls.at(-1)?.[0]).toMatchObject({ day: '2026-10-20' });
  expect(screen.queryByText('Nothing logged for this day.')).toBeNull();
  expect(screen.queryByTestId('event-symptom')).toBeNull();
  expect(screen.queryByTestId('day-edit')).toBeNull();
  expect(screen.getByTestId('day-future-note')).toBeTruthy();
});
