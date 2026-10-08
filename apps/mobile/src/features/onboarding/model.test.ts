import { describe, expect, it } from 'vitest';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { type Answers, buildOnboardingWrites, MIN_AGE, ageByYear, canContinue, validateBirthYear, validateMenarcheYear, validateUsualLength } from './model';

const base: Answers = { birthYear: 1990, menarcheYear: undefined, lastPeriod: undefined, usualLength: undefined, lifeState: 'none', method: 'combined_pill', stateDate: '2026-10-10', breastfeeding: false, consent: true };
const YEAR = 2026;

describe('age gate (minimum 13, PLAN.md §2.4, §8.6)', () => {
  it('MIN_AGE is 13', () => expect(MIN_AGE).toBe(13));
  it('ageByYear', () => expect(ageByYear(2013, YEAR)).toBe(13));
  it('accepts 13 and older, rejects younger, junk and the future', () => {
    expect(validateBirthYear(2013, YEAR)).toEqual({ ok: true });
    expect(validateBirthYear(1990, YEAR)).toEqual({ ok: true });
    expect(validateBirthYear(2014, YEAR)).toEqual({ ok: false, reason: 'tooYoung' });
    expect(validateBirthYear(2030, YEAR)).toEqual({ ok: false, reason: 'tooYoung' });
    expect(validateBirthYear(1890, YEAR)).toEqual({ ok: false, reason: 'invalid' });
    expect(validateBirthYear(Number.NaN, YEAR)).toEqual({ ok: false, reason: 'invalid' });
    expect(validateBirthYear(undefined, YEAR)).toEqual({ ok: false, reason: 'required' });
  });
  it('menarche year is optional, after birth, and not in the future', () => {
    expect(validateMenarcheYear(undefined, 1990, YEAR).ok).toBe(true);
    expect(validateMenarcheYear(2003, 1990, YEAR).ok).toBe(true);
    expect(validateMenarcheYear(1995, 1990, YEAR).ok).toBe(false); // age 5
    expect(validateMenarcheYear(2030, 1990, YEAR).ok).toBe(false);
  });
  it('usual cycle length is optional, 15-90 days', () => {
    expect(validateUsualLength(undefined).ok).toBe(true);
    expect(validateUsualLength(28).ok).toBe(true);
    expect(validateUsualLength(14).ok).toBe(false);
    expect(validateUsualLength(91).ok).toBe(false);
  });
});

describe('step gating', () => {
  it('only the age step blocks, and the last step needs consent', () => {
    expect(canContinue(0, base, YEAR)).toBe(true);
    expect(canContinue(1, { ...base, birthYear: undefined }, YEAR)).toBe(false);
    expect(canContinue(1, { ...base, birthYear: 2015 }, YEAR)).toBe(false);
    expect(canContinue(1, base, YEAR)).toBe(true);
    expect(canContinue(2, base, YEAR)).toBe(true);
    expect(canContinue(3, base, YEAR)).toBe(true);
    expect(canContinue(4, { ...base, consent: false }, YEAR)).toBe(false);
    expect(canContinue(4, base, YEAR)).toBe(true);
  });
});

describe('what onboarding writes', () => {
  it('profile from the answers; nothing else needed when everything is skipped', () => {
    expect(buildOnboardingWrites({ ...base }, '2026-10-10').profile).toEqual({ birthYear: 1990 });
    const w = buildOnboardingWrites({ ...base, menarcheYear: 2003, usualLength: 29, lastPeriod: '2026-10-01' }, '2026-10-10');
    expect(w.profile).toEqual({ birthYear: 1990, menarcheYear: 2003, usualCycleLength: 29 });
    expect(w.events).toEqual([{ kind: 'period.start', payload: { day: '2026-10-01' } }]);
    expect(buildOnboardingWrites({ ...base }, '2026-10-10').events).toEqual([]);
  });
  it('life states become life_state.set events with the right detail', () => {
    const ev = (lifeState: Answers['lifeState'], extra: Partial<Answers> = {}) => buildOnboardingWrites({ ...base, lifeState, ...extra }, '2026-10-10').events;
    expect(ev('hormonal')).toEqual([{ kind: 'life_state.set', payload: { kind: 'hormonal_contraception', detail: { method: 'combined_pill' }, day: '2026-10-10' } }]);
    expect(ev('postHormonal', { stateDate: '2026-09-01' })).toEqual([{ kind: 'life_state.set', payload: { kind: 'post_contraception', detail: { method: 'combined_pill' }, day: '2026-09-01' } }]);
    expect(ev('pregnant')[0]?.payload).toMatchObject({ kind: 'pregnant' });
    expect(ev('postpartum', { breastfeeding: true })[0]?.payload).toMatchObject({ kind: 'postpartum', detail: { breastfeeding: true } });
    expect(ev('perimenopause')[0]?.payload).toMatchObject({ kind: 'perimenopause' });
    expect(ev('irregular')[0]?.payload).toMatchObject({ kind: 'known_irregular', detail: { reason: 'other' } });
    expect(ev('none')).toEqual([]);
  });
  it('a future last-period date is dropped', () =>
    expect(buildOnboardingWrites({ ...base, lastPeriod: '2026-12-01' }, '2026-10-10').events).toEqual([]));
  it('every produced event passes the event validator and builds a working store', async () => {
    const db = openTestDb();
    await migrate(db);
    let n = 0;
    const store = new EventStore(db, { nowMs: () => 1 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) });
    const w = buildOnboardingWrites({ ...base, lastPeriod: '2026-10-01', lifeState: 'hormonal', usualLength: 28 }, '2026-10-10');
    await store.setProfile(w.profile);
    await store.appendMany(w.events);
    const { history, settings } = await store.engineInputs();
    expect(history.cycles).toHaveLength(1);
    expect(settings.lifeStates).toEqual([{ kind: 'hormonal_contraception', method: 'combined_pill', since: '2026-10-10' }]);
  });
});
