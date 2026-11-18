import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { addDays, type EngineSettings, type History, type ISODate, pastOvulations, predict } from '@sanguine/engine';
import type { ReactNode } from 'react';
import { AccessibilityInfo, PanResponder } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS, type Prefs } from '@/data/prefs';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { dayState, saveLh, setFlow, setSymptom } from '@/features/logging/actions';
import type * as CalendarModel from './calendarModel';
import { nextDetent, sheetMaxHeight } from './DaySheet';

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

const S: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };
function hist(lengths: number[], last: ISODate, bleed = 4): History {
  const starts: ISODate[] = [last];
  for (let i = lengths.length - 1; i >= 0; i--) starts.unshift(addDays(starts[0] as ISODate, -(lengths[i] as number)));
  return { cycles: starts.map((s, i) => ({ id: `c${i}`, start: s, end: addDays(s, bleed - 1), quality: 'valid' as const })), temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
}

it('the large detent shows the estimate and guidance sections, with her period lengths', async () => {
  const history = hist([28, 29, 28], '2026-11-12', 5);
  const prediction = predict(history, S, TODAY);
  await setup({}, { prediction, history, settings: S });
  view();
  fireEvent.click(screen.getByTestId('day-card-open'));
  expect(screen.queryByTestId('estimate-sections')).toBeNull(); // not built until the sheet is dragged up
  fireEvent.click(screen.getByTestId('sheet-expand'));
  expect(screen.getByTestId('estimate-sections')).toBeTruthy();
  expect(screen.getByTestId('guidance-sections')).toBeTruthy();
  expect(spies.estimate.mock.calls.at(-1)?.[0]).toMatchObject({ day: TODAY, showEstimate: true, periodLengths: [5, 5, 5], cycleStarts: history.cycles.map((c) => c.start), periodDays: expect.any(Set) });
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

it('releasing a drag on the day card or the open sheet header moves the sheet one detent', async () => {
  const create = vi.spyOn(PanResponder, 'create');
  await setup();
  view();
  const release = () => (create.mock.calls[create.mock.calls.length - 1]?.[0] as unknown as { onPanResponderRelease: (e: unknown, g: { dy: number; dx: number }) => void } | undefined)?.onPanResponderRelease({}, { dy: -80, dx: 0 });
  expect(screen.getByTestId('day-card')).toBeTruthy();
  act(release);
  expect(screen.getByTestId('day-sheet')).toBeTruthy(); // closed -> small
  act(release);
  expect(screen.getByTestId('day-sheet-large')).toBeTruthy(); // small -> large
  create.mockRestore();
});

it('the small detent is height-bounded, with the entries and estimates in a scroll area and the header and actions pinned', async () => {
  const { store } = await setup();
  for (const code of ['cramps', 'headache', 'acne', 'bloating', 'fatigue']) await setSymptom(store, TODAY, code, 2);
  view();
  fireEvent.click(await screen.findByTestId('day-card-open'));
  const scroll = await screen.findByTestId('sheet-scroll');
  expect(scroll.style.maxHeight).toMatch(/^\d+(\.\d+)?px$/);
  expect(within(scroll).getAllByRole('button', { name: /^Remove:/ }).length).toBe(5);
  for (const id of ['sheet-grabber', 'day-sheet-close', 'sheet-expand', 'day-log', 'day-details']) {
    expect(screen.getByTestId(id)).toBeTruthy();
    expect(scroll.contains(screen.getByTestId(id))).toBe(false);
  }
});

it('sheetMaxHeight leaves the sheet room above the tab bar and below the toolbar, also at 150% text', () => {
  // a 667 pt phone: the toolbar is taller at 150% (its second row and the title grow), so the sheet gets less, never more than the window
  const toolbar = (scale: number) => 20 + 8 + 60 * scale; // status bar + inset + measured toolbar
  const at100 = sheetMaxHeight(667, toolbar(1), 0);
  const at150 = sheetMaxHeight(667, toolbar(1.5), 0);
  expect(at150).toBeLessThan(at100);
  expect(at150 + toolbar(1.5)).toBeLessThanOrEqual(667 - 20);
  // pinned parts at 150%: grabber, a two-line title and subline, Show details and a two-line Log button, plus paddings and gaps
  const pinned = (20 + 2 * 22 * 1.5 + 20 * 1.5) + (44 * 1.5 + 12 + 2 * 22 * 1.5 + 12) + 8 + 16 + 12 * 2;
  expect(at150 - pinned).toBeGreaterThan(96); // the list keeps a usable scroll area
  expect(sheetMaxHeight(300, 200, 0)).toBe(240); // a tiny window still gets the floor, not a negative height
});

it('the large detent is modal: the screen behind it is hidden from screen readers', async () => {
  await setup();
  const { container } = view();
  const behind = () => container.querySelector('[data-testid="screen-calendar"]')?.parentElement as HTMLElement;
  expect(behind().getAttribute('aria-hidden')).not.toBe('true');
  fireEvent.click(screen.getByTestId('day-card-open'));
  fireEvent.click(screen.getByTestId('sheet-expand'));
  expect(screen.getByTestId('day-sheet-large').getAttribute('aria-modal')).toBe('true');
  expect(behind().getAttribute('aria-hidden')).toBe('true');
  fireEvent.click(screen.getByTestId('sheet-scrim'));
  expect(behind().getAttribute('aria-hidden')).not.toBe('true');
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

it('the toolbar Today pill is always there, secondary (glass text colour, not filled), and returns to this month', async () => {
  await setup();
  view();
  const pill = screen.getByTestId('cal-today'); // on the current month too, as in the frame
  expect(pill.style.backgroundColor).not.toBe('rgb(188, 69, 96)');
  fireEvent.click(screen.getByTestId('cal-next'));
  expect(screen.getByTestId('cal-title').textContent).toBe('December 2026');
  fireEvent.click(screen.getByTestId('cal-today'));
  expect(screen.getByTestId('cal-title').textContent).toBe('November 2026');
  expect(screen.getByTestId('cal-today')).toBeTruthy();
});

it('the closed card\'s round Log button draws the plus glyph, not the word', async () => {
  await setup();
  view();
  const log = screen.getByTestId('day-log');
  expect(log.textContent).toBe('');
  expect(log.getAttribute('aria-label')).toMatch(/^Log: /);
});

it('the day sheet and the chips use the shared LoggedEntries removal (retract, toast, Undo)', async () => {
  const { store, db } = await setup();
  await setSymptom(store, TODAY, 'cramps', 1);
  view();
  fireEvent.click(await screen.findByTestId('day-card-open'));
  fireEvent.click(await screen.findByLabelText('Remove: Cramps 1/3'));
  await waitFor(async () => expect((await dayState(db, TODAY)).symptoms.cramps).toBeUndefined());
  expect(await screen.findByText('Removed: Cramps 1/3')).toBeTruthy();
});

describe('teen profile with an uncertain ovulation estimate (D-115)', () => {
  const irregular = hist([24, 38, 31, 45, 27, 36], '2026-11-01');
  const prediction = predict(irregular, S, TODAY);
  const past = pastOvulations(irregular, S);
  const ovPoint = (prediction.ovulation as NonNullable<typeof prediction.ovulation>).point;
  const state = (profile: Record<string, unknown>) => ({ prediction, history: irregular, settings: S, profile });
  it('control: an adult who opted in sees the uncertain estimate drawn and listed', async () => {
    await setup({ showUncertainEstimates: true }, state({ birthYear: 1990 }));
    view();
    expect(past.length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-testid^="fertile-"]').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ovulation estimate')).toBeTruthy();
  });
  it('a teen draws and says nothing about ovulation or the fertile window, even with the stored switch on', async () => {
    await setup({ showUncertainEstimates: true }, state({ birthDate: '2012-05-01' }));
    view();
    expect(spies.buildMonth.mock.calls.at(-1)?.[0]).toMatchObject({ showEstimate: false, includeUncertain: false });
    expect(document.querySelectorAll('[data-testid^="fertile-"]')).toHaveLength(0);
    for (const c of document.querySelectorAll('[data-testid^="day-2"]')) expect(c.getAttribute('aria-label')).not.toMatch(/ovulation|fertile/i);
    expect(document.querySelectorAll('[data-testid^="month-row-ovulation"], [data-testid^="month-row-fertile"]')).toHaveLength(0);
    for (const r of document.querySelectorAll('[data-testid^="month-row-"]')) expect(r.getAttribute('aria-label')).not.toMatch(/ovulation|fertile/i);
    expect(screen.queryByText('Ovulation estimate')).toBeNull();
    expect(screen.queryByText('Fertile window likelihood')).toBeNull();
    expect(screen.queryByTestId('cal-uncertain')).toBeNull();
    expect(screen.queryByTestId('cal-fertile-caption')).toBeNull();
    // the open sheet on the ovulation day: no estimate line about ovulation; the large detent builds its sections for a teen
    fireEvent.click(screen.getByTestId(`day-${ovPoint}`));
    fireEvent.click(screen.getByTestId(`day-${ovPoint}`));
    for (const l of screen.queryAllByTestId('sheet-estimate')) expect(l.textContent).not.toMatch(/ovulation|fertile/i);
    fireEvent.click(screen.getByTestId('sheet-expand'));
    expect(spies.estimate.mock.calls.at(-1)?.[0]).toMatchObject({ showEstimate: false, includeUncertain: false });
  });
});
