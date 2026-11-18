import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// expo-router bundles everything under apps/mobile/src/app through require.context: a test file there
// (vitest, node:fs) breaks the Metro bundle and the app never starts. Keep tests beside the feature code.
describe('expo-router route directory', () => {
  it('holds no test or spec files', () => {
    const files = execFileSync('git', ['ls-files', 'apps/mobile/src/app'], { encoding: 'utf8' }).split('\n').filter(Boolean);
    expect(files.filter((f) => /\.(test|spec)\.[jt]sx?$/.test(f))).toEqual([]);
  });
});
