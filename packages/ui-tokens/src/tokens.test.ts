import { describe, expect, it } from 'vitest';
import { contrast, over } from './contrast';
import { colors, glass } from './tokens';

for (const mode of ['light', 'dark'] as const) {
  const c = colors[mode];
  describe(`contrast ${mode}`, () => {
    // WCAG 2.2 AA: 4.5:1 text, 3:1 non-text (PLAN.md §8.9)
    for (const bg of ['bg', 'surface', 'surface2'] as const)
      for (const fg of ['textPrimary', 'textSecondary'] as const)
        it(`${fg} on ${bg} >= 4.5`, () => expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5));
    // accent text is used on bg and surface only; chips on surface2 use textPrimary (D-008)
    for (const bg of ['bg', 'surface'] as const)
      for (const fg of ['accent'] as const)
        it(`${fg} on ${bg} >= 4.5`, () => expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(4.5));
    it('ovulation text on bg >= 4.5', () => expect(contrast(c.ovulation, c.bg)).toBeGreaterThanOrEqual(4.5));
    for (const fg of ['period', 'fertile', 'flag', 'focus'] as const)
      it(`${fg} on bg >= 3 (non-text)`, () => expect(contrast(c[fg], c.bg)).toBeGreaterThanOrEqual(3));
    it('white-ish label on glassAccent composite >= 4.5', () => {
      const g = glass[mode];
      const comp = over(g.accentBase, g.accentAlpha, c.bg);
      expect(contrast(g.onAccent, comp)).toBeGreaterThanOrEqual(4.5);
    });
    it('every token is a 6-digit hex', () => {
      for (const v of Object.values(c)) expect(v).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
}
