import { HEALTH_TYPES } from '@sanguine/health-adapter';
import { describe, expect, it } from 'vitest';
import { healthRows, withType } from './healthModel';

describe('healthRows', () => {
  it('lists every type except sexual activity while its logging is off', () => {
    expect(healthRows({ teen: false, sexLogging: false }).map((r) => r.type)).toEqual(HEALTH_TYPES.filter((t) => t !== 'sex'));
    expect(healthRows({ teen: false, sexLogging: true }).map((r) => r.type)).toContain('sex');
  });
  it('marks wrist temperature as read only and every other type as read and write', () => {
    const rows = healthRows({ teen: false, sexLogging: true });
    expect(rows.filter((r) => r.readOnly).map((r) => r.type)).toEqual(['skin_temp']);
  });
  it('uses the plain wording for wrist temperature under 18 (no fertility wording)', () => {
    const body = (teen: boolean) => healthRows({ teen, sexLogging: false }).find((r) => r.type === 'skin_temp')?.bodyKey;
    expect(body(false)).toBe('settings.health.types.skin_temp.body');
    expect(body(true)).toBe('settings.health.types.skin_temp.bodyTeen');
  });
});

describe('withType', () => {
  it('adds and removes a type, keeping the canonical order and no duplicates', () => {
    expect(withType(['lh'], 'bbt', true)).toEqual(['bbt', 'lh']);
    expect(withType(['bbt', 'lh'], 'bbt', true)).toEqual(['bbt', 'lh']);
    expect(withType(['bbt', 'lh'], 'bbt', false)).toEqual(['lh']);
  });
});
