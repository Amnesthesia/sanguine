import { describe, expect, it } from 'vitest';
import copy from '../../../../../copy/en-AU.json';
import { taglineFor } from './tagline';

const lines = copy.app.taglines;

describe('taglineFor', () => {
  it('the six client taglines, in order', () => {
    expect(lines).toEqual([
      'Blood demands blood.', 'The River of Blood never empties; it only crests.', 'By blood bound, by brass crowned.',
      'Offerings of bone, rivers of red.', 'The earth drinks deep, yet the Blood God thirsts.', 'An ocean of red for the Lord of Rage.',
    ]);
  });
  it('never repeats on consecutive launches, and cycles through all six', () => {
    const seq = Array.from({ length: 24 }, (_, i) => taglineFor(i + 1, lines, false));
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
    expect(new Set(seq).size).toBe(6);
  });
  it('is deterministic', () => expect(taglineFor(7, lines, false)).toBe(taglineFor(7, lines, false)));
  it('shows nothing in teen mode', () => expect(taglineFor(3, lines, true)).toBeUndefined());
  it('tolerates a bad count', () => {
    expect(taglineFor(-4, lines, false)).toBe(lines[0]);
    expect(taglineFor(Number.NaN, lines, false)).toBe(lines[0]);
  });
});
