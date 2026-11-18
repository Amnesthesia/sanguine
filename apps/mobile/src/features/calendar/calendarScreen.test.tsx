import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS, type Prefs } from '@/data/prefs';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { dayState, saveLh, setFlow, setSymptom } from '@/features/logging/actions';
import type * as CalendarModel from './calendarModel';
import { nextDetent } from './DaySheet';

type Model = typeof CalendarModel;
type BuildInput = Parameters<Model['buildMonth']>[0];

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
const spies = vi.hoisted(() => ({ buildMonth: vi.fn(), push: vi.fn(), estimate: vi.fn(), guidance: vi.fn() }));
vi.mock('react-native-svg', () => { const none = () => null; return { default: none, Rect: none, Path: none, Line: none, Circle: none, G: none, Text: none }; });
vi.mock('@/state/app', () => ({ useApp: (sel?: (s: unknown) => unknown) => (sel ? sel(app.state) : app.state) }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: spies.push, back: vi.fn() }) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('./SwipeMonth', () => ({ SwipeMonth: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/services/locale', () => ({ deviceWeekStart: () => 'mon', deviceRegion: () => 'AU' }));
vi.mock('@/features/today/todayModel', async (orig) => ({ ...(await orig<object>()), buildToday: () => ({ flags: [] }) }));
vi.mock('@/features/guidance/guidance', async (orig) => ({ ...(await orig<object>()), phaseOn: () => ({ phase: 'follicular', expected: false }) }));
vi.mock('@/features/guidance/sections/EstimateSections', () => ({ EstimateSections: (p: unknown) => { spies.estimate(p); return <div data-testid="estimate-sections" />; } }));
vi.mock('@/features/guidance/sections/GuidanceSections', () => ({ GuidanceSections: (p: unknown) => { spies.guidance(p); return <div data-testid="guidance-sections" />; } }));
vi.mock('./calendarModel', async (orig) => {
  const m = await orig<Model>();
  return { ...m, buildMonth: (i: BuildInput) => { spies.buildMonth(i); return m.buildMonth(i); } };
});
import CalendarScreen from '@/app/(tabs)/calendar';
import { ToastHost } from '@/ui/Toast';

const TODAY = '2026-11-18';
beforeEach(() => {
  Object.assign(AccessibilityInfo, { isReduceTransparencyEnabled: vi.fn().mockResolvedValue(true), addEventListener: vi.fn(() => ({ remove: vi.fn() })), announceForAccessibility: vi.fn() });
  spies.push.mockClear(); spies.buildMonth.mockClear(); spies.estimate.mockClear();
});
afterEach(cleanup);

async function setup(prefs: Partial<Prefs> = {}, extra: Record<string, unknown> = {}) {
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  const store = new EventStore(db, { nowMs: () => 1_700_000_000_000 + n++, iso: () => `${TODAY}T08:00:00+10:00`, tz: () => 'Australia/Brisbane', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) });
  const refresh = vi.fn(async () => { app.state = { ...app.state, version: (app.state.version as number) + 1 }; });
  app.state = { db, store, today: TODAY, prefs: { ...DEFAULT_PREFS, ...prefs }, profile: {}, version: 0, refresh, muteFlag: vi.fn(), history: { cycles: [{ id: 'c1', start: '2026-11-16' }], logs: [] }, settings: undefined, prediction: undefined, ...extra };
  return { db, store, refresh };
}
const view = () => render(<><CalendarScreen /><ToastHost /></>);
const filledButtons = () => [...document.querySelectorAll<HTMLElement>('[role="button"]')].filter((el) => el.style.backgroundColor === 'rgb(188, 69, 96)');

it('tapping the selected day opens the day sheet; another day only selects it', async () => {
  await setup();
  view();
  expect(screen.getByTestId('day-card')).toBeTruthy();
  expect(screen.queryByTestId('day-sheet')).toBeNull();
  fireEvent.click(screen.getByTestId('day-2026-11-20'));
  expect(screen.queryByTestId('day-sheet')).toBeNull();
  expect(screen.getByTestId('day-2026-11-20').getAttribute('aria-selected')).toBe('true');
  fireEvent.click(screen.getByTestId('day-2026-11-20'));
  expect(screen.getByTestId('day-sheet')).toBeTruthy();
  fireEvent.click(screen.getByTestId('day-2026-11-19')); // a different day updates the open sheet in place
  expect(screen.getByTestId('day-sheet')).toBeTruthy();
  expect(within(screen.getByTestId('day-sheet')).getByRole('heading', { name: /Thursday 19 November/ })).toBeTruthy();
  fireEvent.click(screen.getByTestId('day-sheet-close'));
  expect(screen.getByTestId('day-card')).toBeTruthy();
});

it('the large detent shows the estimate and guidance sections, with her period lengths', async () => {
  const prediction = { suspended: false, asOf: TODAY };
  const history = { cycles: [{ id: 'c1', start: '2026-11-16' }], logs: [] };
  await setup({}, { prediction, history, settings: { lifeStates: [] } });
  view();
  fireEvent.click(screen.getByTestId('day-card-open'));
  expect(screen.queryByTestId('estimate-sections')).toBeNull(); // not built until the sheet is dragged up
  fireEvent.click(screen.getByTestId('sheet-expand'));
  expect(screen.getByTestId('estimate-sections')).toBeTruthy();
  expect(screen.getByTestId('guidance-sections')).toBeTruthy();
  expect(spies.estimate.mock.calls.at(-1)?.[0]).toMatchObject({ day: TODAY, showEstimate: true });
  fireEvent.click(screen.getByTestId('sheet-scrim'));
  expect(screen.queryByTestId('estimate-sections')).toBeNull();
  expect(screen.getByTestId('day-sheet')).toBeTruthy();
});

it('maps a drag to a detent', () => {
  expect(nextDetent('closed', -80)).toBe('small');
  expect(nextDetent('small', -80)).toBe('large');
  expect(nextDetent('large', 80)).toBe('small');
  expect(nextDetent('small', 80)).toBe('closed');
  expect(nextDetent('small', 10)).toBe('small');
});

it('removes a chip with its X and brings it back with Undo, append-only', async () => {
  const { store, db } = await setup();
  await setSymptom(store, TODAY, 'cramps', 1);
  view();
  fireEvent.click(await screen.findByTestId(`day-${TODAY}`));
  fireEvent.click(await screen.findByLabelText('Remove: Cramps 1/3'));
  await waitFor(async () => expect((await dayState(db, TODAY)).symptoms.cramps).toBeUndefined());
  expect(await screen.findByText('Removed: Cramps 1/3')).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); });
  await waitFor(async () => expect((await dayState(db, TODAY)).symptoms.cramps).toBe(1));
  expect((await store.events()).length).toBeGreaterThan(1);
});

it('Log is the only filled control, with the card closed and with the sheet open', async () => {
  await setup();
  view();
  expect(filledButtons().map((b) => b.getAttribute('data-testid'))).toEqual(['day-log']);
  fireEvent.click(screen.getByTestId('day-card-open'));
  expect(filledButtons().map((b) => b.getAttribute('data-testid'))).toEqual(['day-log']);
  fireEvent.click(screen.getByTestId('day-log'));
  expect(spies.push).toHaveBeenCalledWith({ pathname: '/log', params: { day: TODAY } });
});

it('a future day has no Log and says nothing is estimated', async () => {
  await setup();
  view();
  fireEvent.click(screen.getByTestId('day-2026-11-25'));
  expect(screen.queryByTestId('day-log')).toBeNull();
  expect(screen.queryByText('Nothing logged')).toBeNull();
  expect(screen.getByText('No estimate covers this day.')).toBeTruthy();
  expect(screen.getByTestId('cal-future-note')).toBeTruthy();
});

it('shows the cycle-day numbers, and hides them and their legend entry when the setting is off', async () => {
  await setup();
  const first = view();
  expect(screen.getByTestId(`cycle-day-${TODAY}`).textContent).toBe('3');
  expect(screen.getByText('Day of cycle')).toBeTruthy();
  first.unmount();
  await setup({ calendarCycleDay: false });
  view();
  expect(screen.queryByTestId(`cycle-day-${TODAY}`)).toBeNull();
  expect(screen.queryByText('Day of cycle')).toBeNull();
  expect(screen.getByTestId(`day-${TODAY}`).getAttribute('aria-label')).toContain('cycle day 3'); // the screen reader still hears it
});

it('a month-list row selects its day', async () => {
  const { store } = await setup();
  await setSymptom(store, '2026-11-10', 'cramps', 2);
  view();
  fireEvent.click(await screen.findByTestId('month-row-logged-2026-11-10'));
  expect(screen.getByTestId('day-2026-11-10').getAttribute('aria-selected')).toBe('true');
  expect(within(screen.getByTestId('day-card')).getByText(/Tuesday 10 November/)).toBeTruthy();
});

it('marks symptom days with an accent dot and other logs with a grey one, and the legend names both', async () => {
  const { store } = await setup();
  await setSymptom(store, '2026-11-10', 'cramps', 2);
  await setFlow(store, '2026-11-11', 'medium');
  await saveLh(store, '2026-11-12', 'negative');
  view();
  await screen.findByTestId('dot-symptom-2026-11-10');
  expect(screen.getByTestId('dot-logged-2026-11-12')).toBeTruthy();
  expect(screen.queryByTestId('dot-symptom-2026-11-12')).toBeNull();
  expect(screen.getByText('Symptoms')).toBeTruthy();
  expect(screen.getByText('Other log')).toBeTruthy();
  expect(screen.queryByText('Fertile window likelihood')).toBeTruthy();
});

it('the uncertain-estimates setting never outranks the ovulation-estimate switch', async () => {
  await setup({ showUncertainEstimates: true, showOvulationEstimate: false });
  view();
  expect(spies.buildMonth.mock.calls.at(-1)?.[0]).toMatchObject({ showEstimate: false, includeUncertain: false });
  expect(screen.queryByText('Fertile window likelihood')).toBeNull();
  cleanup();
  await setup({ showUncertainEstimates: true });
  view();
  expect(spies.buildMonth.mock.calls.at(-1)?.[0]).toMatchObject({ showEstimate: true, includeUncertain: true });
});

it('the toolbar Today pill is secondary: glass text colour, not filled', async () => {
  await setup();
  view();
  fireEvent.click(screen.getByTestId('cal-next'));
  const pill = screen.getByTestId('cal-today');
  expect(pill.style.backgroundColor).not.toBe('rgb(188, 69, 96)');
  fireEvent.click(pill);
  expect(screen.queryByTestId('cal-today')).toBeNull();
});
