import { describe, expect, it } from 'vitest';
import { contrast, over } from './contrast';
import { colors, elevation, glass, radii } from './tokens';

for (const mode of ['light', 'dark'] as const) {
  const c = colors[mode];
  describe(`contrast ${mode}`, () => {
    // WCAG 2.2 AA: 4.5:1 text, 3:1 non-text (PLAN.md §8.9)
    for (const bg of ['bg', 'surface', 'surface2'] as const)
      for (const fg of ['textPrimary', 'textSecondary'] as const)
        it(`${fg} on ${bg} >= 4.5`, () => expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5));
    for (const bg of ['bg', 'surface', 'surface2'] as const) {
      for (const fg of ['textOnGlass', 'caution', 'cautionText'] as const) {
        it(`${fg} on ${bg} >= 4.5`, () => {
          const ratio = contrast(c[fg], c[bg]);
          expect(ratio, `${fg} on ${bg}: ${ratio.toFixed(4)}:1`).toBeGreaterThanOrEqual(4.5);
        });
      }
      for (const fg of ['caution', 'cautionText'] as const) {
        it(`${fg} on cautionBg over ${bg} >= 4.5`, () => {
          const rgba = c.cautionBg.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
          expect(rgba).not.toBeNull();
          if (!rgba) throw new Error('Expected an rgba cautionBg');
          const base = `#${rgba.slice(1, 4).map(v => Number(v).toString(16).padStart(2, '0')).join('')}`;
          const ratio = contrast(c[fg], over(base, Number(rgba[4]), c[bg]));
          expect(ratio, `${fg} on cautionBg over ${bg}: ${ratio.toFixed(4)}:1`).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
    // accent text is used on bg and surface only; chips on surface2 use textPrimary (D-008)
    for (const bg of ['bg', 'surface'] as const)
      for (const fg of ['accent'] as const)
        it(`${fg} on ${bg} >= 4.5`, () => expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5));
    it('ovulation text on bg >= 4.5', () => expect(contrast(c.ovulation, c.bg)).toBeGreaterThanOrEqual(4.5));
    // selected chips, tiles and tonal chips put their label on accentSoft (D-093)
    for (const bg of ['accentSoft', 'bg', 'surface'] as const)
      it(`onAccentSoft on ${bg} >= 4.5`, () => expect(contrast(c.onAccentSoft, c[bg])).toBeGreaterThanOrEqual(4.5));
    // the fertile band's solid edge sits on the ring track and the calendar cell (§8.9: 3:1 against the day cell; D-093)
    it('fertile on border (ring track) >= 3 (non-text)', () => expect(contrast(c.fertile, c.border)).toBeGreaterThanOrEqual(3));
    it('fertile on accentSoft (selected calendar cell) >= 3 (non-text)', () => expect(contrast(c.fertile, c.accentSoft)).toBeGreaterThanOrEqual(3));
    for (const fg of ['period', 'fertile', 'flag', 'focus'] as const)
      it(`${fg} on bg >= 3 (non-text)`, () => expect(contrast(c[fg], c.bg)).toBeGreaterThanOrEqual(3));
    // the filled primary (Button, Log today, Continue, round +) carries white ink at 4.5:1 in both themes (D-131)
    it('onAccent on accentFill >= 4.5', () => expect(contrast(c.onAccent, c.accentFill)).toBeGreaterThanOrEqual(4.5));
    it('onAccent is white', () => expect(c.onAccent).toBe('#FFFFFF'));
    // the filled primary is still the accent rose: same hue, only darker (dark) or equal (light)
    it('accentFill is non-text >= 3 on bg', () => expect(contrast(c.accentFill, c.bg)).toBeGreaterThanOrEqual(3));
    it('dialTrack is the frame value', () => expect(c.dialTrack).toBe(mode === 'light' ? '#ECE7E9' : '#2A2628'));
    // the dial legend's estimate swatch must be seen on the screen background (T6)
    it('estimateSwatch on bg: dark >= 3 (non-text)', () => {
      if (mode === 'dark') expect(contrast(c.estimateSwatch, c.bg)).toBeGreaterThanOrEqual(3);
    });
    it('opaque colours are 6-digit hex; cautionBg is rgba', () => {
      for (const [key, v] of Object.entries(c))
        expect(v).toMatch(key === 'cautionBg' ? /^rgba\(\d+,\d+,\d+,0\.10\)$/ : /^#[0-9A-Fa-f]{6}$/);
    });
  });
}

it('light primary fill is the accent; dark is a darker rose, not black-ink-on-light', () => {
  expect(colors.light.accentFill).toBe(colors.light.accent);
  expect(colors.dark.accentFill).not.toBe(colors.dark.accent);
  expect(contrast(colors.dark.accentFill, colors.dark.bg)).toBeGreaterThanOrEqual(3);
});

it('uses the exact glass redesign tokens', () => {
  expect(colors.light).toMatchObject({ textOnGlass: '#4A4246', caution: '#8A5512', cautionBg: 'rgba(185,116,30,0.10)', cautionText: '#5E3A0C' });
  expect(colors.dark).toMatchObject({ textOnGlass: '#CFC6CA', caution: colors.dark.flag, cautionBg: 'rgba(217,160,84,0.10)', cautionText: colors.dark.flag });
  for (const platform of ['ios', 'android'] as const)
    expect(radii[platform]).toMatchObject({ card: 26, float: 28, sheet: 34 });
  for (const mode of ['light', 'dark'] as const) expect(glass[mode].inset).toBe(10);
  expect(elevation.card.boxShadow).toBe('inset 0 0 0 1px rgba(31,26,28,0.04), 0 2px 6px rgba(31,26,28,0.04), 0 12px 32px rgba(31,26,28,0.08)');
});
