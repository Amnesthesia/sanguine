// PLAN.md §9.2. The brand wine #6A1220 is deliberately NOT here (splash, icon, About only).
export const colors = {
  light: {
    bg: '#FBF8F6', surface: '#FFFFFF', surface2: '#F3EEEA', textPrimary: '#1F1A1C', textSecondary: '#6B6165',
    border: '#E6DDD8', accent: '#9E2A3C', accentSoft: '#F4DCE0', period: '#B8324A', periodPredicted: '#D9A0AB',
    fertile: '#5C8A6E', ovulation: '#3F6F88', flag: '#B9741E', success: '#3E7D5A', focus: '#2E5C8A',
  },
  dark: {
    bg: '#141113', surface: '#1E191B', surface2: '#2A2326', textPrimary: '#F4EEEF', textSecondary: '#B3A8AC',
    border: '#352D30', accent: '#D4607A', accentSoft: '#3A1F27', period: '#D9607A', periodPredicted: '#7A4654',
    fertile: '#7FAF93', ovulation: '#7FA7C2', flag: '#D9A054', success: '#6FB68C', focus: '#8FBDE6',
  },
} as const;

/** iOS glass tints (rgba in the plan, split into base colour + alpha so contrast can be computed). */
export const glass = {
  light: { tintBase: '#FBF8F6', tintAlpha: 0.55, accentBase: '#9E2A3C', accentAlpha: 0.8, onAccent: '#FFFFFF' },
  dark: { tintBase: '#141113', tintAlpha: 0.55, accentBase: '#D4607A', accentAlpha: 0.72, onAccent: '#FFFFFF' },
} as const;

/** Android Material 3 roles (seed #9E2A3C). The surface roles are the iOS bg / surface / surface2 values, so Android is the same
 *  white/black design as iOS rather than M3's warm tonal surfaces (D-066). */
export const m3 = {
  light: {
    primary: '#9E2A3C', onPrimary: '#FFFFFF', primaryContainer: '#F4DCE0', surfaceContainerLow: '#FBF8F6',
    surfaceContainer: '#FFFFFF', surfaceContainerHigh: '#F3EEEA', tertiary: '#5C8A6E', outlineVariant: '#E6DDD8',
  },
  dark: {
    primary: '#D4607A', onPrimary: '#3A0A14', primaryContainer: '#3A1F27', surfaceContainerLow: '#141113',
    surfaceContainer: '#1E191B', surfaceContainerHigh: '#2A2326', tertiary: '#7FAF93', outlineVariant: '#352D30',
  },
} as const;

export const type = {
  display: { size: 40, line: 44, weight: '600' }, title: { size: 24, line: 30, weight: '600' },
  heading: { size: 18, line: 24, weight: '600' }, body: { size: 16, line: 24, weight: '400' },
  bodySmall: { size: 14, line: 20, weight: '400' }, caption: { size: 12, line: 16, weight: '500', letterSpacing: 0.2 },
} as const;

export const radii = {
  ios: { chip: 8, card: 16, sheet: 20 },
  android: { chip: 8, card: 28, sheet: 24 },
} as const;
export const spacing = { ios: [4, 8, 12, 16, 24, 32, 48], android: [8, 16, 24, 32, 48] } as const;
export const gutter = 16;
export type ColorToken = keyof (typeof colors)['light'];
