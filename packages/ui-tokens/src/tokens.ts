// PLAN.md §9.2. The brand wine #6A1220 is deliberately NOT here (splash, icon, About only).
export const colors = {
  light: {
    bg: '#FFFFFF', surface: '#FFFFFF', surface2: '#F3F3F4', textPrimary: '#1F1A1C', textSecondary: '#6B6165',
    textOnGlass: '#4A4246', caution: '#8A5512', cautionBg: 'rgba(185,116,30,0.10)', cautionText: '#5E3A0C',
    border: '#E4E4E6', accent: '#BC4560', accentSoft: '#F4DCE0', onAccentSoft: '#A3354F', period: '#B8324A', periodPredicted: '#D9A0AB',
    fertile: '#5C8A6E', ovulation: '#3F6F88', flag: '#B9741E', success: '#3E7D5A', focus: '#2E5C8A',
    // filled primary + its ink (D-131); dial track (D-128); estimate swatch = period red at the dial's estimate alpha over bg
    accentFill: '#BC4560', onAccent: '#FFFFFF', dialTrack: '#ECE7E9', estimateSwatch: '#EAC2C9',
  },
  dark: {
    bg: '#000000', surface: '#1C1C1E', surface2: '#2C2C2E', textPrimary: '#F4EEEF', textSecondary: '#B3A8AC',
    textOnGlass: '#CFC6CA', caution: '#D9A054', cautionBg: 'rgba(217,160,84,0.10)', cautionText: '#D9A054',
    border: '#3A3A3C', accent: '#D4607A', accentSoft: '#3A1F27', onAccentSoft: '#E8869A', period: '#D9607A', periodPredicted: '#7A4654',
    fertile: '#7FAF93', ovulation: '#7FA7C2', flag: '#D9A054', success: '#6FB68C', focus: '#8FBDE6',
    // accentFill: the accent darkened by 12%, the least that gives white ink 4.5:1 (4.57); estimateSwatch: period red at 75% over black (3.6:1, was 30% = 1.4:1)
    accentFill: '#BB546B', onAccent: '#FFFFFF', dialTrack: '#2A2628', estimateSwatch: '#A3485C',
  },
} as const;

/** iOS glass tints (rgba in the plan, split into base colour + alpha so contrast can be computed). */
export const glass = {
  light: { inset: 10, tintBase: '#FFFFFF', tintAlpha: 0.55 },
  dark: { inset: 10, tintBase: '#000000', tintAlpha: 0.55 },
} as const;

/** Android Material 3 roles (seed #BC4560). The surface roles are the iOS bg / surface / surface2 values, so Android is the same
 *  white/black design as iOS rather than M3's warm tonal surfaces (D-066). */
export const m3 = {
  light: {
    primary: '#BC4560', onPrimary: '#FFFFFF', primaryContainer: '#F4DCE0', surfaceContainerLow: '#FFFFFF',
    surfaceContainer: '#FFFFFF', surfaceContainerHigh: '#F3F3F4', tertiary: '#5C8A6E', outlineVariant: '#E4E4E6',
  },
  dark: {
    primary: '#D4607A', onPrimary: '#3A0A14', primaryContainer: '#3A1F27', surfaceContainerLow: '#000000',
    surfaceContainer: '#1C1C1E', surfaceContainerHigh: '#2C2C2E', tertiary: '#7FAF93', outlineVariant: '#3A3A3C',
  },
} as const;

export const type = {
  display: { size: 40, line: 44, weight: '600' }, title: { size: 24, line: 30, weight: '600' },
  heading: { size: 18, line: 24, weight: '600' }, body: { size: 16, line: 24, weight: '400' },
  bodySmall: { size: 14, line: 20, weight: '400' }, caption: { size: 12, line: 16, weight: '500', letterSpacing: 0.2 },
} as const;

export const radii = {
  ios: { chip: 8, card: 26, float: 28, sheet: 34 },
  android: { chip: 8, card: 26, float: 28, sheet: 34 },
} as const;
/** Hairline ring without a layout border, plus the two soft card shadows. */
export const elevation = {
  card: { boxShadow: 'inset 0 0 0 1px rgba(31,26,28,0.04), 0 2px 6px rgba(31,26,28,0.04), 0 12px 32px rgba(31,26,28,0.08)' },
} as const;
export const spacing = { ios: [4, 8, 12, 16, 24, 32, 48], android: [8, 16, 24, 32, 48] } as const;
export const gutter = 16;
export type ColorToken = keyof (typeof colors)['light'];
