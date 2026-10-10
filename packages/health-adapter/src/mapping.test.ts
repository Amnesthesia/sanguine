import { describe, expect, it } from 'vitest';
import { contentHash, eventToRecord, localIso, recordDay, recordToEvent, syncedType } from './mapping';
import type { HealthRecord, SinkEvent } from './types';

const BNE = 'Australia/Brisbane'; // +10:00 all year, so the expectations do not move with daylight saving
const rec = (p: Partial<HealthRecord>): HealthRecord => ({
  type: 'bbt', externalId: 'x', source: 'com.other', start: '2026-10-09T05:30:00+10:00', end: '2026-10-09T05:30:00+10:00',
  modifiedAt: '2026-10-09T06:00:00Z', value: { kind: 'temp', celsius: 36.5 }, ...p,
});
const ev = (kind: string, payload: Record<string, unknown>): SinkEvent => ({ id: 'e1', kind, payload, effectiveDay: '2026-10-09', provenance: 'manual', retracted: false, lamport: 1 });

describe('localIso', () => {
  it('local midnight with the zone offset', () => {
    expect(localIso('2026-10-09', '00:00', BNE)).toBe('2026-10-09T00:00:00+10:00');
    expect(localIso('2026-10-09', '00:00', 'UTC')).toBe('2026-10-09T00:00:00+00:00');
  });
  it('follows daylight saving: Sydney is +11:00 on 9 Oct 2026 and +10:00 on 1 Jun 2026', () => {
    expect(localIso('2026-10-09', '00:00', 'Australia/Sydney')).toBe('2026-10-09T00:00:00+11:00');
    expect(localIso('2026-06-01', '00:00', 'Australia/Sydney')).toBe('2026-06-01T00:00:00+10:00');
  });
  it('accepts a fixed offset as the zone', () => expect(localIso('2026-10-09', '06:00', '-05:30')).toBe('2026-10-09T06:00:00-05:30'));
});

describe('recordDay (§5.5)', () => {
  it('a BBT at 05:30 local is that day', () => expect(recordDay(rec({ zone: BNE }), 'UTC')).toBe('2026-10-09'));
  it('uses the sample zone over the device zone', () => expect(recordDay(rec({ start: '2026-10-09T23:30:00Z', end: '2026-10-09T23:30:00Z', zone: BNE }), 'UTC')).toBe('2026-10-10'));
  it('falls back to the device zone', () => expect(recordDay(rec({ start: '2026-10-09T23:30:00Z', end: '2026-10-09T23:30:00Z' }), BNE)).toBe('2026-10-10'));
  it('skin_temp day is the end instant, in the sample zone (the morning after the night)', () =>
    expect(recordDay(rec({ type: 'skin_temp', start: '2026-10-08T13:00:00Z', end: '2026-10-08T20:30:00Z', zone: BNE }), 'UTC')).toBe('2026-10-09'));
  it('a flow sample spanning a day is its start day', () =>
    expect(recordDay(rec({ type: 'period_flow', start: '2026-10-09T00:00:00+10:00', end: '2026-10-10T00:00:00+10:00', zone: BNE, value: { kind: 'flow', level: 'medium' } }), 'UTC')).toBe('2026-10-09'));
  it('accepts an offset zone as Health Connect supplies it', () => expect(recordDay(rec({ start: '2026-10-09T23:30:00Z', end: '2026-10-09T23:30:00Z', zone: '+10:00' }), 'UTC')).toBe('2026-10-10'));
});

describe('recordToEvent', () => {
  it('period flow', () => expect(recordToEvent(rec({ type: 'period_flow', value: { kind: 'flow', level: 'heavy' } }), '2026-10-09', BNE)).toEqual({ kind: 'flow', payload: { day: '2026-10-09', level: 'heavy', flow_kind: 'period' } }));
  it('intermenstrual bleeding is spotting of kind intermenstrual', () => expect(recordToEvent(rec({ type: 'intermenstrual', value: { kind: 'bleeding' } }), '2026-10-09', BNE).payload).toMatchObject({ level: 'spotting', flow_kind: 'intermenstrual' }));
  it('bbt carries measured_at and source oral', () => expect(recordToEvent(rec({}), '2026-10-09', BNE)).toEqual({ kind: 'biomarker', payload: { day: '2026-10-09', type: 'bbt', value: { valueC: 36.5 }, source: 'oral', measured_at: '2026-10-09T05:30:00+10:00' } }));
  // D-093: the reading keeps the wall-clock time where it was taken, so the BBT time check does not move when the phone travels
  it('a UTC sample time is stored as wall-clock time in the sample zone', () =>
    expect(recordToEvent(rec({ start: '2026-10-08T19:30:00.000Z', end: '2026-10-08T19:30:00.000Z' }), '2026-10-09', BNE).payload.measured_at).toBe('2026-10-09T05:30:00+10:00'));
  it('an offset zone (Health Connect) works the same', () =>
    expect(recordToEvent(rec({ start: '2026-10-08T19:30:00Z', end: '2026-10-08T19:30:00Z' }), '2026-10-09', '+10:00').payload.measured_at).toBe('2026-10-09T05:30:00+10:00'));
  it('skin_temp is source wrist', () => expect(recordToEvent(rec({ type: 'skin_temp' }), '2026-10-09', BNE).payload).toMatchObject({ type: 'skin_temp', source: 'wrist' }));
  it('lh', () => expect(recordToEvent(rec({ type: 'lh', value: { kind: 'lh', result: 'positive' } }), '2026-10-09', BNE).payload).toMatchObject({ type: 'lh', value: { result: 'positive' } }));
  it('mucus', () => expect(recordToEvent(rec({ type: 'mucus', value: { kind: 'mucus', quality: 'eggwhite' } }), '2026-10-09', BNE).payload).toMatchObject({ type: 'mucus', value: { quality: 'eggwhite' } }));
  it('sex', () => expect(recordToEvent(rec({ type: 'sex', value: { kind: 'sex', protected: true } }), '2026-10-09', BNE)).toEqual({ kind: 'sex', payload: { day: '2026-10-09', protected: true } }));
});

describe('syncedType and eventToRecord', () => {
  it('flow of kind period and intermenstrual are synced, other kinds and level none are not', () => {
    expect(syncedType(ev('flow', { day: '2026-10-09', level: 'light', flow_kind: 'period' }))).toBe('period_flow');
    expect(syncedType(ev('flow', { day: '2026-10-09', level: 'light', flow_kind: 'intermenstrual' }))).toBe('intermenstrual');
    expect(syncedType(ev('flow', { day: '2026-10-09', level: 'light', flow_kind: 'post_pregnancy' }))).toBeNull();
    expect(syncedType(ev('flow', { day: '2026-10-09', level: 'light', flow_kind: 'on_contraception' }))).toBeNull();
    expect(syncedType(ev('flow', { day: '2026-10-09', level: 'none', flow_kind: 'period' }))).toBeNull();
  });
  it('flow becomes a one-day interval from local midnight', () =>
    expect(eventToRecord(ev('flow', { day: '2026-10-09', level: 'light', flow_kind: 'period' }), BNE)).toEqual({
      type: 'period_flow', start: '2026-10-09T00:00:00+10:00', end: '2026-10-10T00:00:00+10:00', zone: BNE, clientRecordId: 'e1', value: { kind: 'flow', level: 'light' },
    }));
  it('marks the first day of a period as the cycle start when asked', () =>
    expect(eventToRecord(ev('flow', { day: '2026-10-09', level: 'light', flow_kind: 'period' }), BNE, { cycleStart: true })?.value).toEqual({ kind: 'flow', level: 'light', cycleStart: true }));
  it('symptoms, notes, life states and post-pregnancy flow are never written', () => {
    for (const k of ['symptom', 'note', 'life_state.set', 'period.start']) expect(eventToRecord(ev(k, { day: '2026-10-09' }), 'UTC')).toBeNull();
    expect(eventToRecord(ev('flow', { day: '2026-10-09', level: 'light', flow_kind: 'post_pregnancy' }), 'UTC')).toBeNull();
  });
  it('skin_temp is read-only', () => expect(eventToRecord(ev('biomarker', { day: '2026-10-09', type: 'skin_temp', value: { valueC: 36 }, source: 'wrist' }), 'UTC')).toBeNull());
  it('a bbt without measured_at is written at 06:00 local', () =>
    expect(eventToRecord(ev('biomarker', { day: '2026-10-09', type: 'bbt', value: { valueC: 36.4 }, source: 'oral' }), BNE)?.start).toBe('2026-10-09T06:00:00+10:00'));
  it('round-trips a bbt', () => {
    const r = eventToRecord(ev('biomarker', { day: '2026-10-09', type: 'bbt', value: { valueC: 36.4 }, source: 'oral', measured_at: '2026-10-09T05:30:00+10:00' }), BNE);
    expect(recordToEvent({ ...(r as NonNullable<typeof r>), externalId: 'x', source: 's', modifiedAt: 'm' }, '2026-10-09', BNE).payload).toMatchObject({ type: 'bbt', value: { valueC: 36.4 } });
  });
  it('sex is written at local noon with protection', () => {
    const r = eventToRecord(ev('sex', { day: '2026-10-09', protected: false }), BNE);
    expect(r).toMatchObject({ type: 'sex', start: '2026-10-09T12:00:00+10:00', value: { kind: 'sex', protected: false } });
  });
});

describe('lh results', () => {
  it('a peak test is written as positive; high stays high for the driver to decide', () => {
    const v = (result: string) => eventToRecord(ev('biomarker', { day: '2026-10-09', type: 'lh', value: { result }, source: 'strip' }), BNE)?.value;
    expect(v('peak')).toEqual({ kind: 'lh', result: 'positive' });
    expect(v('high')).toEqual({ kind: 'lh', result: 'high' });
  });
});

describe('contentHash', () => {
  const v = { kind: 'flow', level: 'light' } as const;
  it('is stable over key order', () => expect(contentHash('2026-10-09', 'period_flow', v)).toBe(contentHash('2026-10-09', 'period_flow', { level: 'light', kind: 'flow' } as never)));
  it('distinguishes value, day and type', () => {
    expect(contentHash('2026-10-09', 'period_flow', v)).not.toBe(contentHash('2026-10-09', 'period_flow', { kind: 'flow', level: 'heavy' }));
    expect(contentHash('2026-10-09', 'period_flow', v)).not.toBe(contentHash('2026-10-10', 'period_flow', v));
  });
  it('ignores cycleStart and rounds temperatures to 0.01', () => {
    expect(contentHash('2026-10-09', 'period_flow', { ...v, cycleStart: true })).toBe(contentHash('2026-10-09', 'period_flow', v));
    expect(contentHash('2026-10-09', 'bbt', { kind: 'temp', celsius: 36.4000001 })).toBe(contentHash('2026-10-09', 'bbt', { kind: 'temp', celsius: 36.4 }));
  });
});
