import { describe, expect, it } from 'vitest';
import { diffDays } from './dates';
import { FIXTURE_SETTINGS, historyFromLengths } from './fixtures';
import { pastOvulations } from './pastOvulation';
import { analyzeCycles } from './predict';

const history = () => historyFromLengths([28, 28], '2026-10-31');

describe('pastOvulations', () => {
  it('retrospective calendar estimate from the next start', () => {
    const rows = pastOvulations(history(), FIXTURE_SETTINGS);
    expect(rows).toHaveLength(2);
    const row = rows.find((r) => r.cycleStart === '2026-10-03');
    expect(row).toBeDefined();
    if (!row) throw new Error('missing retrospective estimate');
    expect(row.cycleId).toBe('c2');
    expect(Math.abs(diffDays(row.point, '2026-10-17'))).toBeLessThanOrEqual(1);
    expect(row.basis).toBe('calendar');
    expect(diffDays(row.i80.hi, row.i80.lo)).toBeLessThanOrEqual(9);
    expect(row.confidence).toBe('medium');
    expect(row.i80.lo <= row.point && row.point <= row.i80.hi).toBe(true);
  });

  it('uses the biomarker estimate when there is one', () => {
    const h = history();
    h.lh = [{ date: '2026-10-15', result: 'positive', provenance: 'manual' }];
    const estimate = analyzeCycles(h, FIXTURE_SETTINGS)[1]?.record.ovulation;
    const row = pastOvulations(h, FIXTURE_SETTINGS)[1];
    if (!row || !estimate) throw new Error('missing biomarker estimate');
    expect(row.basis).toBe('lh');
    expect(row.point).toBe(estimate.point);
    expect(row.confidence).toBe(estimate.confidence);
    expect(row.i80).toEqual({ lo: '2026-10-14', hi: '2026-10-18' });
  });

  it('no row for the open cycle', () => {
    expect(pastOvulations(history(), FIXTURE_SETTINGS).map((r) => r.cycleId)).toEqual(['c1', 'c2']);
    expect(pastOvulations(historyFromLengths([], '2026-10-03'), FIXTURE_SETTINGS)).toEqual([]);
  });

  it('no row for a non-valid cycle', () => {
    const h = history();
    h.excluded = ['2026-10-03'];
    expect(pastOvulations(h, FIXTURE_SETTINGS).map((r) => r.cycleId)).toEqual(['c1']);
    expect(pastOvulations(historyFromLengths([10], '2026-10-31'), FIXTURE_SETTINGS)).toEqual([]);
  });

  it('no row for a cycle overlapping a hormonal IUD state', () => {
    const settings = { ...FIXTURE_SETTINGS, lifeStates: [{ kind: 'hormonal_contraception' as const, method: 'hormonal_iud' as const, since: '2026-10-10', until: '2026-10-20' }] };
    expect(pastOvulations(history(), settings).map((r) => r.cycleId)).toEqual(['c1']);
  });

  it.each([
    ['pregnant', { kind: 'pregnant' as const, since: '2026-10-10' }],
    ['non-IUD hormonal contraception', { kind: 'hormonal_contraception' as const, method: 'pill' as const, since: '2026-10-10' }],
    ['postpartum before the first period', { kind: 'postpartum' as const, delivered: '2026-10-10', breastfeeding: false }],
  ])('a suspended state (%s) gives no row for a cycle it covers, and a cycle before it keeps its row', (_name, state) => {
    const settings = { ...FIXTURE_SETTINGS, lifeStates: [state] };
    expect(pastOvulations(history(), settings).map((r) => r.cycleId)).toEqual(['c1']);
    const biomarker = history();
    biomarker.lh = [{ date: '2026-10-15', result: 'positive', provenance: 'manual' }];
    expect(pastOvulations(biomarker, settings).map((r) => r.cycleId)).toEqual(['c1']);
  });

  it('does not write into CycleRecord.ovulation', () => {
    const h = history();
    const before = structuredClone(analyzeCycles(h, FIXTURE_SETTINGS));
    const input = structuredClone(h);
    pastOvulations(h, FIXTURE_SETTINGS);
    expect(analyzeCycles(h, FIXTURE_SETTINGS)).toEqual(before);
    expect(h).toEqual(input);
    expect(before.every(({ record }) => record.ovulation === undefined)).toBe(true);
  });
  it('perimenopause overlapping a cycle requires biomarkers even after the state ends', () => {
    const settings = { ...FIXTURE_SETTINGS, lifeStates: [{ kind: 'perimenopause' as const, since: '2026-10-10', until: '2026-10-20' }] };
    expect(pastOvulations(history(), settings).map(r => r.cycleId)).toEqual(['c1']);
    const h = history();
    h.lh = [{ date: '2026-10-15', result: 'positive', provenance: 'manual' }];
    expect(pastOvulations(h, settings)[1]?.basis).toBe('lh');
  });

  it('breastfeeding postpartum requires biomarkers until ovulation resumes after delivery', () => {
    const settings = { ...FIXTURE_SETTINGS, lifeStates: [{ kind: 'postpartum' as const, delivered: '2026-10-03', breastfeeding: true }] };
    expect(pastOvulations(history(), settings).map(r => r.cycleId)).toEqual(['c1']);
    const h = history();
    h.cycles[1]!.ovulation = { point: '2026-10-16', sd: 1, basis: 'calendar' };
    expect(pastOvulations(h, settings).map(r => r.cycleId)).toEqual(['c1']);
    h.lh = [{ date: '2026-10-15', result: 'positive', provenance: 'manual' }];
    expect(pastOvulations(h, settings)[1]).toMatchObject({ basis: 'lh', confidence: 'low' });
    const resumed = history();
    resumed.lh = [{ date: '2026-09-15', result: 'positive', provenance: 'manual' }];
    const delivered = resumed.cycles[0]!.start;
    expect(pastOvulations(resumed, { ...settings, lifeStates: [{ ...settings.lifeStates[0]!, delivered }] })[1])
      .toMatchObject({ cycleId: 'c2', basis: 'calendar', confidence: 'low' });
  });

  it('known irregular caps biomarker confidence at medium', () => {
    const h = history();
    h.cycles[1]!.ovulation = { point: '2026-10-16', sd: 1, basis: 'lh', confidence: 'high' };
    const settings = { ...FIXTURE_SETTINGS, lifeStates: [{ kind: 'known_irregular' as const, reason: 'pcos' as const, since: '2026-10-03' }] };
    expect(pastOvulations(h, settings)[1]?.confidence).toBe('medium');
  });

  it.each(['post_contraception', 'postpartum'] as const)('%s caps confidence during the first three completed cycles', kind => {
    const h = historyFromLengths([28, 28, 28, 28], '2026-10-31');
    const from = h.cycles[0]!.start;
    const state = kind === 'post_contraception'
      ? { kind, stopped: from, method: 'pill' }
      : { kind, delivered: from, breastfeeding: false };
    const rows = pastOvulations(h, { ...FIXTURE_SETTINGS, lifeStates: [state] });
    expect(rows.map(r => r.confidence)).toEqual(['low', 'low', 'medium', 'medium']);
  });

  it('recomputes a stored calendar estimate from the closed cycle', () => {
    const h = history();
    h.cycles[1]!.ovulation = { point: '2026-10-05', offset: 2, sd: 1, basis: 'calendar', confidence: 'high' };
    expect(pastOvulations(h, FIXTURE_SETTINGS)[1]).toEqual(pastOvulations(history(), FIXTURE_SETTINGS)[1]);
  });

  it.each([
    ['2026-10-31', undefined, true],
    ['2026-09-01', '2026-10-02', true],
    ['2026-09-01', '2026-10-03', false],
    ['2026-10-10', undefined, false],
  ] as const)('IUD boundary since %s until %s retains row: %s', (since, until, retained) => {
    const settings = { ...FIXTURE_SETTINGS, lifeStates: [{ kind: 'hormonal_contraception' as const, method: 'hormonal_iud' as const, since, until }] };
    expect(pastOvulations(history(), settings).some(r => r.cycleId === 'c2')).toBe(retained);
  });

  it('an LH-dated sibling shifts the calendar point by the learned luteal change', () => {
    const h = history();
    h.lh = [{ date: '2026-09-15', result: 'positive', provenance: 'manual' }];
    // Ovulation Sep 16 gives a 16-day luteal phase; prior mean 12.4, weight 10 -> posterior 140/11.
    const before = pastOvulations(history(), FIXTURE_SETTINGS)[1]!;
    const after = pastOvulations(h, FIXTURE_SETTINGS)[1]!;
    expect(before.point).toBe('2026-10-18');
    expect(after.point).toBe('2026-10-17');
    expect(after.basis).toBe('calendar');
  });

});
