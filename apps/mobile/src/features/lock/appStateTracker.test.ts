import { describe, expect, it } from 'vitest';
import { type AppStateName, createTracker } from './appStateTracker';

const run = (seq: AppStateName[]) => { const t = createTracker(); return seq.map((s) => t(s)); };

describe('createTracker', () => {
  it('Android: background then active re-checks the lock', () => expect(run(['background', 'active'])).toEqual(['cover', 'evaluate']));
  it('iOS: background, inactive, active still re-checks the lock (the case a "previous state" check misses)', () =>
    expect(run(['inactive', 'background', 'inactive', 'active'])).toEqual(['cover', 'cover', 'cover', 'evaluate']));
  it('the Face ID sheet or app switcher only passes through inactive: no re-prompt loop', () => expect(run(['inactive', 'active'])).toEqual(['cover', 'none']));
  it('re-checks once per trip, not on every active', () => expect(run(['background', 'active', 'inactive', 'active'])).toEqual(['cover', 'evaluate', 'cover', 'none']));
});
