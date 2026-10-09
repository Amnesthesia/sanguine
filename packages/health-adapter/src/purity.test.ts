// The health-adapter core is pure like the engine: no clock, randomness, I/O, platform imports or dependencies.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const files = readdirSync(__dirname).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

describe('health-adapter purity', () => {
  it('has no runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { dependencies?: unknown };
    expect(pkg.dependencies).toBeUndefined();
  });
  for (const f of files) {
    const src = readFileSync(join(__dirname, f), 'utf8').replace(/\/\/.*$/gm, '');
    it(`${f} uses no clock, randomness, I/O or platform API`, () => {
      expect(src).not.toMatch(/Date\.now|Math\.random|performance\.now|new Date\(\)|process\.|require\(|\bfetch\(|XMLHttpRequest|localStorage|console\./);
      for (const m of src.matchAll(/from\s+'([^']+)'/g)) expect(m[1], `${f} imports ${m[1]}`).toMatch(/^\.\//);
    });
  }
});
