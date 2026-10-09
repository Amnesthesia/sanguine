import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import i18n from '../../apps/mobile/src/i18n';
import { CSV_PATH, extractRows, flatten, isRegulatory, parseCsv, renderSourceCsv, sourceTree, toCsv, unflatten, validateTranslation } from './i18n';

describe('translation pipeline (PLAN.md §6.4)', () => {
  it('the source tree is exactly what the app loads for en-AU', () => {
    expect(JSON.parse(JSON.stringify(sourceTree()))).toEqual(JSON.parse(JSON.stringify(i18n.getResourceBundle('en-AU', 'translation'))));
  });
  it('flatten and unflatten round-trip, including arrays', () => {
    const tree = { a: { b: 'x', c: ['one', 'two'] }, d: 'y' };
    expect(unflatten(flatten(tree))).toEqual(tree);
    expect(flatten(sourceTree()).length).toBeGreaterThan(400);
    expect(flatten(unflatten(flatten(sourceTree())))).toEqual(flatten(sourceTree()));
  });
  it('marks the fixed regulatory wording and the health flags', () => {
    expect(isRegulatory('legal.storeFirstParagraph')).toBe(true);
    expect(isRegulatory('flags.long.body')).toBe(true);
    expect(isRegulatory('tabs.today')).toBe(false);
    const rows = extractRows();
    expect(rows.filter((r) => r.regulatory).length).toBeGreaterThan(10);
  });
  it('csv round-trips commas, quotes and newlines', () => {
    const rows = [{ key: 'a', text: 'He said "hi", twice\nand left' }, { key: 'b', text: 'plain' }];
    expect(parseCsv(toCsv(rows, ['key', 'text']))).toEqual(rows);
  });
  it('the exported csv is current (run `pnpm i18n:extract`)', () => expect(readFileSync(CSV_PATH, 'utf8')).toBe(renderSourceCsv()));
  describe('validateTranslation', () => {
    const good = () => flatten(sourceTree()).map(([key, text]) => ({ key, translation: text }));
    it('accepts a complete translation', () => expect(validateTranslation(good())).toEqual([]));
    it('reports a missing key, an unknown key and an empty translation', () => {
      const rows = good().slice(1);
      rows.push({ key: 'nope.nothing', translation: 'x' });
      rows[0] = { key: rows[0]?.key as string, translation: ' ' };
      const errs = validateTranslation(rows);
      expect(errs.some((e) => e.endsWith('missing'))).toBe(true);
      expect(errs).toContain('nope.nothing: not a key of the source');
      expect(errs.some((e) => e.endsWith(': empty'))).toBe(true);
    });
    it('reports changed placeholders and over-long text', () => {
      const rows = good().map((r) => (r.key === 'today.periodLikely' ? { ...r, translation: 'Periode in {a}–{b} Tagen' } : r.key === 'tabs.today' ? { ...r, translation: 'x'.repeat(80) } : r));
      const errs = validateTranslation(rows);
      expect(errs.some((e) => e.startsWith('today.periodLikely: placeholders'))).toBe(true);
      expect(errs.some((e) => e.startsWith('tabs.today: longer'))).toBe(true);
    });
  });
});
