import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { AccessibilityInfo } from 'react-native';
import '@/i18n';
const safe = vi.hoisted(() => ({ edges: [] as unknown[] }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 0 }), SafeAreaView: ({ children, edges }: { children: ReactNode; edges?: unknown }) => { safe.edges.push(edges); return children; } }));
vi.mock('expo-router', () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock('react-native-svg', () => ({ default: () => null, Path: () => null }));
const env = vi.hoisted(() => ({ platform: 'ios' as 'ios' | 'android', scheme: 'light' as 'light' | 'dark', glassAvailable: true }));
vi.mock('@/theme', async (orig) => { const m = await orig<typeof import('@/theme')>(); return { ...m, useTheme: () => m.buildTheme(env.scheme, env.platform) }; });
vi.mock('expo-glass-effect', () => ({ GlassView: ({ children }: { children: ReactNode }) => <div data-testid="glass-view">{children}</div>, isLiquidGlassAvailable: () => env.glassAvailable, isGlassEffectAPIAvailable: () => env.glassAvailable }));
vi.mock('expo-blur', () => ({ BlurView: ({ children }: { children: ReactNode }) => <div data-testid="blur-view">{children}</div> }));
import { colors, glass } from '@sanguine/ui-tokens';
import { buildTheme } from '@/theme';
import { contrast, over } from '../../../../packages/ui-tokens/src/contrast';
import { ToastHost, showToast } from './Toast';
import { SubScreen } from './SubScreen';
import { floatEdges, Screen } from './Screen';
import { GlassSurface, useChromeBottom } from './GlassBar';
const setReduce = (reduce: boolean) => Object.assign(AccessibilityInfo, { isReduceTransparencyEnabled: vi.fn().mockResolvedValue(reduce), addEventListener: vi.fn(() => ({ remove: vi.fn() })) });
beforeEach(() => {
  env.platform = 'ios'; env.scheme = 'light'; env.glassAvailable = true;
  setReduce(false);
  useChromeBottom.setState({ bottom: 0 });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('offers an action for six seconds, announces it, and consumes it once', () => {
  vi.useFakeTimers();
  const announce = vi.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  const undo = vi.fn();
  render(<ToastHost />);
  act(() => showToast('Removed', { label: 'Undo', onPress: undo }));
  expect(announce).toHaveBeenCalledWith('Removed, Undo available');
  act(() => vi.advanceTimersByTime(4000));
  const button = screen.getByRole('button', { name: 'Undo' });
  // two presses before React re-renders: the action is consumed by the first
  act(() => { fireEvent.click(button); fireEvent.click(button); });
  expect(undo).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  expect(screen.queryByText('Removed')).toBeNull();
  act(() => showToast('Removed', { label: 'Undo', onPress: undo }));
  act(() => vi.advanceTimersByTime(6000));
  expect(screen.queryByText('Removed')).toBeNull();
});
it('keeps message-only toasts dismissible and expires them at four seconds', () => {
  vi.useFakeTimers();
  render(<ToastHost />);
  act(() => showToast('Saved'));
  fireEvent.click(screen.getByRole('button', { name: 'Saved' }));
  expect(screen.queryByText('Saved')).toBeNull();
  act(() => showToast('Saved'));
  act(() => vi.advanceTimersByTime(3999));
  expect(screen.getByText('Saved')).toBeTruthy();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByText('Saved')).toBeNull();
});
it('keeps the pushed screen Back label', () => {
  render(<SubScreen title="Details" testID="details"><span>Content</span></SubScreen>);
  expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
});

const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); });
const surface = () => render(<GlassSurface testID="surface"><span>inside</span></GlassSurface>);

it('GlassSurface, Reduce Transparency on: an opaque surface, no glass or blur', async () => {
  setReduce(true);
  surface(); await settle();
  expect(screen.getByText('inside')).toBeTruthy();
  expect(screen.queryByTestId('glass-view')).toBeNull();
  expect(screen.queryByTestId('blur-view')).toBeNull();
});
it('GlassSurface, Reduce Transparency off with liquid glass: the glass view', async () => {
  surface(); await settle();
  expect(screen.getByTestId('glass-view')).toBeTruthy();
  expect(screen.queryByTestId('blur-view')).toBeNull();
});
it('GlassSurface, liquid glass unavailable: the system blur', async () => {
  env.glassAvailable = false;
  surface(); await settle();
  expect(screen.getByTestId('blur-view')).toBeTruthy();
  expect(screen.queryByTestId('glass-view')).toBeNull();
});
it('GlassSurface on Android: an opaque surface that never touches the iOS-only APIs', async () => {
  env.platform = 'android';
  const isReduce = AccessibilityInfo.isReduceTransparencyEnabled as ReturnType<typeof vi.fn>;
  isReduce.mockClear();
  surface(); await settle();
  expect(screen.getByText('inside')).toBeTruthy();
  expect(screen.queryByTestId('glass-view')).toBeNull();
  expect(screen.queryByTestId('blur-view')).toBeNull();
  expect(isReduce).not.toHaveBeenCalled();
});
it('GlassSurface draws its top highlight over the material in light and not at all in dark', async () => {
  surface(); await settle();
  expect(screen.getByTestId('glass-highlight')).toBeTruthy();
  cleanup();
  env.scheme = 'dark';
  surface(); await settle();
  expect(screen.queryByTestId('glass-highlight')).toBeNull();
});
it('GlassSurface paints the real material on its first render once the setting is known', async () => {
  surface(); await settle();
  cleanup();
  surface();
  expect(screen.getByTestId('glass-view')).toBeTruthy();
});

it('two surfaces mounted together both get the material', async () => {
  render(<><GlassSurface testID="a"><span>one</span></GlassSurface><GlassSurface testID="b"><span>two</span></GlassSurface></>);
  await settle();
  expect(screen.getAllByTestId('glass-view')).toHaveLength(2);
});
it('GlassSurface clips its content to the radius it is given, and to the float radius by default', async () => {
  const { unmount } = render(<GlassSurface testID="r" style={{ borderRadius: 34 }}><span>inside</span></GlassSurface>);
  await settle();
  const clip = (id: string) => screen.getByTestId(id).firstElementChild as HTMLElement;
  expect(getComputedStyle(screen.getByTestId('r')).borderTopLeftRadius).toBe('34px');
  expect(getComputedStyle(clip('r')).borderTopLeftRadius).toBe('34px');
  unmount();
  render(<GlassSurface testID="d"><span>inside</span></GlassSurface>);
  await settle();
  expect(getComputedStyle(clip('d')).borderTopLeftRadius).toBe(`${buildTheme('light', 'ios').radius.float}px`);
});

it('a toolbar second row sits inside the same glass and inside the measured toolbar wrapper', async () => {
  render(<SubScreen title="Backup" testID="b" below={<button type="button" data-testid="below">Restore</button>}><span>Body</span></SubScreen>);
  await settle();
  const below = screen.getByTestId('below');
  const title = screen.getByRole('heading', { name: 'Backup' });
  expect(screen.getAllByTestId('glass-view')).toHaveLength(1);
  // legible: the glass is a sibling layer under the tint, and the title and second row sit in that same surface
  const surfaceEl = screen.getByTestId('glass-view').parentElement!;
  expect(surfaceEl.contains(below) && surfaceEl.contains(title)).toBe(true);
  // Screen measures the wrapper around the whole toolbar (absolute, under the status bar), so the second row is part of the height the toast sits under
  let wrapper: HTMLElement | null = below;
  while (wrapper && getComputedStyle(wrapper).position !== 'absolute') wrapper = wrapper.parentElement;
  expect(wrapper?.contains(title)).toBe(true);
});
it('a pushed page can pin one primary action after its content, and draws none by default', () => {
  render(<SubScreen title="Day" testID="d" floating={<button type="button" data-testid="pinned">Log this day</button>}><span data-testid="body">Body</span></SubScreen>);
  const pinned = screen.getByRole('button', { name: 'Log this day' });
  expect(screen.getByTestId('body').compareDocumentPosition(pinned) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  cleanup();
  render(<SubScreen title="Day" testID="d"><span>Body</span></SubScreen>);
  expect(screen.queryByTestId('pinned')).toBeNull();
});
it('a toolbar without a second row draws none', () => {
  render(<SubScreen title="Plain" testID="p"><span>Body</span></SubScreen>);
  expect(screen.queryByTestId('glass-bar-below')).toBeNull();
});

it('a tab root with a title draws it once, as the one heading; a pushed page draws it once in its bar', () => {
  render(<Screen title="Today"><span>Body</span></Screen>);
  expect(screen.getAllByText('Today')).toHaveLength(1);
  expect(screen.getAllByRole('heading', { name: 'Today' })).toHaveLength(1);
  cleanup();
  render(<SubScreen title="Details" testID="details"><span>Body</span></SubScreen>);
  expect(screen.getAllByText('Details')).toHaveLength(1);
  expect(screen.getAllByRole('heading', { name: 'Details' })).toHaveLength(1);
});

it('the toast sits just under the active toolbar', () => {
  useChromeBottom.setState({ bottom: 150 });
  render(<ToastHost />);
  act(() => showToast('Saved'));
  const wrapper = screen.getByTestId('toast').parentElement!.parentElement!.parentElement!.parentElement!.parentElement!;
  expect(getComputedStyle(wrapper).top).toBe('158px');
});

it('only one host announces and shows a toast while a modal host is mounted, and the message is not read twice on handover', () => {
  vi.useFakeTimers();
  const announce = vi.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  render(<ToastHost />);
  const modal = render(<ToastHost modal />);
  act(() => showToast('Removed', { label: 'Undo', onPress: vi.fn() }));
  expect(announce).toHaveBeenCalledTimes(1);
  expect(screen.getAllByText('Removed')).toHaveLength(1);
  modal.unmount();
  expect(screen.getAllByText('Removed')).toHaveLength(1);
  expect(announce).toHaveBeenCalledTimes(1);
});

it('the Undo label and Back chevron use the glass text colour, which reads on glass over the worst rows in both schemes', () => {
  for (const mode of ['light', 'dark'] as const) {
    const c = colors[mode]; const g = glass[mode];
    for (const row of ['bg', 'period', 'fertile', 'periodPredicted'] as const)
      expect(contrast(c.textOnGlass, over(g.tintBase, g.tintAlpha, c[row])), `${mode} ${row}`).toBeGreaterThanOrEqual(4.5);
    // the accent does not: this is why it is not used on glass
    expect(contrast(c.accent, over(g.tintBase, g.tintAlpha, c.period))).toBeLessThan(4.5);
  }
  render(<ToastHost />);
  act(() => showToast('Removed', { label: 'Undo', onPress: vi.fn() }));
  const undo = screen.getByRole('button', { name: 'Undo' });
  expect(getComputedStyle(undo.firstElementChild!).color).toBe(hexToRgb(colors.light.textOnGlass));
});
const hexToRgb = (h: string) => `rgb(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`;

const tintAlpha = () => Number(/rgba\([^)]*,\s*([\d.]+)\)/.exec(screen.getByTestId('glass-legible-tint').style.backgroundColor)?.[1]);
it.each(['light', 'dark'] as const)('GlassSurface legible, %s: a heavy blur and the glass sit under a tint, and the content over all of it', async (scheme) => {
  env.scheme = scheme;
  render(<GlassSurface legible testID="l"><span data-testid="content">inside</span></GlassSurface>);
  await settle();
  // the blur, not an opaque tint, is what keeps the content beneath unreadable (D-150): the tint is a half-strength wash, not a cover
  expect(tintAlpha()).toBeGreaterThanOrEqual(0.4);
  expect(tintAlpha()).toBeLessThan(0.9);
  const tint = screen.getByTestId('glass-legible-tint');
  const glassView = screen.getByTestId('glass-view');
  // the tint is a sibling of the glass layer, painted after it and before the content, so it covers the glass and the content is drawn over it
  const blur = screen.getByTestId('blur-view');
  expect(blur.parentElement).toBe(tint.parentElement);
  expect(blur.compareDocumentPosition(glassView) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(glassView.parentElement).toBe(tint.parentElement);
  expect(glassView.compareDocumentPosition(tint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(tint.compareDocumentPosition(screen.getByTestId('content')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
it('a plain GlassSurface has no legibility tint; the toolbar has', async () => {
  surface(); await settle();
  expect(screen.queryByTestId('glass-legible-tint')).toBeNull();
  cleanup();
  render(<SubScreen title="Details" testID="d"><span>Body</span></SubScreen>);
  await settle();
  expect(screen.getByTestId('glass-legible-tint')).toBeTruthy();
});
it('the toolbar title is one line that shrinks to fit, and the Back control is a 44 pt circle', async () => {
  render(<SubScreen title="Notifications and widgets" testID="d"><span>Body</span></SubScreen>);
  await settle();
  const title = screen.getByRole('heading', { name: 'Notifications and widgets' });
  expect(getComputedStyle(title).whiteSpace).toBe('nowrap');
  const back = getComputedStyle(screen.getByRole('button', { name: 'Back' }));
  expect([back.width, back.height, back.borderTopLeftRadius]).toEqual(['44px', '44px', '22px']);
});

it('a floating action pads by the bottom safe area on iOS only: on Android the tab screen already ends at the tab bar (D-159)', () => {
  expect(floatEdges(true)).toEqual(['bottom']);
  expect(floatEdges(false)).toEqual([]);
  for (const platform of ['ios', 'android'] as const) {
    env.platform = platform; safe.edges = [];
    render(<Screen title="Today" floating={<button type="button">Log today</button>}><span>Body</span></Screen>);
    expect(safe.edges).toEqual([platform === 'ios' ? ['bottom'] : []]);
    cleanup();
  }
});
