import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { addDays, type EngineSettings, type History, type ISODate, pastOvulations, predict } from '@sanguine/engine';
import type { ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS, type Prefs } from '@/data/prefs';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { dayState, saveLh, setFlow, setSymptom } from '@/features/logging/actions';
import type * as CalendarModel from './calendarModel';
import { sheetMaxHeight } from './DaySheet';
import type { Detent } from './sheetSnap';

type Model = typeof CalendarModel;
type BuildInput = Parameters<Model['buildMonth']>[0];

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
const spies = vi.hoisted(() => ({ buildMonth: vi.fn(), push: vi.fn() }));
const route = vi.hoisted(() => ({ params: {} as Record<string, string> }));
vi.mock('react-native-svg', () => { const none = () => null; return { default: none, Rect: none, Path: none, Line: none, Circle: none, G: none, Text: none }; });
vi.mock('@/state/app', () => ({ useApp: (sel?: (s: unknown) => unknown) => (sel ? sel(app.state) : app.state) }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: spies.push, back: vi.fn() }), useLocalSearchParams: () => route.params }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('./SwipeMonth', () => ({ SwipeMonth: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
// the movement runs on the UI thread (reanimated, gesture handler; its snapping is tested in sheetSnap.test.ts): here the sheet shows the detent it is at
vi.mock('./SheetMotion', () => ({
  SheetMotion: ({ detent, scrim, children }: { detent: Detent; scrim: ReactNode; children: (d: Detent, grip: (n: ReactNode) => ReactNode, largeH: number) => ReactNode }) => <>{detent === 'large' ? scrim : null}{children(detent, (n) => n, 700)}</>,
}));
vi.mock('@/services/locale', () => ({ deviceWeekStart: () => 'mon', deviceRegion: () => 'AU' }));
// the real model (the bar names a paused state from it), without its notice cards
vi.mock('@/features/today/todayModel', async (orig) => { const m = await orig<typeof import('@/features/today/todayModel')>(); return { ...m, buildToday: (i: Parameters<typeof m.buildToday>[0]) => ({ ...m.buildToday(i), flags: [] }) }; });
vi.mock('@/features/guidance/guidance', async (orig) => ({ ...(await orig<object>()), phaseOn: () => ({ phase: 'follicular', expected: false }) }));
vi.mock('./calendarModel', async (orig) => {
  const m = await orig<Model>();
  return { ...m, buildMonth: (i: BuildInput) => { spies.buildMonth(i); return m.buildMonth(i); } };
});
import CalendarScreen from '@/app/(tabs)/calendar';
import { ToastHost } from '@/ui/Toast';

const TODAY = '2026-11-18';
beforeEach(() => {
  Object.assign(AccessibilityInfo, { isReduceTransparencyEnabled: vi.fn().mockResolvedValue(true), addEventListener: vi.fn(() => ({ remove: vi.fn() })), announceForAccessibility: vi.fn() });
  spies.push.mockClear(); spies.buildMonth.mockClear();
});
afterEach(() => { cleanup(); route.params = {}; Reflect.deleteProperty(globalThis, '__DEV__'); });

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

// the verification harness opens a day and a sheet detent from a link (P8-24); dev builds only
describe('dev deep link: ?day=&sheet=', () => {
  it('selects the day and opens the sheet at the requested detent in a dev build', async () => {
    await setup();
    Object.assign(globalThis, { __DEV__: true });
    route.params = { day: '2026-11-02', sheet: 'large' };
    view();
    await waitFor(() => expect(screen.getByTestId('day-sheet-large')).toBeTruthy());
    expect(screen.getByTestId('day-2026-11-02').getAttribute('aria-selected')).toBe('true');
  });
  it('sheet=small opens the sheet and sheet=closed leaves the bar', async () => {
    await setup();
    Object.assign(globalThis, { __DEV__: true });
    route.params = { day: '2026-11-02', sheet: 'small' };
    view();
    await waitFor(() => expect(screen.getByTestId('day-sheet')).toBeTruthy());
    cleanup();
    route.params = { day: '2026-11-02', sheet: 'closed' };
    view();
    expect(screen.getByTestId('day-card')).toBeTruthy();
    expect(screen.getByTestId('day-2026-11-02').getAttribute('aria-selected')).toBe('true');
  });
  it('ignores malformed values', async () => {
    await setup();
    Object.assign(globalThis, { __DEV__: true });
    route.params = { day: 'tomorrow', sheet: 'huge' };
    view();
    expect(screen.getByTestId('day-card')).toBeTruthy();
    expect(screen.getByTestId(`day-${TODAY}`).getAttribute('aria-selected')).toBe('true');
  });
  it('is ignored when __DEV__ is not true', async () => {
    await setup();
    route.params = { day: '2026-11-02', sheet: 'large' };
    view();
    expect(screen.getByTestId('day-card')).toBeTruthy();
    expect(screen.queryByTestId('day-sheet-large')).toBeNull();
    expect(screen.getByTestId(`day-${TODAY}`).getAttribute('aria-selected')).toBe('true');
  });
});

const S: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };
function hist(lengths: number[], last: ISODate, bleed = 4): History {
  const starts: ISODate[] = [last];
  for (let i = lengths.length - 1; i >= 0; i--) starts.unshift(addDays(starts[0] as ISODate, -(lengths[i] as number)));
  return { cycles: starts.map((s, i) => ({ id: `c${i}`, start: s, end: addDays(s, bleed - 1), quality: 'valid' as const })), temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
}

it('the large detent is slim: the day\'s estimate rows with meters, the compact curve and More about this cycle; no full sections (D-134)', async () => {
  const history = hist([28, 29, 28], '2026-11-12', 5);
  const prediction = predict(history, S, TODAY);
  const next = prediction.nextPeriod as NonNullable<typeof prediction.nextPeriod>;
  await setup({}, { prediction, history, settings: S });
  Object.assign(globalThis, { __DEV__: true });
  route.params = { day: next.point, sheet: 'small' };
  view();
  await waitFor(() => expect(screen.getByTestId('day-sheet')).toBeTruthy());
  expect(screen.queryByTestId('day-estimates')).toBeNull(); // not built until the sheet is dragged up
  fireEvent.click(screen.getByTestId('sheet-expand'));
  const large = screen.getByTestId('day-sheet-large');
  expect(within(large).getByText('Estimates for this day')).toBeTruthy();
  const row = within(large).getAllByTestId('day-estimate-row')[0] as HTMLElement;
  expect(row.textContent).toMatch(/^ESTIMATEPeriod likely to start /);
  expect(within(row).getByLabelText(/^(Confident|Fair estimate|Rough estimate)$/)).toBeTruthy();
  expect(within(large).getByTestId('hormone-curve-compact')).toBeTruthy();
  expect(within(large).getByTestId('guidance-body-compact')).toBeTruthy();
  for (const gone of ['estimate-next-period', 'estimate-ovulation', 'guidance-sections', 'guidance-evidence-key', 'hormone-curve']) expect(within(large).queryByTestId(gone)).toBeNull();
  expect(large.textContent).not.toContain('HOW IT WAS WORKED OUT');
  fireEvent.click(within(large).getByTestId('this-cycle-more'));
  expect(spies.push).toHaveBeenCalledWith({ pathname: '/insights', params: { tab: 'this-cycle', at: expect.any(String) } });
  fireEvent.click(screen.getByTestId('sheet-scrim'));
  expect(screen.queryByTestId('day-estimates')).toBeNull();
  expect(screen.getByTestId('day-sheet')).toBeTruthy();
});

it('the sheet minimises to a compact bar: the date circle, the cycle day and period word, and Log; every detent has a labelled button', async () => {
  const { store } = await setup();
  await setFlow(store, TODAY, 'medium');
  view();
  const bar = screen.getByTestId('day-card');
  expect(within(bar).getByText(/^Day 3 of your cycle/)).toBeTruthy();
  expect(within(bar).getByTestId('day-log')).toBeTruthy();
  expect(within(bar).queryByText(/Medium flow|Flow/)).toBeNull(); // the chips live in the sheet, not on the bar
  // the bar's one button says the whole day to a screen reader and opens the sheet
  const open = screen.getByTestId('day-card-open');
  expect(open.getAttribute('aria-label')).toMatch(/^Today, Wednesday 18 November\. Day 3 of your cycle.*Open the day sheet$/);
  fireEvent.click(open);
  expect(screen.getByTestId('day-sheet')).toBeTruthy();
  fireEvent.click(screen.getByTestId('sheet-grabber')); // Show details
  expect(screen.getByTestId('day-sheet-large')).toBeTruthy();
  expect(screen.getByTestId('sheet-grabber').getAttribute('aria-label')).toBe('Hide the details');
  fireEvent.click(screen.getByTestId('day-sheet-close'));
  expect(screen.getByTestId('day-sheet')).toBeTruthy();
  fireEvent.click(screen.getByTestId('day-sheet-close')); // collapses to the bar
  expect(screen.getByTestId('day-card')).toBeTruthy();
});

it('one Show details in the open sheet; the day screen opens from the large detent as Open day', async () => {
  await setup();
  view();
  fireEvent.click(screen.getByTestId('day-card-open'));
  expect(screen.getAllByText('Show details')).toHaveLength(1);
  expect(screen.queryByText('Details')).toBeNull();
  expect(screen.queryByTestId('day-open')).toBeNull();
  fireEvent.click(screen.getByTestId('sheet-expand'));
  const openDay = screen.getByTestId('day-open');
  expect(openDay.textContent).toBe('Open day');
  expect(openDay.getAttribute('aria-label')).toBe('Open the full day screen: Wednesday 18 November');
  fireEvent.click(openDay);
  expect(spies.push).toHaveBeenCalledWith({ pathname: '/day/[date]', params: { date: TODAY } });
  expect(filledButtons().map((b) => b.getAttribute('data-testid'))).toEqual(['day-log']);
});

it('the month list, legend and grid sit inside the 16 pt screen gutter, and the list text is inset from its hairlines', async () => {
  const { store } = await setup();
  await setSymptom(store, '2026-11-10', 'cramps', 2);
  view();
  const row = await screen.findByTestId('month-row-logged-2026-11-10');
  const padded = (el: HTMLElement | null) => { for (let e = el; e; e = e.parentElement) if (e.style.paddingLeft === '16px' && e.style.paddingRight === '16px') return e; return null; };
  const gutter = padded(screen.getByTestId('month-list'));
  expect(gutter).not.toBeNull();
  for (const id of ['cal-grid', 'cal-legend-rule']) expect(gutter?.contains(screen.getByTestId(id))).toBe(true);
  expect(row.style.paddingLeft).toBe('8px');
  expect(row.style.paddingRight).toBe('8px');
});

it('the small detent is height-bounded, with the entries and estimates in a scroll area and the header and actions pinned', async () => {
  const { store } = await setup();
  for (const code of ['cramps', 'headache', 'acne', 'bloating', 'fatigue']) await setSymptom(store, TODAY, code, 2);
  view();
  fireEvent.click(await screen.findByTestId('day-card-open'));
  const scroll = await screen.findByTestId('sheet-scroll');
  expect(scroll.style.maxHeight).toMatch(/^\d+(\.\d+)?px$/);
  expect(within(scroll).getAllByRole('button', { name: /^Remove:/ }).length).toBe(5);
  expect(screen.queryByTestId('day-details')).toBeNull();
  for (const id of ['sheet-grabber', 'day-sheet-close', 'sheet-expand', 'day-log']) {
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
  fireEvent.click(await screen.findByLabelText('Remove: Cramps (mild)'));
  await waitFor(async () => expect((await dayState(db, TODAY)).symptoms.cramps).toBeUndefined());
  expect(await screen.findByText('Removed: Cramps (mild)')).toBeTruthy();
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
  expect(screen.getByTestId('day-card-open').getAttribute('aria-label')).toContain('No estimate covers this day.');
  fireEvent.click(screen.getByTestId('day-card-open'));
  expect(screen.queryByText('Nothing logged')).toBeNull();
  expect(screen.getByText('No estimate covers this day.')).toBeTruthy();
  expect(screen.getByTestId('cal-future-note')).toBeTruthy();
  expect(screen.queryByTestId('day-log')).toBeNull();
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
  expect(screen.getByTestId('day-card-open').getAttribute('aria-label')).toMatch(/^Tuesday 10 November\./);
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
  // no prediction: nothing estimated is drawn, so the legend names no estimate (D-118: it follows what is drawn)
  expect(screen.queryAllByText('Fertile window, estimate')).toHaveLength(0);
  expect(screen.queryByText('Period, estimate')).toBeNull();
});

it('the uncertain-estimates setting never outranks the ovulation-estimate switch', async () => {
  await setup({ showUncertainEstimates: true, showOvulationEstimate: false });
  view();
  expect(spies.buildMonth.mock.calls.at(-1)?.[0]).toMatchObject({ showEstimate: false, includeUncertain: false });
  expect(screen.queryAllByText('Fertile window, estimate')).toHaveLength(0);
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
  fireEvent.click(await screen.findByLabelText('Remove: Cramps (mild)'));
  await waitFor(async () => expect((await dayState(db, TODAY)).symptoms.cramps).toBeUndefined());
  expect(await screen.findByText('Removed: Cramps (mild)')).toBeTruthy();
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
    expect(screen.queryAllByText('Ovulation, estimate').length).toBeGreaterThan(0);
  });
  it('a teen draws and says nothing about ovulation or the fertile window, even with the stored switch on', async () => {
    await setup({ showUncertainEstimates: true }, state({ birthDate: '2012-05-01' }));
    view();
    expect(spies.buildMonth.mock.calls.at(-1)?.[0]).toMatchObject({ showEstimate: false, includeUncertain: false });
    expect(document.querySelectorAll('[data-testid^="fertile-"]')).toHaveLength(0);
    for (const c of document.querySelectorAll('[data-testid^="day-2"]')) expect(c.getAttribute('aria-label')).not.toMatch(/ovulation|fertile/i);
    expect(document.querySelectorAll('[data-testid^="month-row-ovulation"], [data-testid^="month-row-fertile"]')).toHaveLength(0);
    for (const r of document.querySelectorAll('[data-testid^="month-row-"]')) expect(r.getAttribute('aria-label')).not.toMatch(/ovulation|fertile/i);
    expect(screen.queryAllByText('Ovulation, estimate')).toHaveLength(0);
    expect(screen.queryAllByText('Fertile window, estimate')).toHaveLength(0);
    expect(screen.queryByTestId('cal-uncertain')).toBeNull();
    expect(screen.queryByTestId('cal-fertile-caption')).toBeNull();
    // the open sheet on the ovulation day: no estimate line about ovulation, at the small detent and at the large one
    fireEvent.click(screen.getByTestId(`day-${ovPoint}`));
    fireEvent.click(screen.getByTestId(`day-${ovPoint}`));
    for (const l of screen.queryAllByTestId('sheet-estimate')) expect(l.textContent).not.toMatch(/ovulation|fertile/i);
    fireEvent.click(screen.getByTestId('sheet-expand'));
    expect(screen.getByTestId('day-sheet-large').textContent).not.toMatch(/ovulation|fertile/i);
  });
});

// ---- P8-29 ----
describe('next-period rings (fix plan C3)', () => {
  // 28-day cycles from 4 Nov: the next period's 80% range runs into December, so the November grid shows it on its spill-over days
  const history = hist([28, 28, 28], '2026-11-04');
  const prediction = predict(history, S, TODAY);
  const cellsWith = (re: RegExp) => [...document.querySelectorAll<HTMLElement>('[data-testid^="day-2"]')].filter((c) => re.test(c.getAttribute('aria-label') ?? ''));
  it('the 80% range is a 2 pt dashed ring, the 95% edge a 1 pt dotted one with its own legend entry', async () => {
    await setup({}, { prediction, history, settings: S });
    view();
    const core = cellsWith(/80% range/)[0];
    const edge = cellsWith(/95% range/)[0];
    expect(core && edge).toBeTruthy();
    const ring = (c: HTMLElement) => screen.getByTestId(`disc-${c.getAttribute('data-testid')?.slice(4)}`).style;
    expect([ring(core as HTMLElement).borderTopWidth, ring(core as HTMLElement).borderTopStyle]).toEqual(['2px', 'dashed']);
    expect([ring(edge as HTMLElement).borderTopWidth, ring(edge as HTMLElement).borderTopStyle]).toEqual(['1px', 'dotted']);
    expect(screen.getByText('Period, estimate')).toBeTruthy();
    expect(screen.getByText('Period, wider range')).toBeTruthy();
  });
  it('outside the month only the date fades: an 80% ring in December keeps full strength', async () => {
    await setup({}, { prediction, history, settings: S });
    view();
    const dec = cellsWith(/80% range/).find((c) => c.getAttribute('data-testid')?.startsWith('day-2026-12'));
    expect(dec).toBeTruthy();
    const date = (dec as HTMLElement).getAttribute('data-testid')?.slice(4) as string;
    expect((dec as HTMLElement).style.opacity).not.toBe('0.4');
    expect(screen.getByTestId(`disc-${date}`).style.opacity).not.toBe('0.4');
    expect(screen.getByTestId(`disc-${date}-text`).style.opacity).toBe('0.4');
  });
});

it('the dotted ovulation range is drawn with dots, not a one-sided dotted border (iOS draws that solid)', async () => {
  const history = hist([28, 29, 28], '2026-11-12', 5);
  await setup({}, { prediction: predict(history, S, TODAY), history, settings: S });
  view();
  const marks = document.querySelectorAll('[data-testid^="ov-range-"]');
  expect(marks.length).toBeGreaterThan(0);
  for (const m of marks) expect(m.children.length).toBe(4);
});

it('pregnant (estimates paused): no cycle-day numbers, the bar names the state, no fertility or estimate legend (fix plan C5)', async () => {
  const history = hist([28, 28], '2026-10-01');
  const settings: EngineSettings = { ...S, lifeStates: [{ kind: 'pregnant', since: '2026-10-20' }] };
  const prediction = predict(history, settings, TODAY);
  expect(prediction.suspended).toBeDefined();
  await setup({}, { prediction, history, settings });
  view();
  expect(document.querySelectorAll('[data-testid^="cycle-day-"]')).toHaveLength(0);
  const bar = screen.getByTestId('day-card');
  expect(within(bar).queryByText(/of your cycle/)).toBeNull();
  expect(within(bar).getByText('Pregnant')).toBeTruthy();
  for (const word of ['Day of cycle', 'Fertile window, estimate', 'Ovulation, estimate', 'Period, estimate']) expect(screen.queryByText(word)).toBeNull();
  fireEvent.click(screen.getByTestId('day-card-open'));
  expect(within(screen.getByTestId('day-sheet')).queryByText(/Day \d+/)).toBeNull();
});

it('the bar\'s disc is drawn like the selected grid cell, and the round Log is white ink on the primary fill', async () => {
  await setup();
  view();
  fireEvent.click(screen.getByTestId('day-2026-11-20')); // a plain selected day: accentSoft fill in the grid
  expect(screen.getByTestId('bar-disc').style.backgroundColor).toBe(screen.getByTestId('disc-2026-11-20').style.backgroundColor);
  expect(screen.getByTestId('bar-disc').style.backgroundColor).toBe('rgb(244, 220, 224)');
});

it('single-letter weekdays; the month list is headed by the month name alone, with one date column width', async () => {
  const { store } = await setup();
  await setSymptom(store, '2026-11-10', 'cramps', 2);
  await setSymptom(store, '2026-11-11', 'cramps', 1);
  view();
  await screen.findByTestId('month-row-logged-2026-11-11');
  expect(screen.getByTestId('cal-weekdays').textContent).toBe('MTWTFSS');
  expect(within(screen.getByTestId('month-list')).getByRole('heading').textContent).toBe('November');
  const widths = [...document.querySelectorAll<HTMLElement>('[data-testid^="month-date-"]')].map((d) => d.style.width);
  expect(widths.length).toBeGreaterThan(1);
  expect(new Set(widths).size).toBe(1);
});

