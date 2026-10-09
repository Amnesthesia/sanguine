// EAS uploads through .easignore only (it ignores .gitignore when .easignore exists), and the build scripts disable VCS
// so the upload is not a shallow clone carrying every tracked screenshot. Personal data exports must never be uploaded.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const lines = (f: string) => readFileSync(join(root, f), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

describe('EAS upload filter', () => {
  it('.easignore repeats every .gitignore rule', () => {
    const eas = new Set(lines('.easignore'));
    expect(lines('.gitignore').filter((l) => !eas.has(l))).toEqual([]);
  });
  it('excludes docs and the native folders', () => {
    for (const rule of ['docs/', 'apps/mobile/ios', 'apps/mobile/android', 'node_modules', 'NaturalCycles-*.xlsx']) expect(lines('.easignore')).toContain(rule);
  });
  it('every EAS build script runs without VCS', () => {
    const scripts = JSON.parse(readFileSync(join(root, 'apps', 'mobile', 'package.json'), 'utf8')).scripts as Record<string, string>;
    const builds = Object.values(scripts).filter((s) => s.includes('eas-cli build'));
    expect(builds.length).toBeGreaterThan(0);
    for (const s of builds) expect(s.startsWith('EAS_NO_VCS=1 ')).toBe(true);
  });
});
