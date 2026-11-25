import en from '../../../../../copy/en-AU.json';
import { addDays, type CycleRecord, diffDays, type ISODate, type Prediction } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { GUIDANCE, GUIDE_PHASES, pausingStateKey, phaseOn, type PhaseOnInput, showSupplements } from './guidance';

const TODAY = '2026-10-14'; // cycle day 11 of the open cycle
const rec = (start: ISODate, nextStart?: ISODate, extra: Partial<CycleRecord> = {}): CycleRecord =>
  ({ id: start, start, quality: 'valid', ...(nextStart ? { nextStart, length: diffDays(nextStart, start) } : {}), ...extra }) as CycleRecord;
const CYCLES: CycleRecord[] = [
  rec('2026-08-08', '2026-09-05'), // 28 days, bleed end not logged
  rec('2026-09-05', '2026-10-04', { end: '2026-09-08' }), // 29 days, no biomarker
  rec('2026-10-04', undefined, { end: '2026-10-07' }), // open
];
const pred = (over: Partial<Prediction> = {}): Prediction => ({
  engineVersion: 'test', asOf: TODAY, flags: [], cycleQuality: [],
  cycleLength: { mean: 28.5, sd: 2, nu: 5, scale: 2, nCyclesUsed: 2 },
  nextPeriod: { point: '2026-11-01', i80: { lo: '2026-10-30', hi: '2026-11-03' }, i95: { lo: '2026-10-28', hi: '2026-11-05' }, confidence: 'medium', daysOfDataUsed: 60 },
  ovulation: { point: '2026-10-19', i80: { lo: '2026-10-15', hi: '2026-10-23' }, sd: 3, confidence: 'low', basis: 'calendar' },
  currentPhase: { phase: 'follicular', dayOfCycle: 11 },
  ...over,
}) as Prediction;
const on = (date: ISODate, over: Partial<PhaseOnInput> = {}) =>
  phaseOn({ date, today: TODAY, prediction: pred(), cycles: CYCLES, showEstimate: true, ...over });

describe('phaseOn, open cycle', () => {
  it('says menstrual through the estimated period end, matching currentPhase', () => {
    const prediction = pred({ asOf: '2026-11-03', currentPhase: { phase: 'menstrual', dayOfCycle: 4 },
      currentBleed: { point: '2026-11-04', i80: { lo: '2026-11-03', hi: '2026-11-06' }, confidence: 'low' } });
    const cycles = [rec('2026-10-31', undefined, { end: '2026-11-02' })];
    for (const date of ['2026-11-03', '2026-11-04']) {
      expect(on(date, { today: '2026-11-03', prediction, cycles })).toMatchObject({ phase: prediction.currentPhase!.phase, expected: date > '2026-11-03' });
    }
    // the day after the estimated end (currentBleed.point) leaves menstrual; here it is past nextPeriod.i80.hi (11-03), so no card
    expect(on('2026-11-05', { today: '2026-11-03', prediction, cycles })).toBeUndefined();
    expect(on('2026-11-03', { prediction, cycles: [rec('2026-10-31', '2026-11-28', { end: '2026-11-02' })] })?.phase).not.toBe('menstrual');
  });
  it('today, cycle day 11, is follicular', () => expect(on(TODAY)).toMatchObject({ phase: 'follicular', expected: false }));
  it('a logged bleeding day is menstrual', () => expect(on('2026-10-05')?.phase).toBe('menstrual'));
  it('ovulation day and one day either side are ovulatory, and future days are expected', () => {
    expect(on('2026-10-17')?.phase).toBe('follicular');
    for (const d of ['2026-10-18', '2026-10-19', '2026-10-20']) expect(on(d)).toMatchObject({ phase: 'ovulatory', expected: true });
    expect(on('2026-10-21')?.phase).toBe('luteal');
  });
  it('the 5 days before the most likely next start are premenstrual', () => {
    expect(on('2026-10-26')?.phase).toBe('luteal');
    expect(on('2026-10-27')?.phase).toBe('premenstrual');
  });
  it('a future day inside the 80% period range is an expected period day', () =>
    expect(on('2026-10-31')).toMatchObject({ phase: 'menstrual', expected: true }));
  it('a future day past the 80% range gets no card', () => expect(on('2026-11-04')).toBeUndefined());
  it('late: today past the 80% range gives general', () =>
    expect(on('2026-11-05', { today: '2026-11-05' })).toMatchObject({ phase: 'general', expected: false, reason: { kind: 'late', by: '2026-11-03' } }));
  it('a hidden estimate (teen mode) folds ovulatory into follicular or luteal', () => {
    expect(on('2026-10-18', { showEstimate: false })?.phase).toBe('follicular');
    expect(on('2026-10-19', { showEstimate: false })?.phase).toBe('luteal');
    for (let i = 0; i < 40; i++) {
      const d = new Date(Date.UTC(2026, 9, 4 + i)).toISOString().slice(0, 10);
      expect(on(d, { showEstimate: false })?.phase).not.toBe('ovulatory');
    }
  });
  const WIDE = pred({ ovulation: { point: '2026-10-18', i80: { lo: '2026-10-11', hi: '2026-10-24' }, sd: 5.2, confidence: 'low', basis: 'calendar' } });
  it('a wide estimate places days before its range as follicular and after it as luteal; inside the range is general with reason wide (D-162)', () => {
    expect(on('2026-10-10', { prediction: WIDE })).toMatchObject({ phase: 'follicular' });
    expect(on('2026-10-10', { prediction: WIDE })?.reason).toBeUndefined();
    expect(on('2026-10-11', { prediction: WIDE })).toMatchObject({ phase: 'general', reason: { kind: 'wide', width: 14, n: 2, min: 28, max: 29 } });
    expect(on('2026-10-24', { prediction: WIDE })?.phase).toBe('general');
    expect(on('2026-10-25', { prediction: WIDE })?.phase).toBe('luteal');
    expect(on('2026-10-27', { prediction: WIDE })?.phase).toBe('premenstrual');
    for (const d of ['2026-10-17', '2026-10-18', '2026-10-19']) expect(on(d, { prediction: WIDE })?.phase).toBe('general');
  });
  it('a wide range never overrides bleeding, premenstrual or expected period days', () => {
    const early = pred({ ovulation: { point: '2026-10-17', i80: { lo: '2026-10-05', hi: '2026-10-30' }, sd: 9, confidence: 'low', basis: 'calendar' } });
    expect(on('2026-10-05', { prediction: early })?.phase).toBe('menstrual');
    expect(on('2026-10-28', { prediction: early })?.phase).toBe('premenstrual');
    expect(on('2026-10-31', { prediction: early })).toMatchObject({ phase: 'menstrual', expected: true });
  });
  it('estimate switched off (teen mode): the same placement around a wide range, never ovulatory', () => {
    expect(on('2026-10-10', { prediction: WIDE, showEstimate: false })?.phase).toBe('follicular');
    expect(on('2026-10-25', { prediction: WIDE, showEstimate: false })?.phase).toBe('luteal');
  });
  it('wide with fewer than two valid closed cycles carries no count, shortest or longest', () =>
    expect(on('2026-10-15', { prediction: WIDE, cycles: [rec('2026-10-04', undefined, { end: '2026-10-07' })] })?.reason).toEqual({ kind: 'wide', width: 14 }));
  it('no ovulation estimate gives general with reason paused', () => {
    const { ovulation: _o, ...rest } = pred();
    expect(on(TODAY, { prediction: rest as Prediction })).toMatchObject({ phase: 'general', reason: { kind: 'paused', on: TODAY } });
  });
});

describe('phaseOn, past cycles', () => {
  it('counts back the luteal prior from the next start when there is no biomarker (29 d cycle: ovulation offset 16)', () => {
    expect(on('2026-09-19')?.phase).toBe('follicular');
    expect(on('2026-09-21')).toMatchObject({ phase: 'ovulatory', expected: false });
    expect(on('2026-09-23')?.phase).toBe('luteal');
    expect(on('2026-09-28')?.phase).toBe('luteal');
    expect(on('2026-09-29')?.phase).toBe('premenstrual');
  });
  it('uses a biomarker ovulation when the cycle has one', () => {
    const cycles = [CYCLES[0]!, { ...CYCLES[1]!, ovulation: { point: '2026-09-18', offset: 13, sd: 1, basis: 'lh' as const } }, CYCLES[2]!];
    expect(on('2026-09-18', { cycles })?.phase).toBe('ovulatory');
    expect(on('2026-09-21', { cycles })?.phase).toBe('luteal');
  });
  it('an unlogged bleed end counts as 5 days', () => {
    expect(on('2026-08-12')?.phase).toBe('menstrual');
    expect(on('2026-08-13')?.phase).not.toBe('menstrual');
  });
  it('a merged cycle (suspect_skip) gives general, a life-state cycle gives no card', () => {
    const skip = [{ ...CYCLES[0]!, quality: 'suspect_skip' as const }, CYCLES[1]!, CYCLES[2]!];
    expect(on('2026-08-25', { cycles: skip })).toMatchObject({ phase: 'general', reason: { kind: 'setAside', quality: 'suspect_skip' } });
    const life = [{ ...CYCLES[0]!, quality: 'life_state' as const }, CYCLES[1]!, CYCLES[2]!];
    expect(on('2026-08-09', { cycles: life })).toBeUndefined();
  });
});

describe('the cycle frame (D-155)', () => {
  it('an open cycle: its length is the days to the likely next period, its ovulation day and range are the forecast', () => {
    expect(on(TODAY)?.frame).toEqual({ day: 10, length: 28, bleedDays: 4, ovulationDay: 15, ovulationRange: { lo: 11, hi: 19 } });
  });
  it('a closed cycle: logged length, the luteal prior counted back from the next start, bleed from the logged end', () => {
    expect(on('2026-09-21')?.frame).toEqual({ day: 16, length: 29, bleedDays: 4, ovulationDay: 16 });
  });
  it('a biomarker ovulation is the frame\'s ovulation day', () => {
    const cycles = [CYCLES[0]!, { ...CYCLES[1]!, ovulation: { point: '2026-09-18', offset: 13, sd: 1, basis: 'lh' as const } }, CYCLES[2]!];
    expect(on('2026-09-18', { cycles })?.frame?.ovulationDay).toBe(13);
  });
  it('no ovulation day while the estimate is uncertain, and none for a merged cycle', () => {
    const wide = pred({ ovulation: { point: '2026-10-19', i80: { lo: '2026-10-05', hi: '2026-11-02' }, sd: 9, confidence: 'low', basis: 'calendar' } as Prediction['ovulation'] });
    expect(on('2026-10-05', { prediction: wide })?.frame?.ovulationDay).toBeUndefined();
    const skip = [{ ...CYCLES[0]!, quality: 'suspect_skip' as const }, CYCLES[1]!, CYCLES[2]!];
    expect(on('2026-08-25', { cycles: skip })?.frame?.ovulationDay).toBeUndefined();
  });
  it('agrees with the phase: the ovulatory days are the frame\'s ovulation day and one either side', () => {
    for (let i = 0; i < 28; i++) {
      const d = addDays('2026-10-04', i);
      const g = on(d);
      if (!g?.frame || g.frame.ovulationDay === undefined) continue;
      expect(g.phase === 'ovulatory', d).toBe(Math.abs(g.frame.day - g.frame.ovulationDay) <= 1 && g.frame.day > g.frame.bleedDays - 1);
    }
  });
});

describe('phaseOn, no card', () => {
  it('while prediction is suspended, even on a period day', () =>
    expect(on('2026-10-05', { prediction: pred({ suspended: { reason: 'pregnant' } }) })).toBeUndefined());
  it('with no prediction', () => expect(on(TODAY, { prediction: undefined })).toBeUndefined());
  it('before the first logged period', () => expect(on('2026-08-01')).toBeUndefined());
  it('does not depend on the order of the cycle records', () =>
    expect(on('2026-09-29', { cycles: [...CYCLES].reverse() })?.phase).toBe('premenstrual'));
});

describe('foods', () => {
  it('several foods per phase, as the owner listed them (message 5)', () => {
    const ids = (p: keyof typeof GUIDANCE) => GUIDANCE[p].foods.map((f) => f.id);
    expect(ids('menstrual')).toEqual(['iron', 'omega3']);
    expect(ids('follicular')).toEqual(['vitaminC', 'bVitamins', 'zinc']);
    expect(ids('ovulatory')).toEqual(['fibre', 'vitaminDB6']);
    expect(ids('luteal')).toEqual(['protein', 'magnesium', 'b12']);
    expect(ids('premenstrual')).toEqual(['calcium', 'carbs']);
    expect(ids('general')).toEqual(['iron', 'calcium']);
  });
  it('only iron and vitamin C are graded strong; fibre is early because the one cohort found lower hormones', () => {
    const all = Object.values(GUIDANCE).flatMap((g) => g.foods);
    expect([...new Set(all.filter((f) => f.evidence === 'strong').map((f) => f.id))].sort()).toEqual(['iron', 'vitaminC']);
    expect(GUIDANCE.ovulatory.foods.find((f) => f.id === 'fibre')?.evidence).toBe('early');
  });
});

describe('supplements', () => {
  it('ginger, omega-3 and zinc for the period; calcium, B6 and magnesium before it; none elsewhere', () => {
    expect(GUIDANCE.menstrual.supps.map((s) => s.id)).toEqual(['ginger', 'omega3', 'zinc']);
    expect(GUIDANCE.premenstrual.supps.map((s) => s.id)).toEqual(['calcium', 'b6', 'magnesium']);
    for (const p of ['follicular', 'ovulatory', 'luteal', 'general'] as const) expect(GUIDANCE[p].supps).toEqual([]);
  });
  it('no supplement is graded strong, and B6 and magnesium are early', () => {
    const all = Object.values(GUIDANCE).flatMap((g) => g.supps);
    expect(all.filter((s) => s.evidence === 'strong')).toEqual([]);
    expect(all.filter((s) => s.id === 'b6' || s.id === 'magnesium').map((s) => s.evidence)).toEqual(['early', 'early']);
  });
  it('are hidden for under-18s and shown to adults', () => {
    expect(showSupplements(true)).toBe(false);
    expect(showSupplements(false)).toBe(true);
  });
});

const get = (path: string): unknown => path.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown> | undefined)?.[k], en);
const allStrings = (n: unknown): string[] => (typeof n === 'string' ? [n] : n && typeof n === 'object' ? Object.values(n).flatMap(allStrings) : []);

describe('guidance copy', () => {
  it('every phase has body, sources and movement; every food, supplement and grade has its words', () => {
    for (const ph of GUIDE_PHASES) {
      for (const k of ['body', 'sources', 'move.tip', 'move.why']) expect(get(`guidance.${ph}.${k}`), `${ph}.${k}`).toMatch(/\S/);
      expect(get(`guidance.phase.${ph}`)).toMatch(/\S/);
      expect(get(`guidance.phaseIn.${ph}`)).toMatch(/\S/);
      const g = GUIDANCE[ph];
      for (const e of [g.move, ...g.foods.map((f) => f.evidence), ...g.supps.map((s) => s.evidence)]) expect(get(`guidance.evidence.${e}`)).toMatch(/\S/);
      for (const f of g.foods) for (const k of ['tip', 'why']) expect(get(`guidance.food.${f.id}.${k}`), `food.${f.id}.${k}`).toMatch(/\S/);
      for (const s of g.supps) for (const k of ['tip', 'why']) expect(get(`guidance.supp.${s.id}.${k}`), `supp.${s.id}.${k}`).toMatch(/\S/);
    }
  });
  it('every food note names example foods and an example meal or snack (owner, message 5)', () => {
    for (const id of Object.keys(get('guidance.food') as object)) expect(get(`guidance.food.${id}.tip`), id).toMatch(/for example/i);
  });
  it('names no calorie, weight, fast, cleanse, restriction or cure (D-107)', () => {
    const banned = /calori|kilojoule|\bkJ\b|\bweight\b|detox|cleanse|fasting|restrict|cut out|\bburn\b|\bcures?\b/i;
    expect(allStrings(get('guidance')).filter((s) => banned.test(s))).toEqual([]);
  });
  it('the B6 note carries the nerve warning wherever it shows', () => {
    expect(get('guidance.supp.b6.tip')).toMatch(/tingling, burning or numbness/);
  });
});

describe('guidance summaries (calendar card)', () => {
  it('every phase has a brief food line and a brief movement line, and the card says "Read more"', () => {
    for (const ph of GUIDE_PHASES) {
      for (const k of ['food', 'move']) {
        const s = get(`guidance.summary.${ph}.${k}`) as string;
        expect(s, `${ph}.${k}`).toMatch(/\S/);
        expect(s.length, `${ph}.${k}`).toBeLessThanOrEqual(110);
      }
    }
    expect(get('guidance.readMore')).toBe('Read more');
  });
});

describe('pausingStateKey (D-162)', () => {
  it('names the life state that stops the ovulation estimate', () => {
    const on = '2026-10-14';
    expect(pausingStateKey([{ kind: 'hormonal_contraception', method: 'hormonal_iud', since: '2026-01-01' }], on)).toBe('settings.lifeState.methods.hormonal_iud');
    expect(pausingStateKey([{ kind: 'postpartum', delivered: '2026-01-01', breastfeeding: true }], on)).toBe('settings.lifeState.breastfeeding');
    expect(pausingStateKey([{ kind: 'postpartum', delivered: '2026-01-01', breastfeeding: false }], on)).toBeUndefined();
    expect(pausingStateKey([{ kind: 'perimenopause', since: '2026-01-01' }], on)).toBeUndefined(); // never named in a sentence (§2.3 list)
    expect(pausingStateKey([], on)).toBeUndefined();
  });
  it('an ended state is not named: an IUD that ended before a later state', () => {
    const iud = { kind: 'hormonal_contraception' as const, method: 'hormonal_iud' as const, since: '2022-01-01', until: '2024-01-01' };
    expect(pausingStateKey([iud, { kind: 'perimenopause', since: '2026-01-01' }], '2026-10-14')).toBeUndefined();
    expect(pausingStateKey([iud], '2023-06-01')).toBe('settings.lifeState.methods.hormonal_iud');
    expect(pausingStateKey([{ kind: 'hormonal_contraception', method: 'hormonal_iud', since: '2026-11-01' }], '2026-10-14')).toBeUndefined();
  });
});
