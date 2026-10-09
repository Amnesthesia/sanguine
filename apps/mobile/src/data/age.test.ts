import { describe, expect, it } from 'vitest';
import { ageOn, isTeenOn, MIN_AGE, validateBirthDate, defaultBirthDate } from './age';

describe('ageOn: whole years on a given day', () => {
  it('counts the birthday itself and not the day before', () => {
    expect(ageOn('2013-10-10', '2026-10-10')).toBe(13);
    expect(ageOn('2013-10-10', '2026-10-09')).toBe(12);
    expect(ageOn('2013-10-10', '2026-12-31')).toBe(13);
    expect(ageOn('1990-01-01', '2026-10-09')).toBe(36);
  });
  it('29 February birthdays turn a year older on 1 March in common years', () => {
    expect(ageOn('2012-02-29', '2025-02-28')).toBe(12);
    expect(ageOn('2012-02-29', '2025-03-01')).toBe(13);
    expect(ageOn('2012-02-29', '2028-02-29')).toBe(16);
  });
});

describe('minimum age is exactly 13 (PLAN.md §2.4, D-054)', () => {
  const today = '2026-10-09';
  it('MIN_AGE is 13', () => expect(MIN_AGE).toBe(13));
  it('admits someone whose 13th birthday is today, refuses the day before', () => {
    expect(validateBirthDate('2013-10-09', today)).toEqual({ ok: true });
    expect(validateBirthDate('2013-10-10', today)).toEqual({ ok: false, reason: 'tooYoung' }); // the year-only check let this through
    expect(validateBirthDate('2013-12-31', today)).toEqual({ ok: false, reason: 'tooYoung' });
  });
  it('rejects the future, junk and implausible ages; requires a value', () => {
    expect(validateBirthDate('2030-01-01', today)).toEqual({ ok: false, reason: 'tooYoung' });
    expect(validateBirthDate('1890-01-01', today)).toEqual({ ok: false, reason: 'invalid' });
    expect(validateBirthDate('not-a-date', today)).toEqual({ ok: false, reason: 'invalid' });
    expect(validateBirthDate('2000-02-30', today)).toEqual({ ok: false, reason: 'invalid' });
    expect(validateBirthDate(undefined, today)).toEqual({ ok: false, reason: 'required' });
  });
});

describe('teen mode (13-17) uses the exact date when there is one', () => {
  it('turns off on the 18th birthday, not on 1 January', () => {
    expect(isTeenOn({ birthDate: '2008-10-10' }, '2026-10-09')).toBe(true);
    expect(isTeenOn({ birthDate: '2008-10-09' }, '2026-10-09')).toBe(false);
  });
  it('falls back to the year for a profile made before dates were asked', () => {
    expect(isTeenOn({ birthYear: 2012 }, '2026-10-09')).toBe(true);
    expect(isTeenOn({ birthYear: 2008 }, '2026-10-09')).toBe(false);
  });
  it('nothing known is not teen mode', () => expect(isTeenOn({}, '2026-10-09')).toBe(false));
  it('a stored date wins over a stale year', () => expect(isTeenOn({ birthDate: '1990-05-05', birthYear: 2012 }, '2026-10-09')).toBe(false));
});

describe('defaultBirthDate: where the selector starts', () => {
  it('is 30 years before today, so a typical age needs few taps and the age gate is not met by accident', () => {
    expect(defaultBirthDate('2026-10-09')).toBe('1996-10-09');
    expect(defaultBirthDate('2028-02-29')).toBe('1998-02-28'); // no 29 Feb thirty years earlier
  });
});
