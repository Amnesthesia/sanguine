import { describe, expect, it } from 'vitest';
import '@/i18n';
import i18next from 'i18next';
import { importParts, importText, newSymptoms, type DoneImport } from './importMessage';

const t = (k: string, o?: Record<string, unknown>) => i18next.t(k, o) as string;
const data = (over: Partial<Extract<DoneImport, { kind: 'data' }>['result']> = {}, extra: Partial<Extract<DoneImport, { kind: 'data' }>> = {}): DoneImport =>
  ({ kind: 'data', adapter: 'clue', result: { added: 1284, skipped: 0, duplicates: 0, notesDropped: 0, kept: 0, ...over }, problems: [], symptoms: [], ...extra });

describe('importMessage', () => {
  it('says the count only when nothing else happened', () => {
    expect(importText(t, importParts(t, data(), []))).toBe('Imported 1284 records.');
  });
  it('adds kept days (singular and plural), dropped notes and the symptoms switched on', () => {
    expect(importParts(t, data({ kept: 1 }), []).paras[1]).toBe('Kept your own entry on 1 day where the file had something different.');
    const p = importParts(t, data({ kept: 6, notesDropped: 2 }), ['headache', 'breast_tenderness']);
    expect(p.paras[0]).toBe('Imported 1284 records. 2 notes were skipped because the file has no notes column.');
    expect(p.paras[1]).toContain('on 6 days');
    expect(p.paras[2]).toBe('Switched on in Tracking, so they show when you log: headache, breast tenderness.');
  });
  it('lists the first five problems and counts the rest', () => {
    const problems = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const p = importParts(t, data({}, { problems }), []);
    expect(p.problems).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(importText(t, p)).toBe('Imported 1284 records.\nNot everything could be imported: a; b; c; d; e and 2 more.');
  });
  it('counts a Sanguine bundle by imported and a csv by added', () => {
    expect(importParts(t, { kind: 'sanguine', result: { imported: 7, duplicates: 0 } }, []).paras[0]).toBe('Imported 7 records.');
    expect(importParts(t, { kind: 'csv', result: { added: 3, skipped: 0, problems: [] } }, []).paras[0]).toBe('Imported 3 records.');
  });
  it('switches on only symptoms that are not on yet, and only for day-based files', () => {
    expect(newSymptoms(data({}, { symptoms: ['cramps', 'headache'] }), ['cramps'])).toEqual(['headache']);
    expect(newSymptoms({ kind: 'csv', result: { added: 1, skipped: 0, problems: [] } }, [])).toEqual([]);
  });
});
