// Theme provider: ui-tokens by colour scheme and platform treatment (PLAN.md §9.1-9.3). Brand wine is not here (splash, icon, About only).
import { colors, m3, radii, type ColorToken } from '@sanguine/ui-tokens';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import type { ThemePref } from '@/data/prefs';

export type Scheme = 'light' | 'dark';
export interface Theme {
  scheme: Scheme;
  c: Record<ColorToken, string>;
  /** Screen background: `bg` on iOS, `surfaceContainerLow` on Android (§9.5). */
  screenBg: string;
  /** Card fill: `surface` on iOS, `surfaceContainer` on Android. */
  cardBg: string;
  /** Raised fill for chips and grouped rows. */
  chipBg: string;
  hairline: string;
  radius: { chip: number; card: number; sheet: number; tile: number };
  isIOS: boolean;
}

export function buildTheme(scheme: Scheme, platform: 'ios' | 'android'): Theme {
  const c = colors[scheme];
  const r = radii[platform];
  const m = m3[scheme];
  const ios = platform === 'ios';
  return {
    scheme, c, isIOS: ios,
    screenBg: ios ? c.bg : m.surfaceContainerLow,
    cardBg: ios ? c.surface : m.surfaceContainer,
    chipBg: ios ? c.surface2 : m.surfaceContainerHigh,
    hairline: ios ? c.border : m.outlineVariant,
    radius: { ...r, tile: ios ? 12 : 16 },
  };
}

const Ctx = createContext<Theme>(buildTheme('light', 'ios'));
export const useTheme = (): Theme => useContext(Ctx);

export function ThemeProvider({ pref, children }: { pref: ThemePref; children: ReactNode }) {
  const system = useColorScheme();
  const scheme: Scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const theme = useMemo(() => buildTheme(scheme, Platform.OS === 'android' ? 'android' : 'ios'), [scheme]);
  return <Ctx.Provider value={theme}>{children}</Ctx.Provider>;
}
