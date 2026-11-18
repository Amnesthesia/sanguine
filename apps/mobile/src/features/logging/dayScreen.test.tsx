// P8-19: returning from the log sheet refreshes changed and cleared energy entries. P8-31 (D-134): the slim day screen.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';
import { addDays, type EngineSettings, type History, type ISODate, predict } from '@sanguine/engine';
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
const push = vi.hoisted(() => vi.fn());
vi.mock('expo-router', () => ({ useRouter: () => ({ push }), useLocalSearchParams: () => ({ date: route.date }) }));
// react-native-svg ships Flow sources vitest cannot load; SVG text is kept as text so the range bar's "this day" can be read
vi.mock('react-native-svg', () => {
  const group = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const label = ({ children }: { children?: ReactNode }) => <span data-svg-text="">{children}</span>;
  return { default: group, G: group, Rect: () => null, Path: () => null, Line: () => null, Circle: () => null, Text: label };
});
vi.mock('@/ui/SubScreen', () => ({ SubScreen: ({ children, floating }: { children: ReactNode; floating?: ReactNode }) => <div>{children}{floating}</div> }));
import { ToastHost } from '@/ui/Toast';
import DayDetail from '@/app/day/[date]';

beforeEach(() => {
  Object.assign(AccessibilityInfo, { isReduceTransparencyEnabled: vi.fn().mockResolvedValue(true), addEventListener: vi.fn(() => ({ remove: vi.fn() })), announceForAccessibility: vi.fn() });
  push.mockClear();
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
const S: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };
/** Closed cycles of the given lengths, the last one starting `last`, each with a 4-day period; predicted by the engine, not built by hand. */
function hist(lengths: number[], last: ISODate): History {
  const starts: ISODate[] = [last];
  for (let i = lengths.length - 1; i >= 0; i--) starts.unshift(addDays(starts[0] as ISODate, -(lengths[i] as number)));
  return { cycles: starts.map((s, i) => ({ id: `c${i}`, start: s, end: addDays(s, 3), quality: 'valid' as const })), temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
}
const text = () => document.body.textContent ?? '';

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

it('shows the day\'s estimates as short rows and food and movement as two tiles, then More about this cycle; no full sections', async () => {
  const today = '2026-10-14';
  const { db, store } = await setup(today);
  const history = hist([28, 30, 29], '2026-10-01');
  const live = predict(history, S, today);
  const next = live.nextPeriod as NonNullable<typeof live.nextPeriod>;
  route.date = next.i80.lo;
  app.state = { db, store, today, prefs: DEFAULT_PREFS, profile: {}, version: 0, refresh: vi.fn(), prediction: live, history, settings: S };
  render(<DayDetail />);
  const rows = await screen.findAllByTestId('day-estimate-row');
  expect(rows[0]?.textContent).toMatch(/^ESTIMATEPeriod likely to start /);
  expect(screen.getByText('Estimates for this day')).toBeTruthy();
  expect(screen.getByText('Estimates are ranges worked out from your own logs, not promises.')).toBeTruthy();
  expect(screen.getAllByTestId('guidance-tile')).toHaveLength(2);
  expect(screen.queryByTestId('guidance-more')).toBeNull(); // one link, not Read more as well
  for (const gone of ['estimate-sections', 'guidance-sections', 'guidance-body', 'guidance-evidence-key']) expect(screen.queryByTestId(gone)).toBeNull();
  expect(text()).not.toContain('HOW IT WAS WORKED OUT');
  fireEvent.click(screen.getByTestId('this-cycle-more'));
  expect(push).toHaveBeenCalledWith({ pathname: '/insights', params: { tab: 'this-cycle', at: expect.any(String) } });
});

it('a future day opens with the you-can-log card; inside the wider range its range bar marks this day; no chips or log button', async () => {
  const today = '2026-10-14';
  const { db, store } = await setup(today);
  const history = hist([28, 30, 29], '2026-10-01');
  const live = predict(history, S, today);
  const next = live.nextPeriod as NonNullable<typeof live.nextPeriod>;
  await setSymptom(store, next.i95.lo, 'cramps', 1); // cannot happen in the app; the screen still must not list it
  route.date = next.i95.lo;
  app.state = { db, store, today, prefs: DEFAULT_PREFS, profile: {}, version: 0, refresh: vi.fn(), prediction: live, history, settings: S };
  render(<DayDetail />);
  const card = await screen.findByTestId('day-future-note');
  expect(card.textContent).toBe('You can log this day once it arrives.');
  expect(card.compareDocumentPosition(screen.getByTestId('day-estimates')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByLabelText(/This day, .* is marked on the bar\.$/)).toBeTruthy();
  expect(screen.queryByText('Nothing logged for this day.')).toBeNull();
  expect(screen.queryByRole('button', { name: /^Remove: Cramps/ })).toBeNull();
  expect(screen.queryByTestId('day-edit')).toBeNull();
  expect(screen.queryByText('Logged on this day')).toBeNull();
  expect(screen.queryByTestId('day-not-period')).toBeNull();
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

/** The rows on the most likely ovulation day of a typical cycle, for the given preferences and profile. */
const ovulationDayRows = async (prefs: object, profile: object) => {
  const today = '2026-10-14';
  const { db, store } = await setup(today);
  const history = hist([28, 30, 29], '2026-10-01');
  const live = predict(history, S, today);
  route.date = (live.ovulation as NonNullable<typeof live.ovulation>).point;
  app.state = { db, store, today, prefs: { ...DEFAULT_PREFS, ...prefs }, profile, version: 0, refresh: vi.fn(), prediction: live, history, settings: S };
  render(<DayDetail />);
  await screen.findByTestId('this-cycle-more');
  return screen.queryAllByTestId('day-estimate-row').map((r) => r.textContent ?? '').join(' | ');
};

it('an adult sees the ovulation estimate on its day', async () => {
  expect(await ovulationDayRows({ showUncertainEstimates: true }, {})).toMatch(/Ovulation estimate/);
});

it('teen mode: no ovulation or fertile row, even with the opt-in stored', async () => {
  expect(await ovulationDayRows({ showUncertainEstimates: true }, { birthDate: '2011-03-01' })).not.toMatch(/ovulation|fertile/i);
});

it('an adult who hides the ovulation estimate gets neither it nor the fertile window', async () => {
  expect(await ovulationDayRows({ showOvulationEstimate: false, showUncertainEstimates: true }, {})).not.toMatch(/ovulation|fertile/i);
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
  expect(screen.getByRole('heading', { name: 'Logged on this day' })).toBeTruthy();
  const more = await screen.findByTestId('this-cycle-more');
  expect(more.compareDocumentPosition(log) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
