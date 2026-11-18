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
  it('light cards and screen are both white; the card is separated by elevation', () => {
    const a = buildTheme('light', 'android');
    expect(a.cardBg).toBe('#FFFFFF');
    expect(a.screenBg).toBe('#FFFFFF');
  });
});

// D-131: the primary fill, its ink, the dial track and the estimate swatch reach screens through `useTheme().c` on both platforms.
describe('theme exposes the primary fill pair and dial tokens', () => {
  for (const platform of ['ios', 'android'] as const) {
    it(`${platform}: dark primary is white ink on a darker rose`, () => {
      const { c } = buildTheme('dark', platform);
      expect(c.onAccent).toBe('#FFFFFF');
      expect(c.accentFill).toBe('#BB546B');
      expect(c.dialTrack).toBe('#2A2628');
      expect(c.estimateSwatch).toBe('#A3485C');
    });
  }
});
