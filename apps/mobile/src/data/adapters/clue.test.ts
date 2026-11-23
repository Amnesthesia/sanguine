import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import symptomsJson from '../../../../../copy/symptoms.json';
import { CLUE_SYMPTOM_CODES, clue, parseClue } from './clue';
import type { PickedFile } from './types';
import * as zc from './zipCrypto';

const load = (n: string): PickedFile => ({ name: n, bytes: new Uint8Array(readFileSync(join(__dirname, 'fixtures', n))) });
const text = (name: string, s: string): PickedFile => ({ name, bytes: new TextEncoder().encode(s) });
const rec = (type: string, date: string, value: unknown) => ({ type, id: 'x', date, value });
const opt = (type: string, date: string, ...o: string[]) => rec(type, date, o.length === 1 ? { option: o[0] } : o.map((option) => ({ option })));
const D = '2026-10-05';
const one = (...r: unknown[]) => parseClue(r);
const codes = (r: ReturnType<typeof parseClue>) => r.days[0]?.symptoms ?? [];
const lastProblem = (r: ReturnType<typeof parseClue>) => r.problems[r.problems.length - 1];

describe('clue mapping', () => {
  it('flow: very_heavy is heavy, highest wins, period beats spotting, none is silent', () => {
    expect(one(opt('period', D, 'very_heavy')).days[0]!.flow).toEqual({ level: 'heavy' });
    expect(one(opt('period', D, 'light'), opt('period', D, 'heavy'), opt('period', D, 'medium')).days[0]!.flow).toEqual({ level: 'heavy' });
    expect(one(opt('spotting', D, 'any'), opt('period', D, 'light')).days[0]!.flow).toEqual({ level: 'light' });
    expect(one(opt('spotting', D, 'light')).days[0]!.flow).toEqual({ level: 'spotting' });
    expect(one(opt('period', D, 'none'))).toEqual({ days: [], problems: [] });
  });
  it('pain maps codes with severity as intensity, pain_free is silent', () => {
    const r = one(rec('pain', D, [{ option: 'period_cramps', extent: { severity: 'severe' } }, { option: 'headache' }, { option: 'migraine_with_aura' }, { option: 'breast_tenderness', extent: { severity: 'mild' } }, { option: 'lower_back', extent: { severity: 'moderate' } }, { option: 'ovulation' }, { option: 'pain_free' }]));
    expect(codes(r)).toEqual([{ code: 'cramps', intensity: 3 }, { code: 'headache' }, { code: 'breast_tenderness' }, { code: 'back_pain', intensity: 2 }, { code: 'mid_cycle_pain' }]);
    expect(r.problems).toEqual([]);
    expect(codes(one(rec('pain', D, { option: 'migraine', extent: { severity: 'odd' } })))).toEqual([{ code: 'headache' }]);
  });
  it('feelings, including the six new codes, and counted ones', () => {
    const all = ['happy', 'sad', 'sensitive', 'mood_swings', 'angry', 'irritable', 'anxious', 'confident', 'excited', 'not_in_control', 'insecure', 'grateful', 'indifferent'];
    const r = one(opt('feelings', D, ...all, 'fine'));
    expect(codes(r).map((s) => s.code)).toEqual(['happy', 'mood_low', 'sensitive', 'mood_swings', 'irritability', 'anxiety', 'confident', 'excited', 'not_in_control', 'insecure', 'grateful', 'indifferent']);
    expect(lastProblem(r)).toBe('not imported: feelings:fine ×1');
    expect(codes(one(opt('pms', D, 'yes')))).toEqual([{ code: 'pms' }]);
  });
  it('energy', () => {
    expect(codes(one(opt('energy', D, 'exhausted', 'tired', 'low_energy', 'energetic', 'fully_energized'))).map((s) => s.code)).toEqual(['fatigue', 'energetic']);
    expect(lastProblem(one(opt('energy', D, 'ok')))).toBe('not imported: energy:ok ×1');
  });
  it('sex: protected only if every partnered option is protected; withdrawal is unprotected', () => {
    expect(one(opt('sex_life', D, 'protected')).days[0]!.sex).toEqual({ protected: true });
    expect(one(opt('sex_life', D, 'protected', 'protected')).days[0]!.sex).toEqual({ protected: true });
    expect(one(opt('sex_life', D, 'protected', 'unprotected')).days[0]!.sex).toEqual({ protected: false });
    expect(one(opt('sex_life', D, 'protected', 'withdrawal')).days[0]!.sex).toEqual({ protected: false });
    expect(one(opt('sex_life', D, 'withdrawal')).days[0]!.sex).toEqual({ protected: false });
    expect(one(opt('sex_life', D, 'no_sex_today'))).toEqual({ days: [], problems: [] });
    const r = one(opt('sex_life', D, 'high_sex_drive', 'low_sex_drive', 'painful_intercourse', 'masturbation', 'sex_toys', 'orgasm', 'no_orgasm', 'fantasies'));
    expect(codes(r).map((s) => s.code)).toEqual(['high_libido', 'low_libido', 'painful_sex']);
    expect(lastProblem(r)).toBe('not imported: sex_life:fantasies ×1, sex_life:masturbation ×1, sex_life:no_orgasm ×1, sex_life:orgasm ×1, sex_life:sex_toys ×1');
  });
  it('discharge: most fertile wins, none and atypical are counted, never dry', () => {
    expect(one(opt('discharge', D, 'sticky', 'egg_white', 'creamy')).days[0]!.mucus).toEqual({ quality: 'eggwhite' });
    expect(one(opt('discharge', D, 'sticky', 'watery', 'creamy')).days[0]!.mucus).toEqual({ quality: 'watery' });
    expect(one(opt('discharge', D, 'sticky')).days[0]!.mucus).toEqual({ quality: 'sticky' });
    const r = one(opt('discharge', D, 'none', 'atypical'));
    expect(r.days).toEqual([]);
    expect(lastProblem(r)).toBe('not imported: discharge:atypical ×1, discharge:none ×1');
  });
  it('digestion, skin, craving, mind, sleep_quality', () => {
    const r = one(opt('digestion', D, 'bloated', 'nauseous', 'nauseated', 'constipated', 'diarrhea'), opt('skin', D, 'acne', 'oily'), opt('craving', D, 'sweet', 'salty'), opt('mind', D, 'stressed', 'distracted', 'brain_fog'), opt('sleep_quality', D, 'trouble_falling_asleep', 'night_sweats'));
    expect(codes(r).map((s) => s.code)).toEqual(['bloating', 'nausea', 'constipation', 'diarrhoea', 'acne', 'oily_skin', 'food_cravings', 'stressed', 'unfocused', 'insomnia', 'night_sweats']);
    expect(r.problems).toEqual([]);
  });
  it('several records of one type on a day merge, days are sorted', () => {
    const r = one(opt('feelings', '2026-10-06', 'happy'), opt('feelings', D, 'sad'), opt('feelings', D, 'happy'));
    expect(r.days.map((d) => d.date)).toEqual([D, '2026-10-06']);
    expect(codes(r).map((s) => s.code)).toEqual(['mood_low', 'happy']);
  });
  it('bbt in C and F, excluded is disturbed, out of range is a problem', () => {
    expect(one(rec('bbt', D, { celsius: 36.45 })).days[0]!.temperatures).toEqual([{ valueC: 36.45, type: 'bbt', source: 'oral' }]);
    expect(one(rec('bbt', D, { fahrenheit: 97.7, excluded: true })).days[0]!.temperatures).toEqual([{ valueC: 36.5, type: 'bbt', source: 'oral', disturbed: true }]);
    const r = one(rec('bbt', D, { celsius: 12 }), rec('bbt', D, { fahrenheit: 200 }), rec('bbt', D, 'hot'));
    expect(r.days).toEqual([]);
    expect(r.problems).toEqual(['record 1 (bbt): temperature is out of range', 'record 2 (bbt): temperature is out of range', 'record 3 (bbt): value not recognised']);
  });
  it('notes and tags', () => {
    expect(one(rec('notes', D, { text: 'first' }), rec('notes', D, { text: 'second' }), opt('tags', D, 'a', 'b')).days[0]!.note).toBe('first\n\nsecond\n\nTags: a, b');
    expect(one(opt('tags', D, 'solo')).days[0]!.note).toBe('Tags: solo');
    expect(one(rec('notes', D, { text: '  ' }))).toEqual({ days: [], problems: [] });
  });
  it('counts unmapped types and options by name, sorted, in one line', () => {
    const r = one(opt('tests', D, 'ovulation_x'), opt('tests', '2026-10-06', 'ovulation_x'), rec('sleep_duration', D, { minutes: 480 }), rec('weight', D, { kilograms: 60 }), opt('pain', D, 'other_ache'), opt('period', D, 'weird'), rec('mystery', D, { a: 1 }), opt('medication', D, 'pill'));
    expect(r.days).toEqual([]);
    expect(r.problems).toEqual(['not imported: medication:pill ×1, mystery ×1, pain:other_ache ×1, period:weird ×1, sleep_duration ×1, tests:ovulation_x ×2, weight ×1']);
  });
  it('bad dates and value shapes are problems with the record number, never a crash', () => {
    const r = one(opt('period', '2026-13-40', 'light'), opt('period', 'yesterday', 'light'), rec('period', D, 5), rec('pain', D, [{ option: 'headache' }, 3]), rec('feelings', D, { choice: 'happy' }), null, opt('period', '2026-10-07T08:30:00Z', 'light'));
    expect(r.days).toEqual([{ date: '2026-10-07', flow: { level: 'light' } }]);
    expect(r.problems).toEqual(['record 1: date is not YYYY-MM-DD', 'record 2: date is not YYYY-MM-DD', 'record 3 (period): value not recognised', 'record 4 (pain): value not recognised', 'record 5 (feelings): value not recognised', 'record 6: not a measurement']);
  });
  it('option names like __proto__ cannot misbehave', () => {
    const r = one(opt('feelings', D, '__proto__', 'constructor', 'toString'), opt('period', D, '__proto__'), opt('tests', D, '__proto__'), opt('discharge', D, 'hasOwnProperty'), opt('__proto__', D, 'x'));
    expect(r.days).toEqual([]);
    expect(lastProblem(r)).toBe('not imported: __proto__:x ×1, discharge:hasOwnProperty ×1, feelings:__proto__ ×1, feelings:constructor ×1, feelings:toString ×1, period:__proto__ ×1, tests:__proto__ ×1');
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
  it('every code the mapping can emit is in the symptom catalogue, hidden and non-predictive', () => {
    const cat = new Map(symptomsJson.symptoms.map((s) => [s.code, s]));
    expect(CLUE_SYMPTOM_CODES.length).toBeGreaterThan(30);
    for (const c of CLUE_SYMPTOM_CODES) expect(cat.has(c), c).toBe(true);
    for (const c of ['not_in_control', 'insecure', 'grateful', 'indifferent', 'pms', 'painful_sex']) expect(cat.get(c)).toMatchObject({ defaultVisible: false, affectsPrediction: false });
  });
});

describe('clue adapter', () => {
  const enc = load('clue-synthetic.zip');
  it('detects the zips', () => {
    expect(clue.detect(enc)).toBe('needs_password');
    expect(clue.detect(load('clue-synthetic-plain.zip'))).toBe('yes');
    expect(clue.detect(load('clue-synthetic-stored.zip'))).toBe('no'); // holds only profile.json
    expect(clue.detect({ name: 'x.zip', bytes: new Uint8Array([0x50, 0x4b, 1, 2, 3]) })).toBe('no');
  });
  it('detects plain JSON', () => {
    expect(clue.detect(text('m.json', JSON.stringify([opt('period', D, 'light')])))).toBe('yes');
    expect(clue.detect(text('m.json', JSON.stringify([rec('zzz', D, {})])))).toBe('no');
    expect(clue.detect(text('m.json', JSON.stringify([{ type: 'period', date: D }])))).toBe('no');
    expect(clue.detect(text('m.json', 'not json'))).toBe('no');
    expect(clue.detect(text('m.json', '{"a":1}'))).toBe('no');
    expect(clue.detect(text('m.csv', 'date,flow\n'))).toBe('no');
  });
  it('a sibling Clue file decodes to no data and one hint', () => {
    for (const s of ['{"profileData":{"x":1},"createdAt":"c","updatedAt":"u"}', '{"Consents":[]}', '{"Notifications":[]}', '{"email":"a@b.c"}']) {
      const f = text('profile.json', s);
      expect(clue.detect(f)).toBe('yes');
      expect(clue.decode(f, {})).toMatchObject({ data: { days: [] }, problems: ['Choose measurements.json from the Clue folder'] });
    }
  });
  it('decodes the encrypted zip with the password', () => {
    const r = clue.decode(enc, { password: 'sanguine-test' });
    expect(r.data.source).toEqual({ app: 'clue' });
    expect(r.data.days.map((d) => d.date)).toEqual(['2026-10-21', '2026-11-03']);
    expect(r.data.days[0]).toMatchObject({ flow: { level: 'medium' }, symptoms: [{ code: 'cramps' }, { code: 'headache' }] });
    expect(r.data.days[1]!.mucus).toEqual({ quality: 'eggwhite' });
    expect(r.problems).toEqual(['not imported: sleep_duration ×1']);
    expect(clue.decode(load('clue-synthetic-plain.zip'), {}).data).toEqual(r.data);
  });
  it('password errors propagate untouched and never contain the password', () => {
    expect(() => clue.decode(enc, {})).toThrow(zc.ZipPasswordNeeded);
    let err: unknown;
    try { clue.decode(enc, { password: 'hunter2-wrong' }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(zc.ZipWrongPassword);
    expect(String((err as Error).message)).not.toContain('hunter2');
  });
  it('reads only measurements.json', () => {
    const read = vi.spyOn(zc, 'readZipEntry');
    clue.decode(enc, { password: 'sanguine-test' });
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0]![1].name).toBe('measurements.json');
    read.mockRestore();
  });
});
