// D-093 (fixes the I-17 rejection in D-075). The BBT time exclusion needs the wall-clock time the reading was taken at.
// Manual and file imports store plain local time; health imports store wall-clock time with the sample's offset (new) or,
// in events written before D-093, a UTC instant ("…Z"), which can only be read in the phone's zone.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { localTimeOfDay } from './project';

describe('localTimeOfDay', () => {
  let tz: string | undefined;
  beforeEach(() => { tz = process.env.TZ; process.env.TZ = 'Australia/Sydney'; });
  afterEach(() => { if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz; });

  it('keeps a local wall-clock time as written', () => expect(localTimeOfDay('2026-10-10T06:40:00')).toBe('06:40'));
  it('converts a UTC instant to the phone\'s local time (06:40 AEDT, not 19:40)', () => expect(localTimeOfDay('2026-10-09T19:40:00.000Z')).toBe('06:40'));
  it('keeps the wall-clock time of an explicit offset, wherever the phone is now', () => {
    expect(localTimeOfDay('2026-10-10T06:40:00+10:00')).toBe('06:40');
    expect(localTimeOfDay('2026-10-10T05:30:00-04:00')).toBe('05:30');
  });
  it('keeps a trailing fraction or a colon-less offset', () => expect(localTimeOfDay('2026-10-10T06:40:00.123456+1000')).toBe('06:40'));
  it('reads a long fraction before Z', () => expect(localTimeOfDay('2026-10-09T19:40:00.123456789Z')).toBe('06:40'));
  it('reads a lower-case z as UTC', () => expect(localTimeOfDay('2026-10-09T19:40:00z')).toBe('06:40'));
  it('returns undefined without a time', () => {
    expect(localTimeOfDay('2026-10-10')).toBeUndefined();
    expect(localTimeOfDay('garbage')).toBeUndefined();
  });
});
