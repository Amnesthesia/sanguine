import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ENGINE_BUILD_HASH, ENGINE_VERSION } from '@sanguine/engine';
import { BUILD_INFO_PATH, engineSourceHash, renderBuildInfo } from './engine-hash';

describe('engine build hash (PLAN.md §6.7)', () => {
  it('buildInfo.ts is current (run `pnpm engine-hash`)', () => expect(readFileSync(BUILD_INFO_PATH, 'utf8')).toBe(renderBuildInfo()));
  it('is exported by the package as a SHA-256 hex string', () => {
    expect(ENGINE_BUILD_HASH).toMatch(/^[0-9a-f]{64}$/);
    expect(ENGINE_BUILD_HASH).toBe(engineSourceHash());
  });
  it('the version is semver', () => expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/));
});
