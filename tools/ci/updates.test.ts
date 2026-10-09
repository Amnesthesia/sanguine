// EAS Update (D-069, D-071): over-the-air updates carry app code only. The runtime version hashes the lockfile, app.json and
// the prediction engine, so an engine or parameter change needs a store build (PLAN.md §6.6, RK-13).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const mobile = join(__dirname, '..', '..', 'apps', 'mobile');
const read = (f: string) => readFileSync(join(mobile, f), 'utf8');

describe('EAS Update configuration', () => {
  it('runtime version changes when the engine changes, and is a pure function of tracked files (D-071)', async () => {
    const { runtimeVersionFor } = await import(join(mobile, 'app.config.ts'));
    const a = runtimeVersionFor('1.0.0');
    expect(runtimeVersionFor('1.0.0')).toBe(a);
    expect(runtimeVersionFor('1.0.1')).not.toBe(a);
    const src = read('app.config.ts');
    for (const input of ["'pnpm-lock.yaml'", "'app.json'", "'packages', 'engine', 'src'"]) expect(src).toContain(input);
  });
  it('every build profile names an update channel', () => {
    const eas = JSON.parse(read('eas.json'));
    for (const p of ['development', 'preview', 'production']) expect(eas.build[p].channel, p).toMatch(/^[a-z-]+$/);
  });
  it('an update never blocks launch on the network', () => {
    expect(read('app.config.ts')).toMatch(/fallbackToCacheTimeout: 0/);
  });
});
