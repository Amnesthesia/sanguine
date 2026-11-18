import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../../apps/mobile/src/features/dev/scenarios';

interface Row { id: string; frame: string; reachable: boolean; reason?: string; seed?: string; link?: string; scroll?: string; darkFrame?: string; variants?: string[] }
const dir = new URL('.', import.meta.url);
const rows = (JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8')) as { rows: Row[] }).rows;
const frames = readdirSync(new URL('../../docs/design/glass-redesign/frames/', import.meta.url)).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5));

describe('verification manifest (tools/verify-screens)', () => {
  it('has a row for every design frame, so a new frame cannot go unchecked', () => {
    const covered = new Set(rows.map((r) => r.frame));
    expect(frames.filter((f) => !covered.has(f))).toEqual([]);
  });
  it('names only frames that exist', () => {
    const known = new Set(frames);
    expect(rows.flatMap((r) => [r.frame, r.darkFrame ?? r.frame]).filter((f) => !known.has(f))).toEqual([]);
  });
  it('has unique ids, and a reason on every row that cannot be reached by a link', () => {
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.filter((r) => !r.reachable && !r.reason)).toEqual([]);
  });
  it('gives every reachable row a known sample scenario and a link, and never a pipe (run.sh splits on it)', () => {
    for (const r of rows.filter((x) => x.reachable)) {
      const scenario = /(?:^|&)scenario=([A-Za-z]+)/.exec(r.seed ?? '')?.[1];
      expect(SCENARIOS as string[], r.id).toContain(scenario);
      expect(r.link, r.id).toBeTruthy();
      expect([r.id, r.link, r.seed, r.scroll ?? ''].join('')).not.toContain('|');
      expect((r.variants ?? ['light', 'dark', '150']).every((v) => ['light', 'dark', '150'].includes(v)), r.id).toBe(true);
    }
  });
  it('gives a calendar link its day and sheet, so a row never inherits the previous row\'s state', () => {
    for (const r of rows.filter((x) => x.reachable && x.link?.startsWith('calendar'))) expect(r.link, r.id).toMatch(/[?&]day=.*[?&]sheet=(closed|small|large)/);
  });
});
