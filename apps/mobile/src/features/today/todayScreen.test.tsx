import type { ReactNode } from 'react';
import { type EngineSettings, type History, type ISODate, addDays, predict } from '@sanguine/engine';
import { colors, glass } from '@sanguine/ui-tokens';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccessibilityInfo } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS, type Prefs } from '@/data/prefs';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { dayState, setSymptom } from '@/features/logging/actions';
import { contrast, over } from '../../../../../packages/ui-tokens/src/contrast';

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
const env = vi.hoisted(() => ({ platform: 'ios' as 'ios' | 'android', scheme: 'light' as 'light' | 'dark' }));
vi.mock('@/state/app', () => ({ useApp: (sel?: (s: unknown) => unknown) => (sel ? sel(app.state) : app.state) }));
const push = vi.hoisted(() => vi.fn());
vi.mock('expo-router', () => ({ useRouter: () => ({ push, back: vi.fn() }) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }), SafeAreaView: ({ children }: { children: ReactNode }) => children }));
// react-native-svg ships Flow sources vitest cannot load; drawing is checked on the simulator, these tests cover words, structure and accessibility
vi.mock('react-native-svg', () => { const n = () => null; return { default: n, Circle: n, Defs: n, Ellipse: n, G: n, Line: n, Path: n, RadialGradient: n, Stop: n, Rect: n, Text: n }; });
vi.mock('expo-glass-effect', () => ({ GlassView: ({ children }: { children: ReactNode }) => <div data-testid="glass-view">{children}</div>, isLiquidGlassAvailable: () => true, isGlassEffectAPIAvailable: () => true }));
vi.mock('expo-blur', () => ({ BlurView: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('expo-haptics', () => ({ impactAsync: vi.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
vi.mock('@/theme', async (orig) => { const m = await orig<typeof import('@/theme')>(); return { ...m, useTheme: () => m.buildTheme(env.scheme, env.platform) }; });
import TodayScreen from '@/app/(tabs)/today';
import { ToastHost } from '@/ui/Toast';

const S: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };
function hist(lengths: number[], last: ISODate = '2026-10-01', bleed = 4): History {
  const starts: ISODate[] = [last];
  for (let i = lengths.length - 1; i >= 0; i--) starts.unshift(addDays(starts[0] as ISODate, -(lengths[i] as number)));
  return { cycles: starts.map((s, i) => ({ id: `c${i}`, start: s, end: addDays(s, bleed), quality: 'valid' as const })), temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
}
/** The last period is still open (no end logged yet), as on day 2 of a period. */
const open = (h: History): History => ({ ...h, cycles: h.cycles.map((c, i) => (i === h.cycles.length - 1 ? { id: c.id, start: c.start, quality: c.quality } : c)) });
const EMPTY: History = { cycles: [], temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };

async function setup(o: { today: ISODate; history?: History; settings?: EngineSettings; prefs?: Partial<Prefs>; profile?: Record<string, unknown> }) {
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  const store = new EventStore(db, { nowMs: () => 1_700_000_000_000 + n++, iso: () => `${o.today}T08:00:00+10:00`, tz: () => 'Australia/Brisbane', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) });
  const history = o.history ?? hist([28, 30, 29]);
  const settings = o.settings ?? S;
  app.state = {
    db, store, today: o.today, history, settings, prediction: history.cycles.length ? predict(history, settings, o.today) : undefined,
    prefs: { ...DEFAULT_PREFS, ...o.prefs }, profile: o.profile ?? {}, version: 0, refresh: vi.fn().mockResolvedValue(undefined), muteFlag: vi.fn(),
  };
  return { db, store };
}
const body = () => document.body.textContent ?? '';
const view = () => render(<><ToastHost /><TodayScreen /></>);

beforeEach(() => {
  env.platform = 'ios'; env.scheme = 'light';
  Object.assign(AccessibilityInfo, { isReduceTransparencyEnabled: vi.fn().mockResolvedValue(false), addEventListener: vi.fn(() => ({ remove: vi.fn() })), announceForAccessibility: vi.fn() });
});
afterEach(cleanup);

describe('Today, typical day', () => {
  it('shows the dial, glass estimate cards with a tag and meter, and the legend caption', async () => {
    await setup({ today: '2026-10-13' });
    view();
    expect(screen.getByTestId('cycle-dial')).toBeTruthy();
    expect(screen.getByTestId('next-period-card').textContent).toMatch(/Period likely in/);
    expect(screen.getByTestId('estimate-card')).toBeTruthy();
    expect(screen.getAllByText('ESTIMATE').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByTestId('meter-bar').length).toBeGreaterThanOrEqual(6);
    expect(screen.getByTestId('estimate-legal').textContent).toContain('Do not use it to prevent pregnancy.');
    expect(screen.getByTestId('today-legend').textContent).toBe('darker = more likely to be in the fertile window');
    expect(screen.getByTestId('hero-wash')).toBeTruthy();
    // both estimate cards are GlassSurface (its highlight); the material itself loads lazily and a second concurrent load fails under vitest (__DEV__ undefined), so it is not counted
    expect(screen.getAllByTestId('glass-highlight').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('today-footer').textContent).toBe('Estimates are ranges, not promises. Not a contraceptive.');
  });

  it('shows food and movement as two tiles with Read more, which opens Insights > This cycle (D-134)', async () => {
    await setup({ today: '2026-10-13' });
    view();
    expect(screen.getAllByTestId('guidance-tile')).toHaveLength(2);
    expect(screen.queryByTestId('guidance-body')).toBeNull();
    push.mockClear();
    fireEvent.click(screen.getByTestId('guidance-more'));
    expect(push).toHaveBeenCalledWith({ pathname: '/insights', params: { tab: 'this-cycle', at: expect.any(String) } });
    expect(screen.queryByTestId('guidance-sheet')).toBeNull(); // the sheet of D-122 is gone
  });

  it('hides the ovulation estimate card details until asked, keeping the fixed sentence', async () => {
    await setup({ today: '2026-10-13' });
    view();
    const details = screen.getByTestId('estimate-details');
    const before = body().includes('Based on');
    fireEvent.click(details);
    expect(body().includes('Based on')).toBe(!before);
    expect(screen.getByTestId('estimate-legal')).toBeTruthy();
  });

  it('is opaque in dark mode and on Android: no wash, no glass', async () => {
    await setup({ today: '2026-10-13' });
    env.scheme = 'dark';
    view();
    expect(screen.queryByTestId('hero-wash')).toBeNull();
    // the cards are opaque; only the floating Log today pill (navigation chrome, frame Today-Dark) may be glass; its glass is a sibling layer of the content, so the check is on the glass layer's parent
    expect(screen.queryAllByTestId('glass-view').every((g) => g.parentElement!.contains(screen.getByTestId('quick-log')))).toBe(true);
    cleanup();
    env.scheme = 'light'; env.platform = 'android';
    view();
    expect(screen.queryByTestId('hero-wash')).toBeNull();
    expect(screen.getByTestId('next-period-card')).toBeTruthy();
    // card rule: ring and two shadows, no border (a hairline border made the hero cards differ from every other card)
    const card = getComputedStyle(screen.getByTestId('next-period-card'));
    expect(['', '0px']).toContain(card.borderTopWidth);
  });
});

describe('Today, period in progress', () => {
  it('shows the logged chips; removing one retracts it and Undo puts it back', async () => {
    const { store, db } = await setup({ today: '2026-10-02', history: open(hist([28, 30, 29])) });
    await setSymptom(store, '2026-10-02', 'cramps', 1);
    view();
    expect(screen.getByTestId('headline-card').textContent).toContain('Day 2 of your period');
    expect(screen.getByTestId('period-end-card').textContent).toContain('Period likely ends');
    expect(screen.getByTestId('next-period-card').textContent).toContain('Next period likely');
    fireEvent.click(await screen.findByLabelText('Remove: Cramps (mild)'));
    await waitFor(async () => expect((await dayState(db, '2026-10-02')).symptoms.cramps).toBeUndefined());
    await waitFor(() => expect(screen.queryByLabelText('Remove: Cramps (mild)')).toBeNull());
    expect(await screen.findByText('Removed: Cramps (mild)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await dayState(db, '2026-10-02')).symptoms.cramps).toBe(1));
    expect(await screen.findByLabelText('Remove: Cramps (mild)')).toBeTruthy();
    expect((await store.events()).length).toBeGreaterThan(1); // append-only: nothing was deleted
  });
});

describe('Today, empty and paused', () => {
  it('keeps the empty copy and shows the bare dial', async () => {
    await setup({ today: '2026-10-10', history: EMPTY });
    view();
    expect(body()).toContain('Log your period to start');
    expect(body()).toContain('Sanguine needs one period date to begin; two or three cycles make estimates useful.');
    expect(screen.getByTestId('cycle-dial').getAttribute('aria-label')).toBe('NO DATA YET. Log a period to start');
    expect(screen.queryByTestId('estimate-card')).toBeNull();
    expect(screen.queryByTestId('next-period-card')).toBeNull();
    expect(screen.queryByTestId('hero-wash')).toBeNull();
    expect(screen.getByTestId('today-footer')).toBeTruthy();
  });

  it('keeps the paused copy and draws the dashed ring, not the dial', async () => {
    await setup({ today: '2026-10-10', settings: { ...S, lifeStates: [{ kind: 'hormonal_contraception', method: 'combined_pill', since: '2026-01-01' }] as EngineSettings['lifeStates'] } });
    view();
    expect(body()).toContain('Estimates are paused while “Hormonal contraception” is set.');
    expect(screen.getByTestId('paused-ring')).toBeTruthy();
    expect(screen.queryByTestId('cycle-dial')).toBeNull();
    expect(screen.queryByTestId('estimate-card')).toBeNull();
    expect(screen.queryByTestId('next-period-card')).toBeNull();
  });
});

describe('Today, teen mode', () => {
  it('draws no ovulation, fertile or supplement wording, even with uncertain estimates switched on', async () => {
    await setup({ today: '2026-10-13', prefs: { showUncertainEstimates: true, showOvulationEstimate: true }, profile: { birthDate: '2011-03-01' } });
    view();
    expect(screen.queryByTestId('estimate-card')).toBeNull();
    expect(screen.queryByTestId('today-legend')).toBeNull();
    expect(body()).not.toMatch(/ovulat|fertile|supplement/i);
    expect(screen.getByTestId('cycle-dial').getAttribute('aria-label')).not.toMatch(/ovulat|fertile/i);
    expect(screen.queryByTestId('guidance-supps')).toBeNull();
    expect(screen.getByTestId('next-period-card')).toBeTruthy(); // the period estimate stays
  });

  it('keeps the gate on an irregular (uncertain) history too', async () => {
    await setup({ today: '2026-10-13', history: hist([24, 38, 31, 45, 27, 36]), prefs: { showUncertainEstimates: true, showOvulationEstimate: true }, profile: { birthDate: '2011-03-01' } });
    view();
    expect(screen.queryByTestId('estimate-card')).toBeNull();
    expect(body()).not.toMatch(/ovulat|fertile|supplement/i);
    expect(screen.getByTestId('cycle-dial').getAttribute('aria-label')).not.toMatch(/ovulat|fertile/i);
  });
});

describe('Today, estimate tag', () => {
  const tagColour = () => screen.getAllByText('ESTIMATE').map((n) => getComputedStyle(n).color);
  it('uses the glass ink on glass (iOS light) and the card ink where the hero card is opaque', async () => {
    await setup({ today: '2026-10-13' });
    view();
    for (const c of tagColour()) expect(c).toBe('rgb(47, 85, 104)'); // #2F5568
    cleanup();
    env.scheme = 'dark';
    view();
    for (const c of tagColour()) expect(c).toBe('rgb(127, 167, 194)'); // dark ovulation
  });
});

describe('contrast on the hero', () => {
  it('textOnGlass reads at 4.5:1 over the strongest wash overlap in light and on the opaque card in dark', () => {
    const c = colors.light;
    // the wash at its peak under the glass, all three blobs stacked (the glass material only lightens this)
    const wash = over(c.accent, 0.18, over(c.ovulation, 0.12, over(c.fertile, 0.13, c.bg)));
    expect(contrast(c.textOnGlass, wash)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.textPrimary, wash)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.dark.textOnGlass, colors.dark.surface)).toBeGreaterThanOrEqual(4.5);
  });
  it('the estimate tag ink on glass reads at 4.5:1 over the wash where the cards sit, and the captions are textOnGlass', () => {
    const c = colors.light;
    const glassOver = (b: string) => over(glass.light.tintBase, glass.light.tintAlpha, b);
    const blob = { rose: [c.accent, 0.18], blue: [c.ovulation, 0.12], green: [c.fertile, 0.13] } as const;
    const stack = (names: Array<keyof typeof blob>) => names.reduce<string>((bg, n) => over(blob[n][0], blob[n][1], bg), c.bg);
    // the cards sit below the rose blob (it fades out by about y 310); under them the blue and green blobs can overlap
    for (const names of [['rose'], ['blue'], ['green'], ['blue', 'green']] as const) {
      expect(contrast('#2F5568', glassOver(stack([...names])))).toBeGreaterThanOrEqual(4.5);
    }
    // the date and legend captions sit at the top, over the rose blob; they are textOnGlass, which is asserted over every blob above
    expect(contrast(c.textOnGlass, stack(['rose']))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Today, estimates paused (frames Today-Pregnant, Today-Suspended)', () => {
  it('pregnant: the Log bar names the state on its second line and the due range carries the year', async () => {
    await setup({ today: '2026-11-02', history: hist([28, 30, 29], '2026-09-15'), settings: { ...S, lifeStates: [{ kind: 'pregnant', since: '2026-09-20' }] } });
    view();
    expect(screen.getByTestId('quick-log-text').textContent).toBe('Mon 2 Nov' + 'Pregnant');
    expect(screen.getByTestId('pregnancy-due').textContent).toMatch(/\d{4}$/);
  });
  it('hormonal contraception: the second line names it', async () => {
    await setup({ today: '2026-11-02', settings: { ...S, lifeStates: [{ kind: 'hormonal_contraception', method: 'combined_pill', since: '2026-09-20' }] } });
    view();
    expect(screen.getByTestId('quick-log-text').textContent).toBe('Mon 2 Nov' + 'Hormonal contraception');
  });
});
