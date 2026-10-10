import { addDays, type CycleRecord, type DailyLog, type ISODate } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import symptomCatalog from '../../../../../copy/symptoms.json';
import { NOTE_SYMPTOMS, noteDay, symptomNote } from './symptomNote';

// closed cycles oldest first, each `len` days, starting from `first`
function cycles(first: ISODate, lens: number[], quality: CycleRecord['quality'] = 'valid'): CycleRecord[] {
  let s = first;
  return lens.map((len, i) => {
    const c = { id: `c${i}`, start: s, nextStart: addDays(s, len), length: len, quality } as CycleRecord;
    s = addDays(s, len);
    return c;
  });
}
const log = (date: ISODate, ...codes: string[]): DailyLog => ({ date, symptoms: codes.map((code) => ({ code, intensity: 2 as const })) }) as DailyLog;
const at = (c: CycleRecord, day: number) => addDays(c.start, day - 1);

describe('symptomNote', () => {
  const cs = cycles('2026-05-01', [28, 28, 28, 28]);

  it('reports a symptom logged around this cycle day in 3 of the last 4 cycles', () => {
    const logs = [2, 1, 3].map((d, i) => log(at(cs[i] as CycleRecord, d), 'cramps'));
    expect(symptomNote(cs, logs, 2)).toEqual([{ code: 'cramps', hits: 3, cycles: 4 }]);
  });

  it('counts a cycle once even when the symptom is logged on every day of the window', () => {
    const logs = [1, 2, 3].flatMap((d) => cs.slice(0, 3).map((c) => log(at(c, d), 'cramps')));
    expect(symptomNote(cs, logs, 2)).toEqual([{ code: 'cramps', hits: 3, cycles: 4 }]);
  });

  it('unlogged cycle counts in the denominator', () => {
    const six = cycles('2026-01-01', [28, 28, 28, 28, 28, 28]);
    const logs = six.slice(0, 3).map((c) => log(at(c, 10), 'headache'));
    expect(symptomNote(six, logs, 10)).toEqual([{ code: 'headache', hits: 3, cycles: 6 }]);
  });

  it('is empty below 3 hits, below half the cycles, or with fewer than 3 closed cycles', () => {
    expect(symptomNote(cs, cs.slice(0, 2).map((c) => log(at(c, 5), 'acne')), 5)).toEqual([]);
    const seven = cycles('2026-01-01', [28, 28, 28, 28, 28, 28, 28]); // looks back at 6 only
    expect(symptomNote(seven, seven.slice(-6, -3).map((c) => log(at(c, 5), 'acne')), 5)).toEqual([{ code: 'acne', hits: 3, cycles: 6 }]);
    expect(symptomNote(seven, seven.slice(-6, -4).map((c) => log(at(c, 5), 'acne')), 5)).toEqual([]);
    const two = cycles('2026-05-01', [28, 28]);
    expect(symptomNote(two, two.map((c) => log(at(c, 2), 'cramps')), 2)).toEqual([]);
  });

  it('only looks at the last 6 closed cycles', () => {
    const eight = cycles('2025-11-01', [28, 28, 28, 28, 28, 28, 28, 28]);
    const logs = eight.slice(0, 3).map((c) => log(at(c, 4), 'fatigue')); // the oldest three only
    expect(symptomNote(eight, logs, 4)).toEqual([]);
  });

  it('no hits beyond the cycle\'s own length (a late cycle shows nothing)', () => {
    const logs = cs.map((c) => log(addDays(c.nextStart as ISODate, 1), 'bloating')); // day 2 of the *next* cycle
    expect(symptomNote(cs, logs, 30)).toEqual([]);
  });

  it('never counts suspect, excluded or open cycles', () => {
    const bad = [...cycles('2026-01-01', [28, 28, 28], 'suspect_skip'), { id: 'open', start: '2026-03-26', quality: 'valid' } as CycleRecord];
    const logs = bad.map((c) => log(at(c, 2), 'cramps'));
    expect(symptomNote(bad, logs, 2)).toEqual([]);
  });

  it('never shows a code outside the allow-list, however often it is logged', () => {
    const logs = cs.map((c) => log(at(c, 2), 'mood_low', 'low_libido', 'diarrhoea', 'midcycle_spotting', 'mid_cycle_pain'));
    expect(symptomNote(cs, logs, 2)).toEqual([]);
  });

  it('shows at most 2 lines, most frequent first, ties by code', () => {
    const logs = cs.map((c, i) => log(at(c, 2), 'headache', 'cramps', 'acne', ...(i < 3 ? [] : ['fatigue'])));
    expect(symptomNote(cs, logs, 2).map((l) => l.code)).toEqual(['acne', 'cramps']);
  });

  it('is empty without a day of cycle', () => {
    expect(symptomNote(cs, cs.map((c) => log(at(c, 2), 'cramps')), undefined)).toEqual([]);
  });

  it('allow-list holds only catalogued, non-fertility codes (teen mode needs no extra gate)', () => {
    const known = new Set(symptomCatalog.symptoms.map((s) => s.code));
    for (const c of NOTE_SYMPTOMS) expect(known.has(c)).toBe(true);
    for (const c of ['midcycle_spotting', 'mid_cycle_pain', 'low_libido', 'high_libido']) expect(NOTE_SYMPTOMS.has(c)).toBe(false);
    for (const c of ['breast_tenderness', 'pelvic_pain']) expect(NOTE_SYMPTOMS.has(c)).toBe(true); // owner, D-087: nothing is too personal for a logging app
  });
});

describe('noteDay', () => {
  it('passes the day through only when the preference is on and Today is predicted or in progress', () => {
    expect(noteDay(true, 'predicted', 11)).toBe(11);
    expect(noteDay(true, 'inProgress', 2)).toBe(2);
    for (const s of ['empty', 'suspended', 'late'] as const) expect(noteDay(true, s, 11)).toBeUndefined();
    expect(noteDay(false, 'predicted', 11)).toBeUndefined();
  });
});
