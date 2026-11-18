import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessibilityInfo } from 'react-native';
import '@/i18n';
const env = vi.hoisted(() => ({ platform: 'ios' as 'ios' | 'android', scheme: 'light' as 'light' | 'dark', glassAvailable: true, push: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: env.push }) }));
vi.mock('expo-haptics', () => ({ impactAsync: vi.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
vi.mock('react-native-svg', () => ({ default: () => null, Path: () => null }));
vi.mock('@/theme', async (orig) => { const m = await orig<typeof import('@/theme')>(); return { ...m, useTheme: () => m.buildTheme(env.scheme, env.platform) }; });
vi.mock('expo-glass-effect', () => ({ GlassView: ({ children }: { children: ReactNode }) => <div data-testid="glass-view">{children}</div>, isLiquidGlassAvailable: () => env.glassAvailable, isGlassEffectAPIAvailable: () => env.glassAvailable }));
vi.mock('expo-blur', () => ({ BlurView: ({ children }: { children: ReactNode }) => <div data-testid="blur-view">{children}</div> }));
import { colors } from '@sanguine/ui-tokens';
import { contrast } from '../../../../../packages/ui-tokens/src/contrast';
import { QuickLogRow } from './QuickLogRow';

const setReduce = (reduce: boolean) => Object.assign(AccessibilityInfo, { isReduceTransparencyEnabled: vi.fn().mockResolvedValue(reduce), addEventListener: vi.fn(() => ({ remove: vi.fn() })) });
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); });
const hex = (rgb: string) => `#${(rgb.match(/\d+/g) ?? []).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
beforeEach(() => { env.platform = 'ios'; env.scheme = 'light'; env.glassAvailable = true; env.push.mockClear(); setReduce(false); });
afterEach(cleanup);

// The owner saw a black Log today button on a real iPhone: a tinted glass capsule nested in the glass pill. The capsule is now always the solid accent.
const modes = { glass: () => {}, solid: () => setReduce(true), blur: () => { env.glassAvailable = false; }, tonal: () => { env.platform = 'android'; } } as const;
describe.each(Object.entries(modes))('Log today pill, %s', (mode, arrange) => {
  for (const scheme of ['light', 'dark'] as const) {
    it(`${scheme}: a solid accent capsule with readable ink, never a nested or tinted glass`, async () => {
      env.scheme = scheme; arrange();
      render(<QuickLogRow title="Thu 12 Nov" subtitle="Day 13 of your cycle" />);
      await settle();
      const button = screen.getByTestId('quick-log');
      const style = getComputedStyle(button);
      expect(hex(style.backgroundColor)).toBe(colors[scheme].accent);
      expect(style.backgroundColor).not.toMatch(/rgba\(.*,\s*0(\.\d+)?\)|transparent/);
      // at most the one pill material, and the capsule is never inside a second glass
      expect(screen.queryAllByTestId('glass-view')).toHaveLength(mode === 'glass' ? 1 : 0);
      expect(button.closest('[data-testid="glass-view"]')?.parentElement?.closest('[data-testid="glass-view"]') ?? null).toBeNull();
      const ink = hex(getComputedStyle(screen.getByText('Log today')).color);
      expect(contrast(ink, colors[scheme].accent)).toBeGreaterThanOrEqual(4.5);
      expect(screen.getByTestId('quick-log-text').textContent).toBe('Thu 12 Nov' + 'Day 13 of your cycle');
    });
  }
});

it('opens the log sheet for the day it is given, with a label longer than the visible text', async () => {
  render(<QuickLogRow day="2026-11-12" title="Thu 12 Nov" accessibilityLabel="Log today, Thu 12 Nov" />);
  await settle();
  const button = screen.getByRole('button', { name: 'Log today, Thu 12 Nov' });
  fireEvent.click(button);
  expect(env.push).toHaveBeenCalledWith({ pathname: '/log', params: { day: '2026-11-12' } });
});
