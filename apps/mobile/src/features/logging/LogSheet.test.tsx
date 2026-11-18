import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccessibilityInfo } from 'react-native';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS } from '@/data/prefs';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { dayEvents, dayState, setFlow, setSymptom } from './actions';

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('@/state/app', () => ({ useApp: () => app.state }));
const nav = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => nav, useLocalSearchParams: () => ({}) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('./MoreSection', () => ({ MoreSection: () => null }));
vi.mock('./SymptomGrid', () => ({ SymptomGrid: () => null }));
vi.mock('./FlowSelector', () => ({ FlowSelector: ({ onChange }: { onChange: (v: string) => void }) => <button type="button" onClick={() => onChange('medium')}>Log medium</button> }));
import { LogSheet } from './LogSheet';

beforeEach(() => { Object.assign(AccessibilityInfo, { isReduceTransparencyEnabled: vi.fn().mockResolvedValue(true), addEventListener: vi.fn(() => ({ remove: vi.fn() })), announceForAccessibility: vi.fn() }); });
afterEach(cleanup);

it('logs an IUD period, preserves old other bleeding, and can explicitly reclassify it', async () => {
  const today = '2026-10-17';
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  const store = new EventStore(db, { nowMs: () => 1_700_000_000_000 + n++, iso: () => `${today}T08:00:00+10:00`, tz: () => 'Australia/Brisbane', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) });
  app.state = { db, store, today, prefs: DEFAULT_PREFS, settings: { lifeStates: [{ kind: 'hormonal_contraception', method: 'hormonal_iud', since: '2026-01-01' }] }, refresh: vi.fn() };
  const view = render(<LogSheet />);
  await waitFor(() => expect(screen.getByTestId('bleed-kind-period').getAttribute('aria-checked')).toBe('true'));
  fireEvent.click(screen.getByText('Log medium'));
  await waitFor(async () => expect((await dayState(db, today)).flowKind).toBe('period'));
  view.unmount();
  await setFlow(store, today, 'medium', { kind: 'on_contraception' });
  render(<LogSheet />);
  await waitFor(() => expect(screen.getByTestId('bleed-kind-on_contraception').getAttribute('aria-checked')).toBe('true'));
  expect((await dayState(db, today)).flowKind).toBe('on_contraception');
  fireEvent.click(screen.getByTestId('bleed-kind-period'));
  fireEvent.click(screen.getByText('Log medium'));
  await waitFor(async () => expect((await dayState(db, today)).flowKind).toBe('period'));
});

async function setup(today = '2026-10-17') {
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  const store = new EventStore(db, { nowMs: () => 1_700_000_000_000 + n++, iso: () => `${today}T08:00:00+10:00`, tz: () => 'Australia/Brisbane', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) });
  app.state = { db, store, today, prefs: DEFAULT_PREFS, settings: { lifeStates: [] }, refresh: vi.fn() };
  return { db, store, today };
}

it('shows Done as the one filled accent capsule', async () => {
  await setup();
  render(<LogSheet />);
  const done = screen.getByTestId('log-done');
  expect(done.style.backgroundColor).toBe('rgb(188, 69, 96)');
  expect(done.style.borderTopLeftRadius).toBe('999px');
  expect(done.getAttribute('aria-label')).toBe('Done, close the log sheet');
  // the day arrows stay quiet, not filled, and their glyphs are text-on-glass ink (rose text on glass is about 2.4:1)
  for (const id of ['log-prev', 'log-next']) {
    expect(screen.getByTestId(id).style.backgroundColor).not.toBe('rgb(188, 69, 96)');
    expect((screen.getByTestId(id).querySelector('[dir]') as HTMLElement).style.color).toBe('rgb(74, 66, 70)');
  }
});

it('shows today, the cycle day and Saved under the date, and the grabber closes the sheet', async () => {
  const { store, today } = await setup();
  Object.assign(app.state, { history: { cycles: [{ id: 'c1', start: '2026-10-15' }], logs: [] } });
  render(<LogSheet />);
  expect(await screen.findByText('Today · Day 3 of your cycle')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Close log sheet'));
  expect(nav.back).toHaveBeenCalledTimes(1);
  cleanup();
  await setSymptom(store, today, 'cramps', 1);
  render(<LogSheet />);
  expect(await screen.findByText('Today · Day 3 · Saved')).toBeTruthy();
  fireEvent.click(screen.getByTestId('log-prev'));
  expect(await screen.findByText('Day 2 of your cycle')).toBeTruthy(); // not today: no "Today", nothing logged that day
});

it('leaves the subline to Today alone when there is no cycle data', async () => {
  await setup();
  render(<LogSheet />);
  expect(await screen.findByText('Today')).toBeTruthy();
});

it('says nothing is logged on an empty day', async () => {
  await setup();
  render(<LogSheet />);
  expect(await screen.findByTestId('logged-empty')).toBeTruthy();
});

it('removes a logged entry with its chip and puts it back with Undo, append-only', async () => {
  const { store, db, today } = await setup();
  await setSymptom(store, today, 'cramps', 1);
  render(<LogSheet />);
  const remove = await screen.findByLabelText('Remove: Cramps (mild)');
  fireEvent.click(remove);
  await waitFor(async () => expect((await dayState(db, today)).symptoms.cramps).toBeUndefined());
  expect(await screen.findByText('Removed: Cramps (mild)')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(async () => expect((await dayState(db, today)).symptoms.cramps).toBe(1));
  expect((await store.events()).length).toBeGreaterThan(1); // nothing was deleted
});

it('sets energy from the slider and clears it with Clear', async () => {
  const { db, store, today } = await setup();
  render(<LogSheet />);
  fireEvent.click(await screen.findByTestId('energy-2'));
  await waitFor(async () => expect((await dayState(db, today)).energy).toBe(2));
  fireEvent.click(await screen.findByTestId('energy-clear'));
  await waitFor(async () => expect((await dayEvents(store, today)).filter((e) => e.kind === 'energy')).toHaveLength(0));
});

it('keeps the date on one line and lets it shrink (frame: "Monday 2 November")', async () => {
  await setup();
  render(<LogSheet />);
  const title = screen.getByTestId('log-title');
  expect(title.className).toMatch(/r-textOverflow-.*r-whiteSpace-/); // react-native-web's classes for numberOfLines={1}; adjustsFontSizeToFit (the shrink) is native only
});
