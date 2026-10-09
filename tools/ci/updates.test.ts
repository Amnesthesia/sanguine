// EAS Update (D-069): over-the-air updates carry app code only. The runtime version is the fingerprint and the fingerprint
// includes the prediction engine, so an engine or parameter change needs a store build (PLAN.md §6.6, RK-13).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const mobile = join(__dirname, '..', '..', 'apps', 'mobile');
const read = (f: string) => readFileSync(join(mobile, f), 'utf8');

describe('EAS Update configuration', () => {
  it('runtime version follows the fingerprint, and the fingerprint covers the engine', async () => {
    expect(read('app.config.ts')).toMatch(/runtimeVersion: \{ policy: 'fingerprint' \}/);
    const fp = (await import(join(mobile, 'fingerprint.config.js'))).default as { extraSources: { type: string; filePath: string }[] };
    expect(fp.extraSources).toContainEqual(expect.objectContaining({ type: 'dir', filePath: '../../packages/engine/src' }));
  });
  it('every build profile has its own channel', () => {
    const eas = JSON.parse(read('eas.json'));
    for (const p of ['development', 'preview', 'production']) expect(eas.build[p].channel).toBe(p);
  });
  it('an update never blocks launch on the network', () => {
    expect(read('app.config.ts')).toMatch(/fallbackToCacheTimeout: 0/);
  });
});
