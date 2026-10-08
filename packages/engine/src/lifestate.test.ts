import { describe, expect, it } from 'vitest';
import { classifyCycles } from './classify';
import { addDays } from './dates';
import { FIXTURE_SETTINGS, historyFromLengths, LAST_START, TODAY } from './fixtures';
import { evaluateLifeStates, suggestPerimenopause } from './lifestate';
import type { CycleRecord, EngineSettings, LifeState } from './types';

const settings = (...lifeStates: Array<LifeState & { until?: string }>): EngineSettings => ({ ...FIXTURE_SETTINGS, lifeStates });
const gate = (lengths: number[], s: EngineSettings, today = TODAY) => {
  const c = classifyCycles(historyFromLengths(lengths).cycles, s);
  return { c, g: evaluateLifeStates(c, s, today) };
};

describe('no life state', () => {
  it('is a transparent gate', () => {
    const { c, g } = gate([28, 30, 29], settings());
    expect(g.suspended).toBeUndefined();
    expect(g.lambda).toBe(1);
    expect(g.varianceScale).toBe(1);
    expect(g.confidenceCap).toBeUndefined();
    expect(g.calendarEstimate).toBe(true);
    expect(c.every((x) => g.cycleWeight(x) === 1)).toBe(true);
  });
});

describe('suspending states (§4.9, fixture I)', () => {
  it('hormonal contraception of any method suspends', () => {
    for (const method of ['combined_pill', 'pop', 'implant', 'injection', 'hormonal_iud', 'ring', 'patch'] as const)
      expect(gate([28, 30, 29], settings({ kind: 'hormonal_contraception', method, since: LAST_START })).g.suspended?.reason).toBe('hormonal_contraception');
  });
  it('pregnant suspends', () => expect(gate([28], settings({ kind: 'pregnant', since: LAST_START })).g.suspended?.reason).toBe('pregnant'));
  it('a state with an end date in the past no longer suspends', () =>
    expect(gate([28], settings({ kind: 'pregnant', since: '2026-01-01', until: '2026-06-01' })).g.suspended).toBeUndefined());
  it('a state that starts after today does not suspend yet', () =>
    expect(gate([28], settings({ kind: 'pregnant', since: '2026-12-01' })).g.suspended).toBeUndefined());
});

describe('post-contraception warm-up (C-08)', () => {
  const stopped = (lengths: number[]) => {
    const h = historyFromLengths(lengths);
    // stop 2 days before the second-to-last cycle starts: cycles from index `n-3` on are post-stop
    const s = settings({ kind: 'post_contraception', stopped: h.cycles[Math.max(0, h.cycles.length - 3)]?.start as string, method: 'combined_pill' });
    return gate(lengths, s);
  };
  it('while fewer than 3 post-stop cycles are complete: pre-stop cycles weigh 0, post-stop 0.5, confidence capped low', () => {
    const { c, g } = stopped([28, 30, 29, 31]); // post-stop cycles: 2 complete + the open one
    expect(g.confidenceCap).toBe('low');
    expect(c.map((x) => g.cycleWeight(x))).toEqual([0, 0, 0.5, 0.5, 0.5]);
  });
  it('after three complete post-stop cycles the warm-up ends', () => {
    const h = historyFromLengths([28, 30, 29, 31]);
    const s = settings({ kind: 'post_contraception', stopped: h.cycles[1]?.start as string, method: 'implant' });
    const { c, g } = gate([28, 30, 29, 31], s);
    expect(g.confidenceCap).toBeUndefined();
    expect(c.every((x) => g.cycleWeight(x) === 1)).toBe(true);
  });
});

describe('postpartum (C-09)', () => {
  const delivered = addDays(LAST_START, -5);
  it('suspended until the first period after delivery', () => {
    expect(gate([28, 30, 29], settings({ kind: 'postpartum', delivered: addDays(LAST_START, 3), breastfeeding: false }), addDays(LAST_START, 6)).g.suspended?.reason).toBe('postpartum');
  });
  it('after the first period it runs like the post-contraception warm-up (low)', () => {
    const { g } = gate([28, 30, 29], settings({ kind: 'postpartum', delivered, breastfeeding: false }));
    expect(g.suspended).toBeUndefined();
    expect(g.confidenceCap).toBe('low');
    expect(g.calendarEstimate).toBe(true);
  });
  it('breastfeeding: no calendar band until an ovulation is biomarker-confirmed', () => {
    const s = settings({ kind: 'postpartum', delivered, breastfeeding: true });
    const { c, g } = gate([28, 30, 29], s);
    expect(g.calendarEstimate).toBe(false);
    const confirmed: CycleRecord[] = c.map((x, i) => (i === c.length - 1 ? { ...x, ovulation: { point: x.start, sd: 1, basis: 'lh' as const } } : x));
    expect(evaluateLifeStates(confirmed, s, TODAY).calendarEstimate).toBe(true);
  });
});

describe('perimenopause (§4.9)', () => {
  it('lambda 0.8, variance prior doubled, biomarker-only band, 60-day gap', () => {
    const g = gate([28, 30, 29], settings({ kind: 'perimenopause', since: '2025-01-01' })).g;
    expect(g.lambda).toBe(0.8);
    expect(g.varianceScale).toBe(2);
    expect(g.calendarEstimate).toBe(false);
    expect(g.missedGapDays).toBe(60);
    expect(g.suspended).toBeUndefined();
  });
});

describe('known irregular', () => {
  it('caps confidence at medium and keeps the calendar estimate', () => {
    const g = gate([28, 30, 29], settings({ kind: 'known_irregular', reason: 'other', since: '2020-01-01' })).g;
    expect(g.confidenceCap).toBe('medium');
    expect(g.calendarEstimate).toBe(true);
  });
  it('the most conservative cap wins when states combine', () => {
    const g = gate([28, 30, 29], settings({ kind: 'known_irregular', reason: 'pcos', since: '2020-01-01' }, { kind: 'post_contraception', stopped: '2026-08-01', method: 'pill' })).g;
    expect(g.confidenceCap).toBe('low');
  });
});

describe('suggestPerimenopause (STRAW+10 early transition, age >= 40)', () => {
  const cycles = (lengths: number[]) => classifyCycles(historyFromLengths(lengths).cycles, FIXTURE_SETTINGS);
  const s40: EngineSettings = { ...FIXTURE_SETTINGS, birthYear: 1984 }; // 42 in 2026
  it('suggests when consecutive cycles differ by >= 7 days at least twice in the last three differences', () =>
    expect(suggestPerimenopause(cycles([28, 36, 27, 35]), s40, TODAY)).toBe(true));
  it('does not suggest for regular cycles or under 40', () => {
    expect(suggestPerimenopause(cycles([28, 30, 29, 28]), s40, TODAY)).toBe(false);
    expect(suggestPerimenopause(cycles([28, 36, 27, 35]), { ...FIXTURE_SETTINGS, birthYear: 1995 }, TODAY)).toBe(false);
    expect(suggestPerimenopause(cycles([28, 36, 27, 35]), FIXTURE_SETTINGS, TODAY)).toBe(false);
  });
  it('does not suggest when already set', () =>
    expect(suggestPerimenopause(cycles([28, 36, 27, 35]), { ...s40, lifeStates: [{ kind: 'perimenopause', since: '2025-01-01' }] }, TODAY)).toBe(false));
});
