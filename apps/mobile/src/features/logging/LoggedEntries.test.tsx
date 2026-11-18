import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccessibilityInfo } from 'react-native';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '@/i18n';
import { migrate } from '@/data/migrate';
import { DEFAULT_PREFS } from '@/data/prefs';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { ToastHost } from '@/ui/Toast';
import { dayEvents, dayState, setSymptom } from './actions';
import { LoggedEntries } from './LoggedEntries';
import { visibleEntries } from './removeEntry';

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('@/state/app', () => ({ useApp: () => app.state }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));

beforeEach(() => { Object.assign(AccessibilityInfo, { isReduceTransparencyEnabled: vi.fn().mockResolvedValue(true), addEventListener: vi.fn(() => ({ remove: vi.fn() })), announceForAccessibility: vi.fn() }); });
afterEach(cleanup);

async function setup() {
  const today = '2026-10-17';
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  const store = new EventStore(db, { nowMs: () => 1_700_000_000_000 + n++, iso: () => `${today}T08:00:00+10:00`, tz: () => 'Australia/Brisbane', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) });
  app.state = { db, store, today, prefs: DEFAULT_PREFS };
  return { db, store, today };
}

it('says nothing is logged for no entries', async () => {
  await setup();
  render(<LoggedEntries entries={[]} onChanged={() => {}} />);
  expect(screen.getByTestId('logged-empty')).toBeTruthy();
});

it('removes by retraction, reports through onChanged, and Undo puts it back', async () => {
  const { store, db, today } = await setup();
  await setSymptom(store, today, 'cramps', 2);
  const entries = visibleEntries(await dayEvents(store, today));
  const onChanged = vi.fn();
  render(<><LoggedEntries entries={entries} onChanged={onChanged} /><ToastHost /></>);
  fireEvent.click(screen.getByLabelText('Remove: Cramps (moderate)'));
  await waitFor(async () => expect((await dayState(db, today)).symptoms.cramps).toBeUndefined());
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(async () => expect((await dayState(db, today)).symptoms.cramps).toBe(2));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2));
  expect((await store.events()).length).toBeGreaterThan(1); // append-only: nothing deleted
});

it('uses the caller label when given', async () => {
  const { store, today } = await setup();
  await setSymptom(store, today, 'cramps', 1);
  render(<LoggedEntries entries={visibleEntries(await dayEvents(store, today))} onChanged={() => {}} labelFor={() => 'Cramps, from health'} />);
  expect(screen.getByText('Cramps, from health')).toBeTruthy();
});
