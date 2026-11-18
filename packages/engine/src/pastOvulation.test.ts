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

  it('does not write into CycleRecord.ovulation', () => {
    const h = history();
    const before = structuredClone(analyzeCycles(h, FIXTURE_SETTINGS));
    const input = structuredClone(h);
    pastOvulations(h, FIXTURE_SETTINGS);
    expect(analyzeCycles(h, FIXTURE_SETTINGS)).toEqual(before);
    expect(h).toEqual(input);
    expect(before.every(({ record }) => record.ovulation === undefined)).toBe(true);
  });
});
