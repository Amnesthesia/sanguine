import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { FIXTURE_SETTINGS, historyFromLengths } from './fixtures';
import { predict } from './predict';

const history = (bleeds: Array<number | undefined> = [5, 4], end: string | undefined = '2026-11-02') => {
  const h = historyFromLengths(bleeds.map(() => 28), '2026-10-31');
  h.cycles.forEach((c, i) => {
    const days = bleeds[i];
    if (i === bleeds.length) {
      if (end === undefined) delete c.end;
      else c.end = end;
    } else if (days === undefined) delete c.end;
    else c.end = addDays(c.start, days - 1);
  });
  return h;
};

describe('currentBleed', () => {
  it('estimates from her median bleed length', () => {
    const bleed = predict(history(), FIXTURE_SETTINGS, '2026-11-02').currentBleed;
    expect(bleed?.point).toBe('2026-11-04');
    expect(bleed?.i80).toEqual({ lo: '2026-11-03', hi: '2026-11-04' });
    expect(bleed?.confidence).toBe('low');
  });

  it('defaults to 5 days with fewer than two closed periods', () => {
    expect(predict(history([4]), FIXTURE_SETTINGS, '2026-11-02').currentBleed).toEqual({
      point: '2026-11-04', i80: { lo: '2026-11-03', hi: '2026-11-06' }, confidence: 'low',
    });
  });

  it('absent once the logged end reaches the estimate', () => {
    expect(predict(history([5, 4], '2026-11-04'), FIXTURE_SETTINGS, '2026-11-04').currentBleed).toBeUndefined();
  });

  it('drops currentBleed once today passes i80.hi', () => {
    expect(predict(history(), FIXTURE_SETTINGS, '2026-11-09').currentBleed).toBeUndefined();
  });

  it('a no-flow log after the last period day removes it', () => {
    const h = history();
    h.logs = [{ date: '2026-11-03', flow: 'none' }];
    expect(predict(h, FIXTURE_SETTINGS, '2026-11-03').currentBleed).toBeUndefined();
  });

  it('absent while suspended', () => {
    expect(predict(history(), { ...FIXTURE_SETTINGS, lifeStates: [{ kind: 'pregnant', since: '2026-11-01' }] }, '2026-11-02').currentBleed).toBeUndefined();
  });

  it('present with a hormonal IUD and capped at low', () => {
    const h = history([5, 5, 5, 5]);
    expect(predict(h, FIXTURE_SETTINGS, '2026-11-02').currentBleed?.confidence).toBe('medium');
    expect(predict(h, { ...FIXTURE_SETTINGS, lifeStates: [{ kind: 'hormonal_contraception', method: 'hormonal_iud', since: '2026-10-31' }] }, '2026-11-02').currentBleed).toEqual({
      point: '2026-11-04', i80: { lo: '2026-11-04', hi: '2026-11-04' }, confidence: 'low',
    });
  });

  it('ignores cycles without a bleed length', () => {
    const h = history([5, undefined, 4]);
    delete h.cycles[h.cycles.length - 1]?.end;
    expect(predict(h, FIXTURE_SETTINGS, '2026-11-02').currentBleed).toEqual({
      point: '2026-11-04', i80: { lo: '2026-11-03', hi: '2026-11-04' }, confidence: 'low',
    });
  });

  it('menstrual phase follows currentBleed', () => {
    const p = predict(history(), FIXTURE_SETTINGS, '2026-11-03');
    expect(p.currentBleed).toBeDefined();
    expect(p.currentPhase?.phase).toBe('menstrual');
  });

  it('uses only the last six valid closed cycles', () => {
    const h = history([12, 5, 5, 5, 5, 5, 5]);
    expect(predict(h, FIXTURE_SETTINGS, '2026-11-02').currentBleed).toEqual({
      point: '2026-11-04', i80: { lo: '2026-11-04', hi: '2026-11-04' }, confidence: 'medium',
    });
    h.excluded = h.cycles.slice(1, -1).map((c) => c.start);
    expect(predict(h, FIXTURE_SETTINGS, '2026-11-02').currentBleed?.confidence).toBe('low');
  });
});
