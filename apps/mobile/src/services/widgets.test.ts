import { addDays, type EngineSettings, type History, type ISODate, predict } from '@sanguine/engine';
import { readFileSync } from 'node:fs';
import { colors, contrast } from '@sanguine/ui-tokens';
import { describe, expect, it } from 'vitest';
import '@/i18n';
import { widgetSnapshot } from './widgets';

const S: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };
function hist(lengths: number[], last: ISODate = '2026-10-01', bleed = 4): History {
  const starts: ISODate[] = [last];
  for (let i = lengths.length - 1; i >= 0; i--) starts.unshift(addDays(starts[0] as ISODate, -(lengths[i] as number)));
  return { cycles: starts.map((s, i) => ({ id: `c${i}`, start: s, end: addDays(s, bleed), quality: 'valid' as const })), temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
}
const snap = (h: History, today: ISODate, descriptive: boolean) =>
  widgetSnapshot({ prediction: predict(h, S, today), hasCycles: h.cycles.length > 0, today, descriptive, appName: 'Sanguine' });

describe('widget snapshot (P3-5, §8.8 discreet by default)', () => {
  it('default: the day and the ring only, no health words', () => {
    const s = snap(hist([28, 30, 29]), '2026-10-10', false);
    expect(s).toEqual({ day: 10, progress: expect.closeTo(10 / 29, 2), appName: 'Sanguine', details: false });
    expect(JSON.stringify(s)).not.toMatch(/period|ovulation|fertile/i);
  });
  it('details on: the Today headline and subtitle text', () => {
    const s = snap(hist([28, 30, 29]), '2026-10-10', true);
    expect(s.headline).toBe('Period likely in 17–23 days');
    expect(s.detail).toBe('27 Oct – 2 Nov · most likely 30 Oct');
  });
  it('no cycle yet: day 0 and an empty ring, even with details on', () => {
    const empty: History = { cycles: [], temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
    expect(snap(empty, '2026-10-10', true)).toMatchObject({ day: 0, progress: 0 });
  });
});

// The widget function cannot import tokens (WidgetKit serialises it), so its colours are literals; this keeps them equal to the tokens
// and readable (frames/Widgets-Notifications.html: surface2 card, textPrimary/textSecondary, onAccentSoft link, period ring).
describe('widget colours (glass redesign frame)', () => {
  const src = readFileSync(new URL('../widgets/TodayWidget.tsx', import.meta.url), 'utf8');
  const m = src.match(/colorScheme === 'dark'\s*\?\s*(\{[^}]*\})\s*:\s*(\{[^}]*\})/);
  const parse = (o: string) => Object.fromEntries([...o.matchAll(/(\w+): '(#[0-9A-Fa-f]{6})'/g)].map((x) => [x[1], x[2]])) as Record<string, string>;
  it('has a dark and a light palette', () => expect(m).not.toBeNull());
  for (const [i, mode] of (['dark', 'light'] as const).entries()) {
    const pal = parse(m?.[i + 1] ?? '');
    const t = colors[mode];
    it(`${mode}: literals equal the tokens`, () => {
      expect(pal).toEqual({ surface: t.surface2, text: t.textPrimary, sub: t.textSecondary, link: t.onAccentSoft, ring: t.period });
    });
    it(`${mode}: text >= 4.5:1 and ring >= 3:1 on the card`, () => {
      for (const k of ['text', 'sub', 'link']) expect(contrast(pal[k] ?? '', pal.surface ?? '')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(pal.ring ?? '', pal.surface ?? '')).toBeGreaterThanOrEqual(3);
    });
  }
});
