import type { HealthRecord } from '@sanguine/health-adapter';
import { describe, expect, it } from 'vitest';
import { HC_TYPES, recordToInsert, resultToRecord } from './healthConnectMapping';

const M = '2026-10-09T08:00:00+10:00';
const meta = { id: 'r1', dataOrigin: 'com.other', clientRecordId: undefined as string | undefined };
const inst = (recordType: string, extra: Record<string, unknown> = {}, md: Record<string, unknown> = {}) =>
  resultToRecord({ recordType, time: '2026-10-08T14:00:00Z', zoneOffset: { id: '+10:00', totalSeconds: 36000 }, metadata: { ...meta, ...md }, ...extra }, M);

describe('resultToRecord', () => {
  it('menstruation flow: light, medium, heavy; unknown counts as medium', () => {
    expect(inst('MenstruationFlow', { flow: 1 })).toMatchObject({ type: 'period_flow', value: { kind: 'flow', level: 'light' } });
    expect(inst('MenstruationFlow', { flow: 2 })).toMatchObject({ value: { level: 'medium' } });
    expect(inst('MenstruationFlow', { flow: 3 })).toMatchObject({ value: { level: 'heavy' } });
    expect(inst('MenstruationFlow', { flow: 0 })).toMatchObject({ value: { level: 'medium' } });
    expect(inst('MenstruationFlow', {})).toMatchObject({ value: { level: 'medium' } });
  });
  it('carries identity, source, zone offset, modification time and our client id', () => {
    expect(inst('MenstruationFlow', { flow: 2 }, { clientRecordId: 'ev-1', lastModifiedTime: '2026-10-09T01:00:00Z' })).toEqual({
      type: 'period_flow', externalId: 'r1', source: 'com.other', start: '2026-10-08T14:00:00Z', end: '2026-10-08T14:00:00Z', zone: '+10:00',
      modifiedAt: '2026-10-09T01:00:00Z', clientRecordId: 'ev-1', value: { kind: 'flow', level: 'medium' },
    });
  });
  it('falls back to the import time when the record has no modification time', () => expect(inst('IntermenstrualBleeding')).toMatchObject({ modifiedAt: M, value: { kind: 'bleeding' } }));
  it('basal body temperature in Celsius', () => expect(inst('BasalBodyTemperature', { temperature: { inCelsius: 36.5, inFahrenheit: 97.7 } })).toMatchObject({ type: 'bbt', value: { kind: 'temp', celsius: 36.5 } }));
  it('skin temperature is the baseline plus the mean delta, dated by its end, or skipped without a baseline', () => {
    const night = { startTime: '2026-10-08T12:00:00Z', endTime: '2026-10-08T20:00:00Z', startZoneOffset: { id: '+10:00', totalSeconds: 36000 }, deltas: [{ time: 'a', delta: { inCelsius: 0.2 } }, { time: 'b', delta: { inCelsius: 0.4 } }] };
    const r = resultToRecord({ recordType: 'SkinTemperature', metadata: meta, baseline: { inCelsius: 34 }, ...night }, M) as HealthRecord;
    expect(r).toMatchObject({ type: 'skin_temp', start: '2026-10-08T12:00:00Z', end: '2026-10-08T20:00:00Z', zone: '+10:00' });
    expect((r.value as { celsius: number }).celsius).toBeCloseTo(34.3, 6);
    expect(resultToRecord({ recordType: 'SkinTemperature', metadata: meta, ...night }, M)).toEqual({ skipped: 'no skin temperature baseline' });
  });
  it('ovulation test results', () => {
    expect([1, 2, 3, 0].map((v) => (inst('OvulationTest', { result: v }) as HealthRecord).value)).toEqual(['negative', 'positive', 'high', 'indeterminate'].map((result) => ({ kind: 'lh', result })));
  });
  it('cervical mucus appearance, skipped when unknown', () => {
    expect([1, 2, 3, 4, 5].map((v) => (inst('CervicalMucus', { appearance: v }) as HealthRecord).value)).toEqual(['dry', 'sticky', 'creamy', 'watery', 'eggwhite'].map((quality) => ({ kind: 'mucus', quality })));
    expect(inst('CervicalMucus', { appearance: 0 })).toEqual({ skipped: 'appearance unknown' });
  });
  it('sexual activity needs the protection flag', () => {
    expect(inst('SexualActivity', { protectionUsed: 1 })).toMatchObject({ value: { protected: true } });
    expect(inst('SexualActivity', { protectionUsed: 2 })).toMatchObject({ value: { protected: false } });
    expect(inst('SexualActivity', { protectionUsed: 0 })).toEqual({ skipped: 'protection unknown' });
  });
  it('a record type we do not sync is ignored', () => expect(inst('Steps')).toBeNull());
});

describe('recordToInsert', () => {
  const base = { zone: 'Australia/Brisbane', clientRecordId: 'ev-1', start: '2026-10-09T00:00:00+10:00', end: '2026-10-10T00:00:00+10:00' };
  it('period flow is an instantaneous record at the start of the day with our client id', () => {
    expect(recordToInsert({ ...base, type: 'period_flow', value: { kind: 'flow', level: 'heavy' } })).toEqual({
      recordType: 'MenstruationFlow', time: '2026-10-08T14:00:00.000Z', flow: 3, metadata: { clientRecordId: 'ev-1', clientRecordVersion: 1 },
    });
  });
  it('spotting flow is written as light', () => expect(recordToInsert({ ...base, type: 'period_flow', value: { kind: 'flow', level: 'spotting' } })).toMatchObject({ flow: 1 }));
  it('temperature in Celsius', () => expect(recordToInsert({ ...base, type: 'bbt', value: { kind: 'temp', celsius: 36.4 } })).toMatchObject({ recordType: 'BasalBodyTemperature', temperature: { unit: 'celsius', value: 36.4 } }));
  it('lh, mucus and sex', () => {
    expect(recordToInsert({ ...base, type: 'lh', value: { kind: 'lh', result: 'high' } })).toMatchObject({ recordType: 'OvulationTest', result: 3 });
    expect(recordToInsert({ ...base, type: 'mucus', value: { kind: 'mucus', quality: 'eggwhite' } })).toMatchObject({ recordType: 'CervicalMucus', appearance: 5 });
    expect(recordToInsert({ ...base, type: 'sex', value: { kind: 'sex', protected: false } })).toMatchObject({ recordType: 'SexualActivity', protectionUsed: 2 });
  });
  it('wrist temperature is never written', () => expect(recordToInsert({ ...base, type: 'skin_temp', value: { kind: 'temp', celsius: 35 } })).toBeNull());
  it('record types by health type', () => expect(HC_TYPES.skin_temp).toBe('SkinTemperature'));
});
