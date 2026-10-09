import { type EngineSettings, type History, type ISODate, type Prediction, predict } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { addDays } from '@sanguine/engine';
import { buildToday, ringModel, SHOW_OVULATION_ESTIMATE } from './todayModel';

const S: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };
const start = '2026-10-01';
function hist(lengths: number[], last: ISODate = start, bleed = 4): History {
  const starts: ISODate[] = [last];
  for (let i = lengths.length - 1; i >= 0; i--) starts.unshift(addDays(starts[0] as ISODate, -(lengths[i] as number)));
  return { cycles: starts.map((s, i) => ({ id: `c${i}`, start: s, end: addDays(s, bleed), quality: 'valid' as const })), temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
}
const view = (h: History, today: ISODate, over: Partial<Parameters<typeof buildToday>[0]> = {}, s: EngineSettings = S) =>
  buildToday({ prediction: predict(h, s, today), hasCycles: h.cycles.length > 0, today, showEstimate: true, todayFlow: undefined, ...over });

describe('flag', () => {
  it('SHOW_OVULATION_ESTIMATE ships true (R-01)', () => expect(SHOW_OVULATION_ESTIMATE).toBe(true));
});

describe('headline states', () => {
  it('no period logged: empty state with the two fixed lines', () => {
    const v = view({ cycles: [], temperatures: [], lh: [], mucus: [], cervix: [], logs: [] }, '2026-10-10', { hasCycles: false });
    expect(v.state).toBe('empty');
    expect(v.headline.key).toBe('today.empty.title');
    expect(v.subtitle?.key).toBe('today.empty.body');
    expect(v.ring.kind).toBe('noData');
    expect(v.estimate).toBeUndefined();
  });
  it('period in progress: day number and logged flow', () => {
    const v = view(hist([28, 30, 29]), '2026-10-02', { todayFlow: 'medium' });
    expect(v.state).toBe('inProgress');
    expect(v.headline).toEqual({ key: 'today.periodInProgress', params: { day: 2 } });
    expect(v.subtitle).toEqual({ key: 'today.periodLogged', params: { flow: 'medium' } });
  });
  it('predicted: range in days until, most-likely date and a confidence word', () => {
    const v = view(hist([28, 30, 29]), '2026-10-10');
    expect(v.state).toBe('predicted');
    // A: next 27 Oct - 2 Nov, today 10 Oct -> 17 to 23 days
    expect(v.headline).toEqual({ key: 'today.periodLikely', params: { lo: 17, hi: 23 } });
    expect(v.subtitle).toEqual({ key: 'today.mostLikelyRange', params: { range: '27 Oct – 2 Nov', date: '30 Oct' } });
    expect(v.confidence).toBe('medium');
  });
  it('inside the 80% window the headline switches to "expected by"', () => {
    const v = view(hist([28, 30, 29]), '2026-10-29');
    expect(v.headline.key).toBe('today.periodExpectedBy');
    expect(v.headline.params).toEqual({ date: '2 Nov' });
  });
  it('after the window: later than usual, nothing to do yet', () => {
    const v = view(hist([28, 30, 29]), '2026-11-10');
    expect(v.state).toBe('late');
    expect(v.headline.key).toBe('today.periodLater');
    expect(v.subtitle).toEqual({ key: 'today.periodLateRange', params: { range: '27 Oct – 2 Nov' } });
  });
  it('suspended by a life state names the state and shows no ring phase', () => {
    const s: EngineSettings = { ...S, lifeStates: [{ kind: 'hormonal_contraception', method: 'combined_pill', since: start }] };
    const v = view(hist([28, 30, 29]), '2026-10-10', {}, s);
    expect(v.state).toBe('suspended');
    expect(v.headline).toEqual({ key: 'today.suspended', params: { stateKey: 'settings.lifeState.options.hormonal' } });
    expect(v.ring.kind).toBe('suspended');
    expect(v.estimate).toBeUndefined();
    expect(v.flags).toEqual([]);
  });
});

describe('estimate card (R-01, §2.3, §8.5)', () => {
  it('always carries the fixed wording parameters and never a single fertile day', () => {
    const v = view(hist([28, 30, 29]), '2026-10-10');
    expect(v.estimate?.legal.key).toBe('legal.estimateCard');
    expect(v.estimate?.legal.params).toMatchObject({ point: '18 Oct', lo: '13', hi: '23 Oct' });
    expect(v.estimate?.uncertain).toBe(true); // 10-day span > 6
    expect(v.estimate?.title).toEqual({ key: 'today.ovulationUncertainShort' }); // the dates appear once, in the fixed sentence
  });
  it('a precise (LH) estimate reads "estimated around" with a confidence word', () => {
    const h = hist([28, 30, 29]);
    h.lh = [{ date: '2026-10-13', result: 'negative', provenance: 'manual' }, { date: '2026-10-14', result: 'positive', provenance: 'manual' }];
    const v = view(h, '2026-10-15');
    expect(v.estimate?.uncertain).toBe(false);
    expect(v.estimate?.title).toEqual({ key: 'today.ovulationTitle', params: { confidence: 'confident' } });
    expect(v.estimate?.basisKey).toBe('today.estimateBasis.lh');
  });
  it('is expanded on days with a fertile-window probability of 0.2 or more, collapsed otherwise', () => {
    expect(view(hist([28, 30, 29]), '2026-10-10').estimate?.expanded).toBe(true); // day 9, p ~0.3
    expect(view(hist([28, 30, 29]), '2026-10-02').estimate?.expanded).toBe(false); // day 1
    expect(view(hist([28, 30, 29]), '2026-10-27').estimate?.expanded).toBe(false);
  });
  it('is hidden when the flag, the user preference or teen mode says so', () => {
    expect(view(hist([28, 30, 29]), '2026-10-10', { showEstimate: false }).estimate).toBeUndefined();
  });
  it('is hidden for perimenopause without biomarkers (no calendar band)', () => {
    const s: EngineSettings = { ...S, lifeStates: [{ kind: 'perimenopause', since: '2020-01-01' }] };
    expect(view(hist([28, 30, 29]), '2026-10-10', {}, s).estimate).toBeUndefined();
  });
});

describe('flags', () => {
  it('pass through as cards with their copy keys and parameters; insight-only flags are low prominence', () => {
    const v = view(hist([24, 38, 31, 45, 27, 36]), '2026-10-10');
    expect(v.flags).toEqual([{ code: 'variability', titleKey: 'flags.variability.title', body: { key: 'flags.variability.body', params: { days: 9, range: 21 } }, extraKey: undefined, insightOnly: false }]);
  });
  it('the missed-period flag adds the test suggestion only when sex was logged', () => {
    const base = hist([28, 30, 29]);
    const p = predict({ ...base, logs: [{ date: '2026-10-05', sex: { protected: false } }] }, S, '2027-01-15');
    const v = buildToday({ prediction: p, hasCycles: true, today: '2027-01-15', showEstimate: true, todayFlow: undefined });
    const f = v.flags.find((x) => x.code === 'missed');
    expect(f?.extraKey).toBe('flags.missed.pregnancyTest');
  });
});

describe('ring (§9.5)', () => {
  it('maps cycle days to angles around the circle from the top', () => {
    const r = ringModel({ cycleLength: 28, dayOfCycle: 11, bleedDays: 4, fertile: [], predicted: undefined, kind: 'cycle' });
    if (r.kind !== 'cycle') throw new Error('kind');
    expect(r.today.deg).toBeCloseTo(((11 - 0.5) / 28) * 360, 6);
    expect(r.period).toEqual({ from: 0, to: (4 / 28) * 360 });
  });
  it('fertile band opacity follows p, clamped to 0.1-1, one segment per day', () => {
    const r = ringModel({ cycleLength: 28, dayOfCycle: 11, bleedDays: 4, fertile: [{ day: 8, p: 0.05 }, { day: 14, p: 0.55 }, { day: 15, p: 1.4 }], predicted: undefined, kind: 'cycle' });
    if (r.kind !== 'cycle') throw new Error('kind');
    expect(r.fertile.map((f) => f.opacity)).toEqual([0.1, 0.55, 1]);
  });
  it('the ring is never a single highlighted fertile day for a real estimate', () => {
    const v = view(hist([28, 30, 29]), '2026-10-10');
    if (v.ring.kind !== 'cycle') throw new Error('kind');
    expect(v.ring.fertile.length).toBeGreaterThan(8);
  });
  it('predicted period is an arc over the 80% range and wraps nothing beyond one turn', () => {
    const v = view(hist([28, 30, 29]), '2026-10-10');
    if (v.ring.kind !== 'cycle') throw new Error('kind');
    expect(v.ring.predicted && v.ring.predicted.to > v.ring.predicted.from).toBe(true);
    expect(v.ring.predicted && v.ring.predicted.to <= 360).toBe(true);
  });
  it('late: the today tick stays on the circle', () => {
    const v = view(hist([28, 30, 29]), '2026-12-20');
    if (v.ring.kind !== 'cycle') throw new Error('kind');
    expect(v.ring.today.deg).toBeLessThanOrEqual(360);
  });
});

describe('prediction fixture sanity', () => {
  it('the engine output used above is typed Prediction', () => {
    const p: Prediction = predict(hist([28, 30, 29]), S, '2026-10-10');
    expect(p.nextPeriod?.point).toBe('2026-10-30');
  });
});
