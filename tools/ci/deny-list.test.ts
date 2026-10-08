// The Expo Go allow-list job ended at P3-1 (the first dev-client build); the analytics / crash / ad / attribution deny-list stays for good.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DENY_PATTERNS } from './lists';

const root = join(__dirname, '..', '..');
const pkg = (p: string) => JSON.parse(readFileSync(join(root, p, 'package.json'), 'utf8'));

function workspaceDirs(): string[] {
  return ['apps', 'packages', 'tools'].flatMap((d) =>
    existsSync(join(root, d))
      ? readdirSync(join(root, d)).filter((n) => existsSync(join(root, d, n, 'package.json'))).map((n) => `${d}/${n}`)
      : [],
  );
}

describe('analytics / crash / ad / attribution deny-list', () => {
  for (const dir of workspaceDirs()) {
    it(`${dir} has no denied package`, () => {
      const p = pkg(dir);
      const all = Object.keys({ ...p.dependencies, ...p.devDependencies, ...p.peerDependencies, ...p.optionalDependencies });
      expect(all.filter((n) => DENY_PATTERNS.some((r) => r.test(n)))).toEqual([]);
    });
  }
  it('the deny-list catches known offenders', () => {
    for (const n of ['@sentry/react-native', 'firebase', '@react-native-firebase/analytics', 'react-native-google-mobile-ads', 'posthog-react-native'])
      expect(DENY_PATTERNS.some((r) => r.test(n)), n).toBe(true);
  });
});
