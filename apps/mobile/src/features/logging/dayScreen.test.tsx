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
vi.mock('@/ui/SubScreen', () => ({ SubScreen: ({ children, floating }: { children: ReactNode; floating?: ReactNode }) => <div>{children}{floating}</div> }));
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
  await waitFor(() => expect(screen.queryByText(/^Energy:/)).toBeNull());
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
  await waitFor(() => expect(screen.queryByRole('button', { name: /^Remove: Cramps/ })).toBeNull());
  expect(alert).not.toHaveBeenCalled();
  expect(refresh).toHaveBeenCalled();
  await screen.findByText(/^Removed: Cramps/);
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /^Remove: Cramps/ })).toBeTruthy());
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
  expect(sections.estimate.mock.calls.at(-1)?.[0]).toMatchObject({ prediction, day: '2026-10-14', showEstimate: true, includeUncertain: false, pastOv: expect.any(Array), periodLengths: [5] });
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
  expect(screen.queryByRole('button', { name: /^Remove: Cramps/ })).toBeNull();
  expect(screen.queryByTestId('day-edit')).toBeNull();
  expect(screen.queryByText('Logged on this day')).toBeNull();
  expect(screen.queryByTestId('day-not-period')).toBeNull();
  expect(screen.queryByTestId('guidance-sections')).toBeNull();
  expect(screen.getByTestId('day-future-note')).toBeTruthy();
});

it('says no estimate covers a future day when there is no prediction or it is paused', async () => {
  const today = '2026-10-14';
  const { db, store } = await setup(today);
  route.date = '2026-10-20';
  app.state = { db, store, today, prefs: DEFAULT_PREFS, profile: {}, version: 0, refresh: vi.fn() };
  const view = render(<DayDetail />);
  await screen.findByText('No estimate covers this day.');
  expect(screen.queryByTestId('estimate-sections')).toBeNull();
  view.unmount();
  app.state = { ...app.state, prediction: { ...prediction, suspended: { reason: 'pregnant' } } };
  render(<DayDetail />);
  await screen.findByText('No estimate covers this day.');
});

const withPrefs = async (prefs: object, profile: object) => {
  const today = '2026-10-14';
  const { db, store } = await setup(today);
  app.state = { db, store, today, prefs: { ...DEFAULT_PREFS, ...prefs }, profile, version: 0, refresh: vi.fn(), prediction };
  render(<DayDetail />);
  await screen.findByTestId('estimate-sections');
  return sections.estimate.mock.calls.at(-1)?.[0];
};

it('hands the uncertain-estimates preference to the estimate sections', async () => {
  expect(await withPrefs({ showUncertainEstimates: true }, {})).toMatchObject({ showEstimate: true, includeUncertain: true });
});

it('teen mode: no ovulation estimate and no uncertain estimates reach the sections, even with the opt-in stored', async () => {
  expect(await withPrefs({ showUncertainEstimates: true }, { birthDate: '2011-03-01' })).toMatchObject({ showEstimate: false, includeUncertain: false });
});

it('an adult who hides the ovulation estimate gets neither it nor the uncertain ones', async () => {
  expect(await withPrefs({ showOvulationEstimate: false, showUncertainEstimates: true }, {})).toMatchObject({ showEstimate: false, includeUncertain: false });
});

it('names the cycle day and says Period on a logged period day, with the log button pinned after the content', async () => {
  const today = '2026-10-14';
  const { db, store } = await setup(today);
  await setFlow(store, today, 'medium', { kind: 'period' });
  const history = { cycles: [{ id: 'a', start: '2026-10-12', end: null, quality: 'valid' }], temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
  app.state = { db, store, today, prefs: DEFAULT_PREFS, profile: {}, version: 0, refresh: vi.fn(), prediction, history, settings: { lifeStates: [] } };
  render(<DayDetail />);
  await screen.findByText('Day 3 of your cycle · Period');
  const log = screen.getByRole('button', { name: 'Log this day' });
  expect(log.getAttribute('data-testid') ?? log.closest('[data-testid]')?.getAttribute('data-testid')).toBe('day-edit');
  const estimates = await screen.findByTestId('estimate-sections');
  expect(estimates.compareDocumentPosition(log) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('marks the cycle day of a future day as an estimate', async () => {
  const today = '2026-10-14';
  const { db, store } = await setup(today);
  const history = { cycles: [{ id: 'a', start: '2026-10-12', end: null, quality: 'valid' }], temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
  route.date = '2026-10-20';
  app.state = { db, store, today, prefs: DEFAULT_PREFS, profile: {}, version: 0, refresh: vi.fn(), prediction, history, settings: { lifeStates: [] } };
  render(<DayDetail />);
  await screen.findByText('Day 9 of your cycle · estimate');
});

it('adds where an imported entry came from to its chip, and not to a manual one', async () => {
  const today = '2026-10-14';
  const { db, store } = await setup(today);
  await store.append({ kind: 'symptom', payload: { day: today, code: 'cramps', intensity: 2 }, provenance: 'imported', source_app: 'Natural Cycles' });
  await setSymptom(store, today, 'headache', 1);
  app.state = { db, store, today, prefs: DEFAULT_PREFS, profile: {}, version: 0, refresh: vi.fn() };
  render(<DayDetail />);
  await screen.findByRole('button', { name: /^Remove: Cramps.* · Natural Cycles/ });
  expect(screen.getByRole('button', { name: /^Remove: Headache/ }).getAttribute('aria-label')).not.toMatch(/·/);
});
