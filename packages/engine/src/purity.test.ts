// ER-01, ER-42: the engine has no clock, randomness, I/O or platform imports.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const files = readdirSync(__dirname).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

describe('engine purity', () => {
  it('has source files to check', () => expect(files.length).toBeGreaterThan(10));
  for (const f of files) {
    const src = readFileSync(join(__dirname, f), 'utf8').replace(/\/\/.*$/gm, '');
    it(`${f} uses no clock, randomness, I/O or platform API`, () => {
      expect(src).not.toMatch(/Date\.now|Math\.random|performance\.now|new Date\(\)|process\.|require\(|\bfetch\(|XMLHttpRequest|localStorage|console\./);
      // only relative imports
      for (const m of src.matchAll(/from\s+'([^']+)'/g)) expect(m[1], `${f} imports ${m[1]}`).toMatch(/^\.\//);
      // `new Date(` only inside dates.ts, and only with an explicit timestamp
      if (f !== 'dates.ts') expect(src).not.toMatch(/new Date\(/);
    });
  }
});
