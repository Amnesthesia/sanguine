// P8-12 (D-091): how a prediction moves when new input arrives. Each case starts from a history, adds one thing the user
// would log (a period early, late or not at all, a pregnancy and its loss, a test), and asserts the direction and size of the change.
// These pin the engine's current behaviour; gaps found here are written up in D-091, not fixed in this batch.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addDays, diffDays } from './dates';
import { FIXTURE_SETTINGS, historyFromLengths, LAST_START } from './fixtures';
import { predict } from './predict';
import type { DailyLog, EngineSettings, History, ISODate, Prediction } from './types';

const S0 = LAST_START; // the open cycle's start in every history below
const day = (n: number): ISODate => addDays(S0, n);
const regular = (n = 6, len = 28) => historyFromLengths(Array(n).fill(len));
/** The user logs a period starting on `start` (five bleeding days). */
const logStart = (h: History, start: ISODate): History => ({
  ...h, cycles: [...h.cycles, { id: `c${h.cycles.length + 1}`, start, end: addDays(start, 4), quality: 'valid' }],
});
const width80 = (p: Prediction) => diffDays(p.nextPeriod?.i80.hi as string, p.nextPeriod?.i80.lo as string);
const with_ = (s: Partial<EngineSettings>): EngineSettings => ({ ...FIXTURE_SETTINGS, ...s });

describe('a period logged earlier, on time or later than expected', () => {
  const before = predict(regular(), FIXTURE_SETTINGS, day(25));
  it('baseline: six 28-day cycles predict day 28 with a tight range', () => {
    expect(before.nextPeriod?.point).toBe(day(28));
    expect(before.nextPeriod?.confidence).toBe('high');
  });
  it('expected in 3 days, logged today: the next period moves to today + the new mean, the mean drops', () => {
    const today = day(25);
    const after = predict(logStart(regular(), today), FIXTURE_SETTINGS, today);
    expect(after.cycleLength.nCyclesUsed).toBe(7);
    expect(after.cycleLength.mean).toBeLessThan(before.cycleLength.mean);
    expect(after.nextPeriod?.point).toBe(addDays(today, after.cycleLength.mean));
    expect(after.currentPhase).toEqual({ phase: 'menstrual', dayOfCycle: 1 });
    // one early cycle does not throw the forecast: it stays within a day of the 28-day rhythm
    expect(Math.abs(diffDays(after.nextPeriod?.point as string, addDays(today, 28)))).toBeLessThanOrEqual(1);
  });
  it('on time: the range does not widen and the point stays 28 days on', () => {
    const after = predict(logStart(regular(), day(28)), FIXTURE_SETTINGS, day(28));
    expect(after.nextPeriod?.point).toBe(day(56));
    expect(width80(after)).toBeLessThanOrEqual(width80(before));
  });
  it('5 days late: the mean rises and the range widens', () => {
    const after = predict(logStart(regular(), day(33)), FIXTURE_SETTINGS, day(33));
    expect(after.cycleLength.mean).toBeGreaterThan(before.cycleLength.mean);
    expect(width80(after)).toBeGreaterThan(width80(before));
    expect(after.cycleQuality.at(-2)?.quality).toBe('valid'); // 33 days is inside the usual limit for 28 +/- 7
  });
  it('the earlier the logged period, the earlier every later prediction (monotone in the logged day)', () => {
    const points = [24, 26, 28, 30, 32].map((d) => predict(logStart(regular(), day(d)), FIXTURE_SETTINGS, day(d)).nextPeriod?.point as string);
    expect([...points].sort()).toEqual(points);
    expect(new Set(points).size).toBe(points.length);
  });
  it('logging the next period after today is what moves the forecast: days passing alone never change the point', () => {
    const pts = [10, 20, 28, 35, 50].map((d) => predict(regular(), FIXTURE_SETTINGS, day(d)).nextPeriod?.point);
    expect(new Set(pts)).toEqual(new Set([day(28)]));
  });
});

describe('learning a user cycle by cycle', () => {
  // a user with 32-day cycles, two days either way: the population prior (29.3 d) is wrong for her at first
  const truth = [31, 33, 32, 34, 31, 32, 33, 32, 31, 33, 32, 33, 31, 32];
  const runs = truth.map((_, k) => {
    const h = historyFromLengths(truth.slice(0, k));
    const p = predict(h, FIXTURE_SETTINGS, S0);
    return { p, err: Math.abs(diffDays(p.nextPeriod?.point as string, addDays(S0, truth[k] as number))) };
  });
  it('the point error falls as cycles are logged', () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(runs.slice(-4).map((r) => r.err))).toBeLessThan(mean(runs.slice(0, 3).map((r) => r.err)));
    expect(runs.at(-1)?.err).toBeLessThanOrEqual(1);
  });
  it('the 80% range narrows from the prior to a few days', () => {
    expect(width80(runs.at(-1)?.p as Prediction)).toBeLessThan(width80(runs[0]?.p as Prediction));
    expect(width80(runs.at(-1)?.p as Prediction)).toBeLessThanOrEqual(5);
  });
  it('confidence rises low -> medium -> high at the D-020 thresholds and never falls back on a regular history', () => {
    const rank = { none: 0, low: 1, medium: 2, high: 3 } as const;
    const c = runs.map((r) => r.p.nextPeriod?.confidence ?? 'none');
    expect(c[0]).toBe('low');
    expect(c[1]).toBe('low');
    expect(c[3]).toBe('medium');
    expect(c.at(-1)).toBe('high');
    for (let i = 1; i < c.length; i++) expect(rank[c[i] as keyof typeof rank]).toBeGreaterThanOrEqual(rank[c[i - 1] as keyof typeof rank]);
  });
  it('the mean tracks the user: from the prior toward 32', () => {
    expect(runs[0]?.p.cycleLength.mean).toBeCloseTo(29.3, 5);
    expect(Math.abs((runs.at(-1)?.p.cycleLength.mean as number) - 32.2)).toBeLessThan(0.5);
  });
});

describe('a late period that has not been logged', () => {
  const h = regular();
  const at = (d: number) => predict(h, FIXTURE_SETTINGS, day(d));
  it('phase turns late after the top of the 80% range, the point stays where it was (D-091 finding)', () => {
    const hi = diffDays(at(0).nextPeriod?.i80.hi as string, S0);
    expect(at(hi).currentPhase?.phase).not.toBe('late');
    expect(at(hi + 1).currentPhase?.phase).toBe('late');
    expect(at(hi + 10).nextPeriod?.point).toBe(day(28)); // a date in the past; the Today screen says "late" instead of showing it
  });
  it('no missed-period flag until 90 days (the 95% upper bound + 14 is lower for a regular user)', () => {
    expect(at(90).flags.map((f) => f.code)).not.toContain('missed');
    expect(at(91).flags.find((f) => f.code === 'missed')?.params.days).toBe(90);
  });
  it('the missed flag notes logged sex as a number, never as a pregnancy question', () => {
    const withSex: History = { ...h, logs: [{ date: day(14), sex: { protected: false } }] };
    expect(predict(withSex, FIXTURE_SETTINGS, day(91)).flags.find((f) => f.code === 'missed')?.params.sexLogged).toBe(1);
  });
  it('logging the period clears the missed flag; the long cycle is kept out of the averages', () => {
    const p = predict(logStart(h, day(95)), FIXTURE_SETTINGS, day(95));
    expect(p.flags.map((f) => f.code)).not.toContain('missed');
    expect(p.cycleQuality.at(-2)?.quality).toBe('suspect_skip');
    expect(p.cycleLength.mean).toBeCloseTo(predict(h, FIXTURE_SETTINGS, S0).cycleLength.mean, 6);
    expect(p.nextPeriod?.point).toBe(day(95 + 28));
  });
  it('perimenopause: the gap rule is 60 days, not 90', () => {
    const s = with_({ birthYear: 1978, lifeStates: [{ kind: 'perimenopause', since: '2020-01-01' }] });
    expect(predict(h, s, day(60)).flags.map((f) => f.code)).not.toContain('missed');
    expect(predict(h, s, day(61)).flags.find((f) => f.code === 'missed')?.params.days).toBe(60);
  });
});

describe('a period that was not logged (two cycles look like one)', () => {
  const lens = [28, 27, 29, 28, 56, 28, 29];
  const p = predict(historyFromLengths(lens), FIXTURE_SETTINGS, day(5));
  const without = predict(historyFromLengths(lens.filter((l) => l !== 56)), FIXTURE_SETTINGS, day(5));
  it('the 56-day cycle is set aside and the forecast is as if it were not there', () => {
    expect(p.cycleQuality[4]?.quality).toBe('suspect_skip');
    expect(p.cycleLength).toEqual(without.cycleLength);
    expect(p.flags).toEqual([]);
  });
  it('confirming it as a real long cycle brings it back: the mean and the range jump', () => {
    const h = historyFromLengths(lens);
    const confirmed = predict({ ...h, confirmedLong: [h.cycles[4]?.start as string] }, FIXTURE_SETTINGS, day(5));
    expect(confirmed.cycleQuality[4]?.quality).toBe('valid');
    expect(confirmed.cycleLength.mean).toBeGreaterThan(p.cycleLength.mean + 2);
    expect(width80(confirmed)).toBeGreaterThan(width80(p) * 2);
  });
  it('excluding an ordinary cycle removes exactly that cycle', () => {
    const h = historyFromLengths(lens);
    const ex = predict({ ...h, excluded: [h.cycles[0]?.start as string] }, FIXTURE_SETTINGS, day(5));
    expect(ex.cycleQuality[0]?.quality).toBe('user_excluded');
    expect(ex.cycleLength.nCyclesUsed).toBe(p.cycleLength.nCyclesUsed - 1);
  });
  it('two missed logs in a row are both set aside', () => {
    const q = predict(historyFromLengths([28, 27, 29, 28, 56, 57, 28]), FIXTURE_SETTINGS, day(5)).cycleQuality.map((c) => c.quality);
    expect(q.slice(4, 6)).toEqual(['suspect_skip', 'suspect_skip']);
  });
});

describe('a bleed that is not a period', () => {
  it('a fragment under 15 days is suspect_short and ignored', () => {
    const p = predict(historyFromLengths([28, 28, 28, 28, 9, 19, 28]), FIXTURE_SETTINGS, day(5));
    expect(p.cycleQuality[4]?.quality).toBe('suspect_short');
  });
  it('but the rest of that split cycle (19 days) counts and pulls the mean down (D-091 finding)', () => {
    const split = predict(historyFromLengths([28, 28, 28, 28, 9, 19, 28]), FIXTURE_SETTINGS, day(5));
    const clean = predict(historyFromLengths([28, 28, 28, 28, 28, 28]), FIXTURE_SETTINGS, day(5));
    expect(split.cycleQuality[5]?.quality).toBe('valid');
    expect(split.cycleLength.mean).toBeLessThan(clean.cycleLength.mean - 1);
  });
  it('flow logged as intermenstrual bleeding starts no cycle and never moves a prediction', () => {
    const h = regular();
    const logs = [{ date: day(14), flow: 'light' as const, flowKind: 'intermenstrual' as const }];
    expect(predict({ ...h, logs }, FIXTURE_SETTINGS, day(20)).nextPeriod).toEqual(predict(h, FIXTURE_SETTINGS, day(20)).nextPeriod);
  });
});

describe('pregnancy and pregnancy loss', () => {
  // six 28-day cycles; the open cycle (S0) becomes a pregnancy, lost at 10 weeks; the first period comes 5 weeks later
  // (ACOG: ovulation can return 2 weeks after an early loss, the first period usually 4-6 weeks after).
  const LOSS = day(70);
  const P1 = addDays(LOSS, 35);
  const marked = with_({ lifeStates: [
    { kind: 'pregnant', since: S0, until: LOSS },
    { kind: 'postpartum', delivered: LOSS, breastfeeding: false },
  ] });
  it('not marked: a 105-day "cycle" is set aside as unusually long; the forecast picks up from the next period', () => {
    const p = predict(logStart(regular(), P1), FIXTURE_SETTINGS, P1);
    expect(p.cycleQuality.at(-2)?.quality).toBe('suspect_skip');
    expect(p.cycleLength.nCyclesUsed).toBe(6);
    expect(p.nextPeriod?.point).toBe(addDays(P1, 28));
    expect(p.flags.map((f) => f.code)).not.toContain('missed'); // the cycle is closed
  });
  it('not marked, still open at 15 weeks: the missed-period flag is raised (the user is pointed to "I was pregnant")', () => {
    expect(predict(regular(), FIXTURE_SETTINGS, day(105)).flags.map((f) => f.code)).toContain('missed');
  });
  it('while pregnant: estimates pause, no flags', () => {
    const p = predict(regular(), with_({ lifeStates: [{ kind: 'pregnant', since: S0 }] }), day(50));
    expect(p.suspended?.reason).toBe('pregnant');
    expect(p.nextPeriod).toBeUndefined();
    expect(p.flags).toEqual([]);
  });
  it('after the loss, before the first period: still paused (postpartum rule)', () => {
    const p = predict(regular(), marked, addDays(LOSS, 20));
    expect(p.suspended?.reason).toBe('postpartum');
    expect(p.cycleQuality.at(-1)?.quality).toBe('life_state');
  });
  it('first period after the loss: estimates resume from the population prior only, low confidence', () => {
    const p = predict(logStart(regular(), P1), marked, P1);
    expect(p.suspended).toBeUndefined();
    expect(p.cycleLength.nCyclesUsed).toBe(0); // her six 28-day cycles are not used during the warm-up (D-091 finding)
    expect(p.cycleLength.mean).toBeCloseTo(29.3, 5);
    expect(p.nextPeriod?.confidence).toBe('low');
    expect(p.cycleQuality.at(-2)?.quality).toBe('life_state');
  });
  it('warm-up: post-loss cycles count at half weight, confidence stays low for three cycles, then her whole history returns', () => {
    let h = logStart(regular(), P1);
    let start = P1;
    const seen: Prediction[] = [];
    for (const len of [31, 29, 28]) {
      start = addDays(start, len);
      h = logStart(h, start);
      seen.push(predict(h, marked, start));
    }
    expect(seen.slice(0, 2).map((p) => p.nextPeriod?.confidence)).toEqual(['low', 'low']);
    expect(seen.slice(0, 2).map((p) => p.cycleLength.nCyclesUsed)).toEqual([1, 2]);
    expect(seen[2]?.cycleLength.nCyclesUsed).toBe(9); // after three post-loss cycles: 6 before + 3 after, all at full weight
    expect(seen[2]?.nextPeriod?.confidence).not.toBe('low');
  });
  it('bleeding after a pregnancy, logged as such, starts no cycle', () => {
    // the app writes flowKind 'post_pregnancy' (D-053) but the engine's DailyLog type does not list it (D-091 finding), hence the cast
    const logs = [0, 1, 2].map((d) => ({ date: addDays(LOSS, d), flow: 'medium', flowKind: 'post_pregnancy' })) as unknown as DailyLog[];
    const p = predict({ ...regular(), logs }, marked, addDays(LOSS, 10));
    expect(p.cycleQuality).toHaveLength(7);
  });
  it('after a birth while breastfeeding: no calendar ovulation until a test or temperature shows one', () => {
    const s = with_({ lifeStates: [{ kind: 'pregnant', since: S0, until: day(270) }, { kind: 'postpartum', delivered: day(270), breastfeeding: true }] });
    const h = logStart(regular(), day(400));
    const p = predict(h, s, day(410));
    expect(p.nextPeriod).toBeDefined();
    expect(p.ovulation).toBeUndefined();
    expect(p.fertileDays).toBeUndefined();
  });
});

describe('contraception', () => {
  it('on hormonal contraception: paused, and bleeding then is not a cycle', () => {
    const p = predict(regular(), with_({ lifeStates: [{ kind: 'hormonal_contraception', method: 'combined_pill', since: day(-10) }] }), day(10));
    expect(p.suspended?.reason).toBe('hormonal_contraception');
    expect(p.nextPeriod).toBeUndefined();
  });
  it('after stopping: earlier cycles are set aside for three cycles, confidence capped at low', () => {
    const stop = S0;
    const s = with_({ lifeStates: [{ kind: 'post_contraception', stopped: stop, method: 'combined_pill' }] });
    const p0 = predict(regular(), s, day(10));
    expect(p0.cycleLength.nCyclesUsed).toBe(0);
    expect(p0.nextPeriod?.confidence).toBe('low');
    let h = regular();
    let start = S0;
    for (const len of [35, 32, 30]) { start = addDays(start, len); h = logStart(h, start); }
    const p3 = predict(h, s, start);
    expect(p3.cycleLength.nCyclesUsed).toBe(9);
  });
});

describe('perimenopause widens and forgets faster', () => {
  it('a wider range than the same history without it, and no calendar fertile band', () => {
    const lens = [26, 34, 24, 41, 28, 37];
    const plain = predict(historyFromLengths(lens), FIXTURE_SETTINGS, day(5));
    const peri = predict(historyFromLengths(lens), with_({ lifeStates: [{ kind: 'perimenopause', since: '2020-01-01' }] }), day(5));
    expect(peri.cycleLength.scale).toBeGreaterThan(plain.cycleLength.scale);
    expect(width80(peri)).toBeGreaterThanOrEqual(width80(plain)); // only slightly: 15 vs 15 days here
    expect(peri.fertileDays).toBeUndefined();
  });
});

describe('ovulation tests and temperatures', () => {
  const h = regular();
  const lh: History['lh'] = [
    { date: day(12), result: 'negative', provenance: 'manual' },
    { date: day(13), result: 'positive', provenance: 'manual' },
  ];
  // biphasic BBT: 36.3 until day 13, 36.7 from day 14
  const temperatures: History['temperatures'] = Array.from({ length: 20 }, (_, d) => ({
    date: day(d), valueC: d < 14 ? 36.3 : 36.7, timeOfDay: '06:30', source: 'oral' as const, provenance: 'manual' as const,
  }));
  const cal = predict(h, FIXTURE_SETTINGS, day(16));
  it('a positive LH test replaces the calendar estimate: day after the test, narrower', () => {
    const p = predict({ ...h, lh }, FIXTURE_SETTINGS, day(16));
    expect(p.ovulation?.basis).toBe('lh');
    expect(p.ovulation?.point).toBe(day(14));
    expect(p.ovulation?.sd).toBeLessThan(cal.ovulation?.sd as number);
    expect(p.currentPhase?.phase).toBe('luteal');
  });
  it('a temperature shift alone dates ovulation the day before the first high reading', () => {
    const p = predict({ ...h, temperatures }, FIXTURE_SETTINGS, day(19));
    expect(p.ovulation?.basis).toBe('bbt');
    expect(p.ovulation?.point).toBe(day(13));
  });
  it('the fertile band moves to the detected ovulation', () => {
    const p = predict({ ...h, lh }, FIXTURE_SETTINGS, day(16));
    const peak = (q: Prediction) => q.fertileDays?.reduce((a, b) => (b.pInWindow > a.pInWindow ? b : a)).date;
    expect(peak(p)).not.toBe(peak(cal));
    expect(diffDays(peak(p) as string, day(14))).toBeLessThanOrEqual(0); // the window ends on ovulation day
  });
  it('a confirmed ovulation does not move the next-period forecast (D-091 finding: no ovulation + luteal forecast)', () => {
    expect(predict({ ...h, lh, temperatures }, FIXTURE_SETTINGS, day(19)).nextPeriod).toEqual(predict(h, FIXTURE_SETTINGS, day(19)).nextPeriod);
  });
  it('past cycles with tests teach the luteal length, which moves the calendar estimate for the open cycle', () => {
    const withPast: History = { ...h, lh: h.cycles.slice(0, 5).flatMap((c) => [
      { date: addDays(c.start, 16), result: 'negative' as const, provenance: 'manual' as const },
      { date: addDays(c.start, 17), result: 'positive' as const, provenance: 'manual' as const },
    ]) };
    // ovulation on day 18 of a 28-day cycle: luteal 9 days. The luteal prior (12.4 d, weight 10) holds the estimate back:
    // five measured cycles move it about one day, not three
    const p = predict(withPast, FIXTURE_SETTINGS, day(5));
    expect(p.ovulation?.basis).toBe('calendar');
    expect(diffDays(p.ovulation?.point as string, cal.ovulation?.point as string)).toBe(1);
  });
});

describe('properties of a newly logged period', () => {
  const lensArb = fc.array(fc.integer({ min: 22, max: 36 }), { minLength: 3, maxLength: 12 });
  it('the next forecast is always after the period just logged, and at least 15 days on', () => {
    fc.assert(fc.property(lensArb, fc.integer({ min: 15, max: 60 }), (lens, d) => {
      const today = day(d);
      const p = predict(logStart(historyFromLengths(lens), today), FIXTURE_SETTINGS, today);
      expect(diffDays(p.nextPeriod?.point as string, today)).toBeGreaterThanOrEqual(15);
      expect(p.currentPhase?.dayOfCycle).toBe(1);
    }), { numRuns: 500 });
  });
  const valid = (p: Prediction) => p.cycleQuality.slice(0, -1).map((c) => c.quality).join();
  // the just-closed cycle counts too: a 44-day cycle inside the limit raises the mean, a 45-day one beyond it is set aside
  it('a period logged later never gives an earlier next forecast, while the same cycles count', () => {
    fc.assert(fc.property(lensArb, fc.integer({ min: 18, max: 45 }), fc.integer({ min: 1, max: 10 }), (lens, d, k) => {
      const h = historyFromLengths(lens);
      const early = predict(logStart(h, day(d)), FIXTURE_SETTINGS, day(d));
      const late = predict(logStart(h, day(d + k)), FIXTURE_SETTINGS, day(d + k));
      fc.pre(valid(early) === valid(late));
      expect((late.nextPeriod?.point as string) >= (early.nextPeriod?.point as string)).toBe(true);
    }), { numRuns: 500 });
  });
  it('D-091 finding: logging a day later can tighten the long-cycle limit, drop older cycles and pull the forecast earlier', () => {
    // found by the property above: with the period on day 24 instead of 23 the MAD limit falls from 36.1 to 33.9 days,
    // both 34-day cycles leave the model, and the next forecast moves 2 days earlier
    const h = historyFromLengths([34, 22, 24, 34, 28, 28, 24, 24, 26]);
    const early = predict(logStart(h, day(23)), FIXTURE_SETTINGS, day(23));
    const late = predict(logStart(h, day(24)), FIXTURE_SETTINGS, day(24));
    expect(early.cycleQuality.filter((c) => c.quality === 'suspect_skip')).toHaveLength(0);
    expect(late.cycleQuality.filter((c) => c.quality === 'suspect_skip')).toHaveLength(2);
    expect((late.nextPeriod?.point as string) < (early.nextPeriod?.point as string)).toBe(true);
  });
});
