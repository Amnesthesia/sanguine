import type { ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AccessibilityInfo } from 'react-native';
vi.mock('@/theme', async (orig) => { const m = await orig<typeof import('@/theme')>(); return { ...m, useTheme: () => m.buildTheme('light', 'ios') }; });
// the native glass module fails to load (a build without it): the surface must stay readable, and say why once
vi.mock('expo-glass-effect', () => { throw new Error('native module missing'); });
vi.mock('expo-blur', () => ({ BlurView: ({ children }: { children: ReactNode }) => <div data-testid="blur-view">{children}</div> }));
import { GlassSurface } from './GlassBar';
afterEach(() => { cleanup(); vi.restoreAllMocks(); Reflect.deleteProperty(globalThis, '__DEV__'); });
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 10)); });

it('falls back to the opaque surface when the material cannot load, and warns once in dev for every surface', async () => {
  Object.assign(AccessibilityInfo, { isReduceTransparencyEnabled: vi.fn().mockResolvedValue(false), addEventListener: vi.fn(() => ({ remove: vi.fn() })) });
  Object.assign(globalThis, { __DEV__: true });
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(<><GlassSurface testID="a"><span>one</span></GlassSurface><GlassSurface testID="b"><span>two</span></GlassSurface></>);
  await settle();
  expect(screen.getByText('one')).toBeTruthy();
  expect(screen.getByText('two')).toBeTruthy();
  expect(screen.queryByTestId('blur-view')).toBeNull();
  expect(warn).toHaveBeenCalledTimes(1);
  expect(String(warn.mock.calls[0]?.[0])).toContain('GlassSurface');
});
