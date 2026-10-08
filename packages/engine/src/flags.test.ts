import { describe, expect, it } from 'vitest';
import { classifyCycles } from './classify';
import { addDays } from './dates';
import { evaluateFlags, FLAG_RATE_LIMIT_DAYS } from './flags';
import { FIXTURE_SETTINGS, historyFromLengths, LAST_START, TODAY } from './fixtures';
import type { CycleRecord, DailyLog, EngineSettings, ISODate } from './types';

const codes = (cycles: CycleRecord[], logs: DailyLog[] = [], s: EngineSettings = FIXTURE_SETTINGS, today: ISODate = TODAY, ctx = {}) =>
  evaluateFlags(cycles, logs, s, today, ctx).map((f) => f.code);
const cyc = (lengths: number[], s: EngineSettings = FIXTURE_SETTINGS, o = {}) => classifyCycles(historyFromLengths(lengths).cycles, s, o);
const adult: EngineSettings = { ...FIXTURE_SETTINGS, birthYear: 1990 }; // 36 in 2026
const withAge = (age: number, extra: Partial<EngineSettings> = {}): EngineSettings => ({ ...FIXTURE_SETTINGS, birthYear: 2026 - age, ...extra });

describe('short cycles (ER-33)', () => {
  it('2 of the last 3 valid cycles < 24 d', () => expect(codes(cyc([28, 22, 23]))).toEqual(['short']));
  it('23 flags, 24 does not', () => {
    expect(codes(cyc([28, 23, 23]))).toContain('short');
    expect(codes(cyc([28, 24, 24]))).not.toContain('short');
  });
  it('only 1 of 3 does not flag', () => expect(codes(cyc([28, 22, 28]))).toEqual([]));
  it('threshold is 21 within 1-3 years of menarche', () => {
    const teen = withAge(15, { menarcheYear: 2024 });
    expect(codes(cyc([22, 22, 22]), [], teen)).toEqual([]);
    expect(codes(cyc([22, 20, 20]), [], teen)).toEqual(['short']);
    expect(evaluateFlags(cyc([22, 20, 20]), [], teen, TODAY)[0]?.params.threshold).toBe(21);
  });
  it('suspect_short cycles do not count', () => expect(codes(cyc([28, 10, 22, 23]))).toEqual(['short']));
});

describe('long cycles (ER-34)', () => {
  it('2 of the last 3 > 38 d', () => expect(codes(cyc([28, 40, 41]))).toEqual(['long']));
  it('38 does not flag, 39 does', () => {
    expect(codes(cyc([28, 38, 38]))).not.toContain('long');
    expect(codes(cyc([28, 39, 39]))).toContain('long');
  });
  it('threshold is 45 within 1-3 years of menarche', () => {
    const teen = withAge(15, { menarcheYear: 2024 });
    expect(codes(cyc([28, 40, 41]), [], teen)).toEqual([]);
    expect(codes(cyc([28, 46, 47]), [], teen)).toEqual(['long']);
  });
  it('a skipped log (suspect_skip) still counts toward long cycles, per §4.14 S2', () => {
    // lengths 28, 28, 28, 28, 60, 60: both 60s exceed the MAD limit
    expect(codes(cyc([28, 28, 28, 28, 60, 60]))).toContain('long');
  });
  it('any single cycle > 90 d after the first year: longSingle', () => expect(codes(cyc([28, 95, 28]))).toEqual(['longSingle']));
  it('perimenopause replaces the 38-day rule with 60 days', () => {
    const peri = { ...adult, lifeStates: [{ kind: 'perimenopause' as const, since: '2025-01-01' }] };
    expect(codes(cyc([28, 40, 41]), [], peri, TODAY, { gapDays: 60 })).toEqual([]);
    expect(codes(cyc([28, 62, 63]), [], peri, TODAY, { gapDays: 60 })).toContain('long');
  });
});

describe('year one after menarche', () => {
  const yr1 = withAge(14, { menarcheYear: 2026 });
  it('raises no cycle-length flag', () => expect(codes(cyc([20, 50, 60, 15, 80, 44]), [], yr1)).toEqual([]));
});

describe('variability (ER-35, fixture D)', () => {
  it('range over the last 6 valid cycles > 9 d (age unknown): fires with range 21', () => {
    const f = evaluateFlags(cyc([24, 38, 31, 45, 27, 36]), [], FIXTURE_SETTINGS, TODAY);
    expect(f.map((x) => x.code)).toEqual(['variability']);
    expect(f[0]?.params).toEqual({ days: 9, range: 21 });
  });
  it('threshold 7 d at ages 26-41, 9 d at 18-25 and 42-45', () => {
    const lens = [28, 31, 29, 34, 28, 33]; // range 6
    expect(codes(cyc(lens), [], withAge(30))).toEqual([]);
    const lens2 = [28, 35, 29, 36, 28, 31]; // range 8
    expect(codes(cyc(lens2), [], withAge(30))).toEqual(['variability']);
    expect(codes(cyc(lens2), [], withAge(22))).toEqual([]);
    expect(codes(cyc(lens2), [], withAge(43))).toEqual([]);
  });
  it('needs six valid cycles', () => expect(codes(cyc([24, 38, 31, 45, 27]))).toEqual([]));
  it('a probable missed log (suspect_skip) does not drive it (fixture B)', () => expect(codes(cyc([27, 29, 56, 28, 30, 28]))).toEqual([]));
  it('post-contraception warm-up cycles are excluded', () => {
    const h = historyFromLengths([24, 38, 31, 45, 27, 36]);
    const s: EngineSettings = { ...FIXTURE_SETTINGS, lifeStates: [{ kind: 'post_contraception', stopped: h.cycles[0]?.start as string, method: 'pill', until: LAST_START }] };
    expect(codes(cyc([24, 38, 31, 45, 27, 36], s), [], s)).toEqual([]);
  });
});

describe('bleeding flags (ER-36)', () => {
  const periodDays = (c: CycleRecord, flow: DailyLog['flow'], n: number, extra: Partial<DailyLog> = {}): DailyLog[] =>
    Array.from({ length: n }, (_, i) => ({ date: addDays(c.start, i), flow, flowKind: 'period' as const, ...extra }));
  it('heavy on >= 3 days in two periods running', () => {
    const c = cyc([28, 30, 29]);
    const logs = [...periodDays(c[3] as CycleRecord, 'heavy', 3), ...periodDays(c[2] as CycleRecord, 'heavy', 3)];
    expect(codes(c, logs)).toEqual(['heavy']);
    expect(codes(c, logs.slice(1))).toEqual([]); // only 2 heavy days in one of them
  });
  it('clots in two periods in a row', () => {
    const c = cyc([28, 30, 29]);
    const logs = [{ ...periodDays(c[3] as CycleRecord, 'medium', 1)[0], clots: true }, { ...periodDays(c[2] as CycleRecord, 'medium', 1)[0], clots: true }] as DailyLog[];
    expect(codes(c, logs)).toEqual(['heavy']);
  });
  it('bleeding longer than 8 days in two consecutive periods', () => {
    const c = cyc([28, 30, 29]).map((x, i) => (i >= 2 ? { ...x, end: addDays(x.start, 9), bleedDays: 10 } : x));
    expect(codes(c)).toEqual(['prolonged']);
    const one = cyc([28, 30, 29]).map((x, i) => (i === 3 ? { ...x, end: addDays(x.start, 9), bleedDays: 10 } : x));
    expect(codes(one)).toEqual([]);
  });
  it('bleeding between periods in 2 of the last 3 cycles', () => {
    const c = cyc([28, 30, 29]);
    const inter = (cy: CycleRecord): DailyLog => ({ date: addDays(cy.start, 14), flow: 'spotting', flowKind: 'intermenstrual' });
    expect(codes(c, [inter(c[1] as CycleRecord), inter(c[2] as CycleRecord)])).toEqual(['intermenstrual']);
    expect(codes(c, [inter(c[2] as CycleRecord)])).toEqual([]);
  });
});

describe('missed period (ER-37)', () => {
  const open = (days: number, s = FIXTURE_SETTINGS, ctx = {}) => codes(cyc([28, 30, 29]), [], s, addDays(LAST_START, days), ctx);
  it('open cycle beyond max(90, upper95 + 14)', () => {
    expect(open(90, FIXTURE_SETTINGS, { upper95: 34 })).not.toContain('missed');
    expect(open(91, FIXTURE_SETTINGS, { upper95: 34 })).toContain('missed');
    expect(open(91, FIXTURE_SETTINGS, { upper95: 80 })).not.toContain('missed'); // 94 limit
    expect(open(95, FIXTURE_SETTINGS, { upper95: 80 })).toContain('missed');
  });
  it('from age 40 a 60-day gap raises the gentler flag', () => {
    expect(open(61, withAge(42), { upper95: 34 })).toEqual(['missedFrom40']);
    expect(open(61, withAge(35), { upper95: 34 })).toEqual([]);
  });
  it('suggests a pregnancy test when sex was logged since the last period', () => {
    const c = cyc([28, 30, 29]);
    const f = evaluateFlags(c, [{ date: addDays(LAST_START, 5), sex: { protected: false } }], FIXTURE_SETTINGS, addDays(LAST_START, 95), { upper95: 34 });
    expect(f.find((x) => x.code === 'missed')?.params.sexLogged).toBe(1);
    const g = evaluateFlags(c, [], FIXTURE_SETTINGS, addDays(LAST_START, 95), { upper95: 34 });
    expect(g.find((x) => x.code === 'missed')?.params.sexLogged).toBe(0);
  });
  it('no flags while estimates are suspended by a life state', () =>
    expect(open(120, FIXTURE_SETTINGS, { suspended: true, upper95: 34 })).toEqual([]));
});

describe('short luteal insight (ER-38, C-02)', () => {
  it('<= 9 d in 2 of 3 biomarker-dated cycles is an insight only', () => {
    const c = cyc([28, 30, 29]).map((x, i) => (i < 3 ? { ...x, ovulation: { point: addDays(x.start, (x.length as number) - 1 - ([9, 10, 8][i] as number)), sd: 1, basis: 'lh' as const } } : x));
    const f = evaluateFlags(c, [], FIXTURE_SETTINGS, TODAY);
    expect(f.map((x) => x.code)).toEqual(['shortLuteal']);
    expect(f[0]?.insightOnly).toBe(true);
  });
  it('10 days is not short', () => {
    const c = cyc([28, 30, 29]).map((x, i) => (i < 3 ? { ...x, ovulation: { point: addDays(x.start, (x.length as number) - 11), sd: 1, basis: 'lh' as const } } : x));
    expect(codes(c)).toEqual([]);
  });
});

describe('muting and the 90-day rate limit (ER-39)', () => {
  const c = cyc([24, 38, 31, 45, 27, 36]);
  it('a muted flag is hidden until the mute ends', () => {
    expect(codes(c, [], FIXTURE_SETTINGS, TODAY, { muted: [{ code: 'variability', until: addDays(TODAY, 30) }] })).toEqual([]);
    expect(codes(c, [], FIXTURE_SETTINGS, TODAY, { muted: [{ code: 'variability', until: addDays(TODAY, -1) }] })).toEqual(['variability']);
  });
  it('a new flag is raised today; the same condition keeps its raisedOn for 90 days', () => {
    expect(evaluateFlags(c, [], FIXTURE_SETTINGS, TODAY)[0]?.raisedOn).toBe(TODAY);
    const raised = addDays(TODAY, -40);
    expect(evaluateFlags(c, [], FIXTURE_SETTINGS, TODAY, { lastRaised: { variability: raised } })[0]?.raisedOn).toBe(raised);
    const old = addDays(TODAY, -FLAG_RATE_LIMIT_DAYS);
    expect(evaluateFlags(c, [], FIXTURE_SETTINGS, TODAY, { lastRaised: { variability: old } })[0]?.raisedOn).toBe(TODAY);
  });
});

describe('suspended and clean histories', () => {
  it('nothing for regular cycles (fixtures A, B, E)', () => {
    expect(codes(cyc([28, 30, 29]))).toEqual([]);
    expect(codes(cyc([31]))).toEqual([]);
    expect(codes([])).toEqual([]);
  });
  it('never names a condition: codes are generic', () =>
    expect(JSON.stringify(evaluateFlags(cyc([24, 38, 31, 45, 27, 36]), [], FIXTURE_SETTINGS, TODAY))).not.toMatch(/pcos|endometriosis|menopause/i));
});
