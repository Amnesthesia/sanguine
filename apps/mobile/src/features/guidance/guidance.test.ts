import en from '../../../../../copy/en-AU.json';
import { type CycleRecord, diffDays, type ISODate, type Prediction } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { GUIDANCE, GUIDE_PHASES, phaseOn, type PhaseOnInput, showSupplements } from './guidance';

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
  it('today, cycle day 11, is follicular', () => expect(on(TODAY)).toEqual({ phase: 'follicular', expected: false }));
  it('a logged bleeding day is menstrual', () => expect(on('2026-10-05')?.phase).toBe('menstrual'));
  it('ovulation day and one day either side are ovulatory, and future days are expected', () => {
    expect(on('2026-10-17')?.phase).toBe('follicular');
    for (const d of ['2026-10-18', '2026-10-19', '2026-10-20']) expect(on(d)).toEqual({ phase: 'ovulatory', expected: true });
    expect(on('2026-10-21')?.phase).toBe('luteal');
  });
  it('the 5 days before the most likely next start are premenstrual', () => {
    expect(on('2026-10-26')?.phase).toBe('luteal');
    expect(on('2026-10-27')?.phase).toBe('premenstrual');
  });
  it('a future day inside the 80% period range is an expected period day', () =>
    expect(on('2026-10-31')).toEqual({ phase: 'menstrual', expected: true }));
  it('a future day past the 80% range gets no card', () => expect(on('2026-11-04')).toBeUndefined());
  it('late: today past the 80% range gives general', () =>
    expect(on('2026-11-05', { today: '2026-11-05' })).toEqual({ phase: 'general', expected: false }));
  it('a hidden estimate (teen mode) folds ovulatory into follicular or luteal', () => {
    expect(on('2026-10-18', { showEstimate: false })?.phase).toBe('follicular');
    expect(on('2026-10-19', { showEstimate: false })?.phase).toBe('luteal');
    for (let i = 0; i < 40; i++) {
      const d = new Date(Date.UTC(2026, 9, 4 + i)).toISOString().slice(0, 10);
      expect(on(d, { showEstimate: false })?.phase).not.toBe('ovulatory');
    }
  });
  it('uncertain ovulation gives general on non-period days and keeps period days', () => {
    const p = pred({ ovulation: { point: '2026-10-19', i80: { lo: '2026-10-08', hi: '2026-10-29' }, sd: 7, confidence: 'low', basis: 'calendar' } });
    expect(on(TODAY, { prediction: p })?.phase).toBe('general');
    expect(on('2026-10-05', { prediction: p })?.phase).toBe('menstrual');
    expect(on('2026-10-31', { prediction: p })).toEqual({ phase: 'menstrual', expected: true });
  });
  it('no ovulation estimate gives general', () => {
    const { ovulation: _o, ...rest } = pred();
    expect(on(TODAY, { prediction: rest as Prediction })?.phase).toBe('general');
  });
});

describe('phaseOn, past cycles', () => {
  it('counts back the luteal prior from the next start when there is no biomarker (29 d cycle: ovulation offset 16)', () => {
    expect(on('2026-09-19')?.phase).toBe('follicular');
    expect(on('2026-09-21')).toEqual({ phase: 'ovulatory', expected: false });
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
    expect(on('2026-08-25', { cycles: skip })?.phase).toBe('general');
    const life = [{ ...CYCLES[0]!, quality: 'life_state' as const }, CYCLES[1]!, CYCLES[2]!];
    expect(on('2026-08-09', { cycles: life })).toBeUndefined();
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

