// Static accessibility checks (PLAN.md §8.9): every interactive element is labelled and is a 44 pt+ target; no custom animation.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') && !p.endsWith('.test.tsx') ? [p] : [];
  });
}
const SRC = files(__dirname);
const SPLASH = join(__dirname, 'features/splash/BrandSplash.tsx');

/** The text of a JSX opening tag starting at `from` (just after the tag name), up to its closing `>` or `/>`. */
function tagBody(src: string, from: number): string {
  let depth = 0;
  let quote = '';
  for (let i = from; i < src.length; i++) {
    const c = src[i] as string;
    if (quote) { if (c === quote && src[i - 1] !== '\\') quote = ''; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0 && src[i - 1] !== '=') return src.slice(from, i);
  }
  return src.slice(from);
}
function tags(src: string, name: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${name}(?=[\\s>/])`, 'g');
  for (let m = re.exec(src); m; m = re.exec(src)) out.push(tagBody(src, m.index + m[0].length));
  return out;
}

const LABELLED = /accessibilityLabel|aria-label|\{\.\.\.rest\}|\{\.\.\.props\}/;
describe('interactive elements are labelled', () => {
  for (const name of ['Pressable', 'Switch', 'TextInput', 'TouchableOpacity']) {
    it(`every <${name}> has an accessibility label`, () => {
      const bad: string[] = [];
      for (const f of SRC) for (const body of tags(readFileSync(f, 'utf8'), name)) if (!LABELLED.test(body)) bad.push(`${f.replace(__dirname, '')}: <${name}${body.slice(0, 80).replace(/\s+/g, ' ')}…`);
      expect(bad).toEqual([]);
    });
  }
  it('every Pressable declares a minimum target of 44 or more (minHeight, height or a sized child style)', () => {
    const bad: string[] = [];
    for (const f of SRC) for (const body of tags(readFileSync(f, 'utf8'), 'Pressable')) {
      const sizes = [...body.matchAll(/(?:minHeight|height|minWidth):\s*(\d+)/g)].map((m) => Number(m[1]));
      if (!sizes.some((n) => n >= 44) && !/\{\.\.\.rest\}/.test(body)) bad.push(`${f.replace(__dirname, '')}: <Pressable${body.slice(0, 90).replace(/\s+/g, ' ')}…`);
    }
    expect(bad).toEqual([]);
  });
  it('every route screen has a testable root', () => {
    const missing = SRC.filter((f) => /\/app\/.*\.tsx$/.test(f) && !/_layout|index\.tsx|seed\.tsx/.test(f)).filter((f) => !/testID=|SubScreen|LogSheet|OnboardingFlow/.test(readFileSync(f, 'utf8')));
    expect(missing.map((f) => f.replace(__dirname, ''))).toEqual([]);
  });
});

describe('motion (§8.9: reduced motion degrades to cross-fades; the ring never animates)', () => {
  it('the app has no custom animation: no Animated, reanimated or LayoutAnimation in screens or components', () => {
    const hits = SRC.filter((f) => /react-native-reanimated|LayoutAnimation|Animated\.|from 'react-native'.*\bAnimated\b/.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => f.replace(__dirname, ''))).toEqual([SPLASH.replace(__dirname, '')]);
  });
  it('the one exception, the brand splash (D-042), only fades opacity and drops the fades under Reduce Motion', () => {
    const src = readFileSync(SPLASH, 'utf8');
    expect(src).toContain('isReduceMotionEnabled');
    expect(src.match(/Animated\.timing\(\w+, \{ toValue: \d, duration: \w+/g)?.length).toBe(5);
    expect(src).not.toMatch(/translate|scale|rotate|LayoutAnimation|reanimated/);
  });
});

describe('meaning is never colour alone', () => {
  it('the calendar cell draws period (solid + dots), predicted (hatch) and fertile (underline) as shapes and labels them in words', () => {
    const cell = readFileSync(join(__dirname, 'features/calendar/DayCellView.tsx'), 'utf8');
    for (const shape of ['Pattern', 'backgroundColor: on ? t.c.period', 'height: 4', 'accessibilityLabel={cell.label}']) expect(cell).toContain(shape);
  });
});
