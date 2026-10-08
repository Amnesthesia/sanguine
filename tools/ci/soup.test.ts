import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderSoup, SOUP_PATH } from './soup';

describe('regulatory artefacts (PLAN.md §2.3)', () => {
  it('soup.md is current (run `pnpm soup`)', () => expect(readFileSync(SOUP_PATH, 'utf8')).toBe(renderSoup()));
  it('the engine has no runtime dependencies', () => {
    const p = JSON.parse(readFileSync(join(__dirname, '..', '..', 'packages', 'engine', 'package.json'), 'utf8'));
    expect(Object.keys(p.dependencies ?? {})).toEqual([]);
  });
  it('the four artefacts exist', () => {
    for (const f of ['requirements.md', 'risk-register.md', 'soup.md', 'engine-changelog.md'])
      expect(existsSync(join(__dirname, '..', '..', 'docs', 'regulatory', f)), f).toBe(true);
  });
  it('requirements ids are unique and every row names a source and a test', () => {
    const md = readFileSync(join(__dirname, '..', '..', 'docs', 'regulatory', 'requirements.md'), 'utf8');
    const rows = md.split('\n').filter((l) => /^\| ER-\d+/.test(l)).map((l) => l.split('|').map((c) => c.trim()));
    expect(rows.length).toBeGreaterThan(20);
    expect(new Set(rows.map((r) => r[1])).size).toBe(rows.length);
    for (const r of rows) {
      expect(r[3], `${r[1]} source`).toBeTruthy();
      expect(r[4], `${r[1]} test`).toBeTruthy();
    }
  });
  it('risk register rows have hazard, cause, severity, control and verification', () => {
    const md = readFileSync(join(__dirname, '..', '..', 'docs', 'regulatory', 'risk-register.md'), 'utf8');
    const rows = md.split('\n').filter((l) => /^\| RK-\d+/.test(l)).map((l) => l.split('|').map((c) => c.trim()));
    expect(rows.length).toBeGreaterThan(8);
    for (const r of rows) for (let i = 2; i <= 6; i++) expect(r[i], `${r[1]} col ${i}`).toBeTruthy();
  });
});
