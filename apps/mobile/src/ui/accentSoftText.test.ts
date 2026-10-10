// D-093: accent text on the accentSoft fill is 3.89:1 (light), under the 4.5:1 text minimum (PLAN.md §8.9).
// Text drawn on accentSoft uses the onAccentSoft colour; this fails if accent text is drawn inside an element that paints
// accentSoft. Accent text elsewhere (on the screen background, where it passes) is not checked.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') && !p.includes('.test.') ? [p] : [];
});
// <Text color="accent">, color={on ? 'accent' : …}, or style={{ color: t.c.accent }}
const ACCENT_TEXT = /color=(?:"accent"|\{[^}]*'accent'[^}]*\})|color:\s*t\.c\.accent\b/g;

/** Index just past the `>` that ends the opening tag starting at `from`, skipping `>` inside {…} (arrows) and strings. */
function openTagEnd(src: string, from: number): { end: number; selfClosing: boolean } {
  let depth = 0;
  let quote = '';
  for (let k = from; k < src.length; k++) {
    const ch = src[k];
    if (quote) { if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return { end: k + 1, selfClosing: src[k - 1] === '/' };
  }
  return { end: src.length, selfClosing: true };
}

/** The opening tag and children of every element whose props mention accentSoft (the fill and everything drawn on it). */
function fills(src: string): string[] {
  const out: string[] = [];
  for (let i = src.indexOf('accentSoft'); i !== -1; i = src.indexOf('accentSoft', i + 1)) {
    const opens = [...src.slice(0, i).matchAll(/<([A-Z][A-Za-z.]*)\b/g)];
    const last = opens.at(-1);
    if (!last || last.index === undefined) continue;
    const name = last[1] as string;
    const head = openTagEnd(src, last.index);
    if (head.selfClosing) continue; // a fill with no children draws no text
    let depth = 1;
    let k = head.end;
    const tag = new RegExp(`<(/?)${name.replace('.', '\\.')}\\b`, 'g');
    tag.lastIndex = k;
    for (let m = tag.exec(src); m && depth > 0; m = tag.exec(src)) {
      if (m[1]) { depth--; k = m.index; continue; }
      if (!openTagEnd(src, m.index).selfClosing) depth++;
    }
    out.push(src.slice(last.index, depth === 0 ? k : src.length));
  }
  return out;
}
const accentInFills = (src: string) => fills(src).flatMap((f) => f.match(ACCENT_TEXT) ?? []);

describe('text on accentSoft', () => {
  it('sees accent text after a nested element inside the fill (the tile case)', () =>
    expect(accentInFills(`<Pressable style={{ backgroundColor: on ? t.c.accentSoft : x }} onPress={() => go()}><Text color="onAccentSoft">a</Text><View style={{ gap: 4 }}><View /></View><Text color="accent">b</Text></Pressable>`)).toEqual(['color="accent"']));
  it('sees accent in a style', () =>
    expect(accentInFills(`<View style={{ backgroundColor: t.c.accentSoft }}><Text style={{ color: t.c.accent }}>x</Text></View>`)).toEqual(['color: t.c.accent']));
  it('ignores accent text outside the fill', () =>
    expect(accentInFills(`<View style={{ backgroundColor: t.c.accentSoft }}><Text color="onAccentSoft">x</Text></View><Text color="accent">‹</Text>`)).toEqual([]));

  const painting = files(root).filter((f) => readFileSync(f, 'utf8').includes('accentSoft'));
  it('finds the components that paint accentSoft', () => expect(painting.length).toBeGreaterThan(3));
  it.each(painting.map((f) => [f.slice(root.length + 1)]))('%s writes no accent-coloured text on accentSoft', (rel) =>
    expect(accentInFills(readFileSync(join(root, rel), 'utf8'))).toEqual([]));
});
