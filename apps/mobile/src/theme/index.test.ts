import { describe, expect, it } from 'vitest';
import { buildTheme } from './index';

// D-066: Android uses the same white/black surfaces as iOS; only the radii and the hairline-vs-elevation treatment differ.
describe('theme surfaces match across platforms (D-066)', () => {
  for (const scheme of ['light', 'dark'] as const) {
    it(`${scheme}: screen, card and chip fills are the iOS ones on Android`, () => {
      const ios = buildTheme(scheme, 'ios');
      const android = buildTheme(scheme, 'android');
      expect(android.screenBg).toBe(ios.screenBg);
      expect(android.cardBg).toBe(ios.cardBg);
      expect(android.chipBg).toBe(ios.chipBg);
      expect(android.hairline).toBe(ios.hairline);
    });
  }
  it('light cards are white on the off-white screen', () => {
    const a = buildTheme('light', 'android');
    expect(a.cardBg).toBe('#FFFFFF');
    expect(a.screenBg).toBe('#FBF8F6');
  });
});
