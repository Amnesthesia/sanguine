import type { HealthRecord } from '@sanguine/health-adapter';
import { describe, expect, it } from 'vitest';
import { HK_TYPES, recordToSave, sampleToRecord } from './healthkitMapping';

const at = new Date('2026-10-08T14:00:00Z'); // 2026-10-09 00:00 in Brisbane
const sample = (over: Record<string, unknown> = {}) => ({ uuid: 'u1', startDate: at, endDate: new Date(at.getTime() + 86400000), metadata: {}, sourceRevision: { source: { bundleIdentifier: 'com.other' } }, ...over });
const M = '2026-10-09T08:00:00+10:00';
const rec = (type: Parameters<typeof sampleToRecord>[0], over: Record<string, unknown> = {}) => sampleToRecord(type, sample(over), M);

describe('sampleToRecord', () => {
  it('menstrual flow values: light, medium, heavy; unspecified counts as medium; none is ignored', () => {
    expect(rec('period_flow', { value: 2 })).toMatchObject({ value: { kind: 'flow', level: 'light' } });
    expect(rec('period_flow', { value: 3 })).toMatchObject({ value: { level: 'medium' } });
    expect(rec('period_flow', { value: 4 })).toMatchObject({ value: { level: 'heavy' } });
    expect(rec('period_flow', { value: 1 })).toMatchObject({ value: { level: 'medium' } });
    expect(rec('period_flow', { value: 5 })).toBeNull();
  });
  it('carries identity, source, window, zone and the cycle-start flag', () => {
    const r = rec('period_flow', { value: 3, metadata: { HKMenstrualCycleStart: true, HKTimeZone: 'Australia/Brisbane', 'com.sanguine.eventId': 'ev-1' } }) as HealthRecord;
    expect(r).toEqual({
      type: 'period_flow', externalId: 'u1', source: 'com.other', start: '2026-10-08T14:00:00.000Z', end: '2026-10-09T14:00:00.000Z', zone: 'Australia/Brisbane',
      modifiedAt: M, clientRecordId: 'ev-1', value: { kind: 'flow', level: 'medium', cycleStart: true },
    });
  });
  it('intermenstrual bleeding', () => expect(rec('intermenstrual', { value: 0 })).toMatchObject({ value: { kind: 'bleeding' } }));
  it('basal and wrist temperature are quantities in degrees Celsius', () => {
    expect(rec('bbt', { quantity: 36.45, unit: 'degC' })).toMatchObject({ value: { kind: 'temp', celsius: 36.45 } });
    expect(rec('skin_temp', { quantity: 35.1, unit: 'degC' })).toMatchObject({ type: 'skin_temp', value: { kind: 'temp', celsius: 35.1 } });
  });
  it('a temperature in another unit is skipped, not guessed', () => expect(rec('bbt', { quantity: 98, unit: 'degF' })).toEqual({ skipped: 'temperature unit degF' }));
  it('ovulation tests: an estrogen surge is not an LH result', () => {
    expect(rec('lh', { value: 1 })).toMatchObject({ value: { result: 'negative' } });
    expect(rec('lh', { value: 2 })).toMatchObject({ value: { result: 'positive' } });
    expect(rec('lh', { value: 3 })).toMatchObject({ value: { result: 'indeterminate' } });
    expect(rec('lh', { value: 4 })).toMatchObject({ value: { result: 'indeterminate' } });
  });
  it('cervical mucus quality', () => {
    expect([1, 2, 3, 4, 5].map((v) => (rec('mucus', { value: v }) as HealthRecord).value)).toEqual(['dry', 'sticky', 'creamy', 'watery', 'eggwhite'].map((quality) => ({ kind: 'mucus', quality })));
  });
  it('sexual activity needs the protection flag, otherwise it is skipped', () => {
    expect(rec('sex', { value: 0, metadata: { HKSexualActivityProtectionUsed: true } })).toMatchObject({ value: { kind: 'sex', protected: true } });
    expect(rec('sex', { value: 0, metadata: { HKSexualActivityProtectionUsed: false } })).toMatchObject({ value: { protected: false } });
    expect(rec('sex', { value: 0, metadata: {} })).toEqual({ skipped: 'protection unknown' });
  });
  it('an unknown category value is skipped, not guessed', () => expect(rec('lh', { value: 9 })).toEqual({ skipped: 'unknown value 9' }));
});

describe('recordToSave', () => {
  const base = { zone: 'Australia/Brisbane', clientRecordId: 'ev-1', start: '2026-10-09T00:00:00+10:00', end: '2026-10-10T00:00:00+10:00' };
  it('period flow keeps level, cycle start, event id and zone in the metadata', () => {
    expect(recordToSave({ ...base, type: 'period_flow', value: { kind: 'flow', level: 'heavy', cycleStart: true } })).toEqual({
      kind: 'category', id: HK_TYPES.period_flow.id, value: 4, start: new Date('2026-10-08T14:00:00Z'), end: new Date('2026-10-09T14:00:00Z'),
      metadata: { 'com.sanguine.eventId': 'ev-1', HKTimeZone: 'Australia/Brisbane', HKMenstrualCycleStart: true },
    });
  });
  it('spotting is written as light flow, as HealthKit has no spotting level', () => expect(recordToSave({ ...base, type: 'period_flow', value: { kind: 'flow', level: 'spotting' } })).toMatchObject({ value: 2 }));
  it('basal temperature is a degC quantity', () => expect(recordToSave({ ...base, type: 'bbt', value: { kind: 'temp', celsius: 36.4 } })).toMatchObject({ kind: 'quantity', id: HK_TYPES.bbt.id, unit: 'degC', value: 36.4 }));
  it('a high LH reading is written as indeterminate, never as a surge', () => {
    expect(recordToSave({ ...base, type: 'lh', value: { kind: 'lh', result: 'high' } })).toMatchObject({ value: 3 });
    expect(recordToSave({ ...base, type: 'lh', value: { kind: 'lh', result: 'positive' } })).toMatchObject({ value: 2 });
  });
  it('sexual activity carries the protection flag', () => expect(recordToSave({ ...base, type: 'sex', value: { kind: 'sex', protected: true } })?.metadata).toMatchObject({ HKSexualActivityProtectionUsed: true }));
  it('wrist temperature is never saved', () => expect(recordToSave({ ...base, type: 'skin_temp', value: { kind: 'temp', celsius: 35 } })).toBeNull());
  it('an offset zone is not written as HKTimeZone', () => expect(recordToSave({ ...base, zone: '+10:00', type: 'intermenstrual', value: { kind: 'bleeding' } })?.metadata).toEqual({ 'com.sanguine.eventId': 'ev-1' }));
});
