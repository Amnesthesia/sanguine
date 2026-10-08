import { describe, expect, it } from 'vitest';
import { classifyCycles, classifyDetailed, madThreshold } from './classify';
import { FIXTURE_SETTINGS, historyFromLengths } from './fixtures';
import type { CycleRecord, EngineSettings } from './types';

const q = (lengths: number[], settings: EngineSettings = FIXTURE_SETTINGS, opts = {}) =>
  classifyCycles(historyFromLengths(lengths).cycles, settings, opts).map((c) => c.quality);

describe('derived fields', () => {
  it('sets nextStart, length and bleedDays; the last cycle is open', () => {
    const h = historyFromLengths([28, 30]);
    const c = classifyCycles(h.cycles, FIXTURE_SETTINGS);
    expect(c.map((x) => x.length)).toEqual([28, 30, undefined]);
    expect(c[0]?.nextStart).toBe(c[1]?.start);
    expect(c[0]?.bleedDays).toBe(5);
    expect(c[2]?.nextStart).toBeUndefined();
  });
  it('sorts by start and does not mutate its input', () => {
    const h = historyFromLengths([28, 30, 29]);
    const shuffled: CycleRecord[] = [h.cycles[2], h.cycles[0], h.cycles[3], h.cycles[1]] as CycleRecord[];
    const before = JSON.stringify(shuffled);
    const out = classifyCycles(shuffled, FIXTURE_SETTINGS);
    expect(out.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(JSON.stringify(shuffled)).toBe(before);
  });
});

describe('hard bounds (§4.4 rules 1-2)', () => {
  it('< 15 d is suspect_short', () => expect(q([28, 12, 29])).toEqual(['valid', 'suspect_short', 'valid', 'valid']));
  it('15 d is valid, 90 d is valid when only two cycles', () => expect(q([15, 90])).toEqual(['valid', 'valid', 'valid']));
  it('> 90 d is suspect_skip even with fewer than 3 cycles', () => expect(q([28, 91])).toEqual(['valid', 'suspect_skip', 'valid']));
});

describe('robust exclusion (§4.4 rule 3, fixtures B and D)', () => {
  it('threshold is median + max(7, 3 * 1.4826 * MAD)', () => {
    expect(madThreshold([27, 29, 56, 28, 30, 28], 7)).toBeCloseTo(35.5, 6);
    expect(madThreshold([24, 38, 31, 45, 27, 36], 7)).toBeCloseTo(57.96, 1);
  });
  it('B: the 56-day cycle is suspect_skip', () =>
    expect(q([27, 29, 56, 28, 30, 28])).toEqual(['valid', 'valid', 'suspect_skip', 'valid', 'valid', 'valid', 'valid']));
  it('D: nothing is excluded', () => expect(new Set(q([24, 38, 31, 45, 27, 36]))).toEqual(new Set(['valid'])));
  it('with two cycles nothing is excluded by the MAD rule', () => expect(q([28, 70])).toEqual(['valid', 'valid', 'valid']));
  it('cycle exactly at the threshold stays valid', () => {
    // lengths 28 x 4 + 35: median 28, MAD 0, threshold 28 + 7 = 35
    expect(q([28, 28, 28, 28, 35]).slice(4, 5)).toEqual(['valid']);
    expect(q([28, 28, 28, 28, 36]).slice(4, 5)).toEqual(['suspect_skip']);
  });
  it('known_irregular raises the floor to 14 days', () => {
    const settings: EngineSettings = { ...FIXTURE_SETTINGS, lifeStates: [{ kind: 'known_irregular', reason: 'other', since: '2020-01-01' }] };
    expect(q([28, 28, 28, 28, 40], FIXTURE_SETTINGS).slice(4, 5)).toEqual(['suspect_skip']);
    expect(q([28, 28, 28, 28, 40], settings).slice(4, 5)).toEqual(['valid']);
    expect(q([28, 28, 28, 28, 43], settings).slice(4, 5)).toEqual(['suspect_skip']);
  });
  it('confirm_long re-admits a suspect_skip cycle', () => {
    const h = historyFromLengths([27, 29, 56, 28, 30, 28]);
    const out = classifyCycles(h.cycles, FIXTURE_SETTINGS, { confirmedLong: [h.cycles[2]?.start as string] });
    expect(out[2]?.quality).toBe('valid');
  });
  it('confirm_long does not re-admit a cycle over 90 days', () => {
    const h = historyFromLengths([28, 95, 28]);
    const out = classifyCycles(h.cycles, FIXTURE_SETTINGS, { confirmedLong: [h.cycles[1]?.start as string] });
    expect(out[1]?.quality).toBe('suspect_skip');
  });
});

describe('exclusions and life states (§4.4 rule 4)', () => {
  it('user_excluded', () => {
    const h = historyFromLengths([28, 30, 29]);
    const out = classifyCycles(h.cycles, FIXTURE_SETTINGS, { excluded: [h.cycles[1]?.start as string] });
    expect(out.map((c) => c.quality)).toEqual(['valid', 'user_excluded', 'valid', 'valid']);
  });
  it('a cycle overlapping a suspending life state is life_state; earlier cycles are untouched (fixture I)', () => {
    const settings: EngineSettings = {
      ...FIXTURE_SETTINGS,
      lifeStates: [{ kind: 'hormonal_contraception', method: 'combined_pill', since: '2026-10-01' }],
    };
    expect(q([28, 30, 29], settings)).toEqual(['valid', 'valid', 'valid', 'life_state']);
  });
  it('life state with an end date only affects overlapping cycles', () => {
    const h = historyFromLengths([28, 30, 29]);
    const settings: EngineSettings = {
      ...FIXTURE_SETTINGS,
      lifeStates: [{ kind: 'pregnant', since: h.cycles[1]?.start as string, until: h.cycles[1]?.end as string }],
    };
    expect(classifyCycles(h.cycles, settings).map((c) => c.quality)).toEqual(['valid', 'life_state', 'valid', 'valid']);
  });
  it('perimenopause and known_irregular do not exclude cycles', () => {
    const settings: EngineSettings = { ...FIXTURE_SETTINGS, lifeStates: [{ kind: 'perimenopause', since: '2020-01-01' }] };
    expect(new Set(q([28, 30, 29], settings))).toEqual(new Set(['valid']));
  });
  it('life_state cycles are left out of the MAD statistics', () => {
    const settings: EngineSettings = {
      ...FIXTURE_SETTINGS,
      lifeStates: [{ kind: 'pregnant', since: '2026-01-01', until: '2026-04-01' }],
    };
    const d = classifyDetailed(historyFromLengths([28, 28, 28, 28]).cycles, settings);
    expect(d.every((x) => x.reason === undefined || x.record.quality !== 'valid')).toBe(true);
  });
});

describe('reasons', () => {
  it('give a short machine reason for each non-valid cycle', () => {
    const d = classifyDetailed(historyFromLengths([27, 29, 56, 28, 30, 28]).cycles, FIXTURE_SETTINGS);
    expect(d[2]?.reason).toMatch(/longer than/);
    expect(d[0]?.reason).toBeUndefined();
  });
});
