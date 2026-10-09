import type { CycleRecord, DailyLog, HealthFlag, TemperatureReading } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { buildReport, DEFAULT_REPORT, type ReportInput } from './report';

const t = (k: string, p?: Record<string, unknown>) => i18n.t(k, p);
const c = (start: string, length: number | undefined, bleedDays: number, extra: Partial<CycleRecord> = {}): CycleRecord => ({ id: start, start, ...(length ? { length } : {}), bleedDays, quality: 'valid', ...extra });
const cycles = [c('2026-06-01', 28, 5), c('2026-06-29', 30, 4, { ovulation: { point: '2026-07-14', sd: 1, basis: 'bbt' } }), c('2026-07-29', 61, 6, { quality: 'suspect_skip' }), c('2026-09-28', 27, 5), c('2026-10-25', undefined, 2)];
const logs: DailyLog[] = [{ date: '2026-06-01', flow: 'heavy', symptoms: [{ code: 'cramps', intensity: 2 }] }, { date: '2026-06-02', flow: 'heavy' }, { date: '2026-07-01', flow: 'medium', symptoms: [{ code: 'cramps', intensity: 1 }, { code: 'headache', intensity: 1 }] }];
const temps: TemperatureReading[] = [{ date: '2026-07-10', valueC: 36.4, source: 'oral', provenance: 'manual' }, { date: '2026-07-11', valueC: 36.45, source: 'oral', provenance: 'manual' }];
const flags: HealthFlag[] = [{ code: 'longSingle', params: {}, raisedOn: '2026-09-28' }];
const input = (o: Partial<ReportInput> = {}): ReportInput => ({ cycles, logs, temperatures: temps, flags, today: '2026-10-26', age: 34, lifeStateKey: undefined, engine: { version: '0.1.10', hash: 'abcdef123456' }, fertilityTools: true, ...o });

describe('buildReport (P8-6)', () => {
  it('lists closed cycles with length, bleed days, heaviest flow and a note, and summarises them', () => {
    const html = buildReport(input(), DEFAULT_REPORT, t);
    expect(html).toContain('<td>1 Jun 2026</td><td>28</td><td>5</td><td>Heavy</td>');
    expect(html).toContain('unusually long');
    expect(html).toContain('4 cycles from 1 Jun 2026 to 24 Oct 2026');
    expect(html).toContain('27 to 61 days, middle value 29');
    expect(html).not.toContain('25 Oct 2026</td>'); // the open cycle is not a closed cycle
  });
  it('carries the fixed flag wording, the intended purpose and the engine version, and names no condition', () => {
    const html = buildReport(input(), DEFAULT_REPORT, t);
    expect(html).toContain('A very long cycle');
    expect(html).toContain('Track and understand your menstrual cycle.');
    expect(html).toContain('0.1.10');
    expect(html).toContain('abcdef123456');
    expect(html).not.toMatch(/\b(PCOS|endometriosis|diagnosis|risk)\b/i);
  });
  it('lists symptom days, temperature counts per cycle, and the ovulation estimate only when asked and allowed', () => {
    const html = buildReport(input(), DEFAULT_REPORT, t);
    expect(html).toContain('<td>Cramps</td><td>2</td>');
    expect(html).not.toContain('temperature)');
    const withOv = buildReport(input(), { ...DEFAULT_REPORT, ovulation: true }, t);
    expect(withOv).toContain('around 14 Jul 2026');
    const teen = buildReport(input({ fertilityTools: false }), { ...DEFAULT_REPORT, ovulation: true }, t);
    expect(teen).not.toMatch(/ovulation/i);
  });
  it('limits to the last N closed cycles and escapes text', () => {
    const html = buildReport(input({ lifeStateKey: 'settings.lifeState.options.perimenopause' }), { ...DEFAULT_REPORT, cycles: 2 }, t);
    expect(html).toContain('2 cycles from 29 Jul 2026');
    expect(html).not.toContain('<td>1 Jun 2026</td>');
    expect(buildReport(input({ cycles: [] }), DEFAULT_REPORT, t)).toContain(t('report.noCycles'));
  });
  it('sections can be left out', () => {
    const html = buildReport(input(), { ...DEFAULT_REPORT, symptoms: false, flags: false }, t);
    expect(html).not.toContain('Cramps');
    expect(html).not.toContain('A very long cycle');
  });
});
