import { describe, expect, it } from 'vitest';
import { FormatError, validateSanguineData } from './sanguineData';

const file = (days: unknown[], extra: Record<string, unknown> = {}) => ({ format: 'sanguine-data', version: 1, days, ...extra });

describe('validateSanguineData', () => {
  it('accepts a full day and sorts days', () => {
    const { data, problems } = validateSanguineData(file([
      { date: '2026-11-02', flow: { level: 'light' }, note: 'hi' },
      { date: '2026-11-01', flow: { level: 'heavy', kind: 'period', clots: true }, temperatures: [{ valueC: 36.5, type: 'bbt', time: '06:30', disturbed: true }], lh: 'positive', pregTest: 'negative',
        mucus: { quality: 'eggwhite', amount: 'heavy' }, cervix: { position: 'high', firmness: 'soft', opening: 'open' }, sex: { protected: false }, symptoms: [{ code: 'cramps', intensity: 2 }], energy: 3 },
    ], { lifeStates: [{ kind: 'pregnant', start: '2026-01-01', end: '2026-02-01', outcome: 'loss' }], cycleMarks: [{ cycleStart: '2026-10-01', mark: 'exclude' }] }));
    expect(problems).toEqual([]);
    expect(data.days.map((d) => d.date)).toEqual(['2026-11-01', '2026-11-02']);
    expect(data.lifeStates).toHaveLength(1);
    expect(data.cycleMarks).toHaveLength(1);
  });
  it('turns each defect into a problem and keeps the rest', () => {
    const { data, problems } = validateSanguineData(file([
      { date: '2026-02-30', flow: { level: 'light' } },
      { date: '2026-11-01', flow: { level: 'torrent' }, temperatures: [{ valueC: 50, type: 'bbt' }], lh: 'maybe', energy: 9, extra: 1, symptoms: [{ code: 'a' }, { code: 'a' }] },
      { date: '2026-11-01', note: 'dup' },
      { date: '2026-11-03', note: '   ' },
    ]));
    expect(data.days).toEqual([{ date: '2026-11-01', symptoms: [{ code: 'a' }] }, { date: '2026-11-03' }]);
    expect(problems.join('\n')).toMatch(/date must be YYYY-MM-DD/);
    expect(problems.join('\n')).toMatch(/flow needs a level/);
    expect(problems.join('\n')).toMatch(/valueC must be a number from 34 to 42/);
    expect(problems.join('\n')).toMatch(/lh must be/);
    expect(problems.join('\n')).toMatch(/energy must be 1 to 5/);
    expect(problems.join('\n')).toMatch(/unknown field "extra"/);
    expect(problems.join('\n')).toMatch(/listed twice/);
  });
  it('refuses other formats and newer versions', () => {
    expect(() => validateSanguineData([])).toThrow(FormatError);
    expect(() => validateSanguineData({ format: 'x', version: 1, days: [] })).toThrow(FormatError);
    expect(() => validateSanguineData({ format: 'sanguine-data', version: 2, days: [] })).toThrow(/newer/);
    expect(() => validateSanguineData({ format: 'sanguine-data', version: 1 })).toThrow(/no days/);
  });
});
