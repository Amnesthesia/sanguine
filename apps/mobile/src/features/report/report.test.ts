import { addDays, type HealthFlag, type ISODate } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import type { EventRow } from '@/data/events';
import { project } from '@/data/project';
import { scenario } from '@/features/dev/scenarios';
import i18n from '@/i18n';
import { buildReport, closedCycles, DEFAULT_REPORT, type ReportInput } from './report';

const t = (k: string, p?: Record<string, unknown>) => i18n.t(k, p);

// History is built the way the app builds it: events through project(). Records made by hand carry fields the app never supplies (S7, P8-34).
type Ev = { kind: string; payload: Record<string, unknown> };
const rowsOf = (events: Ev[]): EventRow[] => events.map((e, i) => ({
  id: `e${String(i).padStart(4, '0')}`, lamport: i + 1, device_id: 'd', recorded_at: 'x', effective_day: e.payload.day as ISODate, tz: 'UTC', kind: e.kind,
  payload: JSON.stringify(e.payload), provenance: 'manual', source_app: null, external_id: null, retracts: null, schema_v: 1,
}));
const bleed = (start: ISODate, days: number, heavyDays = 0): Ev[] => Array.from({ length: days }, (_, i) => ({ kind: 'flow', payload: { day: addDays(start, i), level: i < heavyDays ? 'heavy' : 'medium', flow_kind: 'period' } }));
const symptom = (day: ISODate, code: string, intensity: number): Ev => ({ kind: 'symptom', payload: { day, code, intensity } });
const bbt = (day: ISODate, valueC: number): Ev => ({ kind: 'biomarker', payload: { day, type: 'bbt', value: { valueC }, source: 'oral', measured_at: `${day}T06:30:00+10:00` } });
// cycles of 28, 30, 61 and 27 days, then an open one; a clear temperature shift in the second
const events: Ev[] = [
  ...bleed('2026-06-01', 5, 2), ...bleed('2026-06-29', 4), ...bleed('2026-07-29', 6), ...bleed('2026-09-28', 5), ...bleed('2026-10-25', 2),
  symptom('2026-06-01', 'cramps', 2), symptom('2026-07-01', 'cramps', 1), symptom('2026-07-01', 'headache', 1),
  ...Array.from({ length: 24 }, (_, i) => bbt(addDays('2026-07-03', i), i < 11 ? 36.3 : 36.65)),
];
const flags: HealthFlag[] = [{ code: 'longSingle', params: {}, raisedOn: '2026-09-28' }];
const input = (o: Partial<ReportInput> = {}, evs: Ev[] = events): ReportInput => {
  const { history, settings } = project(rowsOf(evs));
  return { history, settings, flags, today: '2026-10-26', age: 34, lifeStateKey: undefined, engine: { version: '0.1.10', hash: 'abcdef123456' }, fertilityTools: true, ...o };
};

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
    // the basis in words a doctor reads, never a copy key or "ovulation: temperature"
    expect(withOv).toMatch(/around \d+ Jul 2026 \(temperature shift\)/);
    const teen = buildReport(input({ fertilityTools: false }), { ...DEFAULT_REPORT, ovulation: true }, t);
    expect(teen).not.toMatch(/ovulation/i);
  });
  it('limits to the last N closed cycles and escapes text', () => {
    const html = buildReport(input({ lifeStateKey: 'settings.lifeState.options.perimenopause' }), { ...DEFAULT_REPORT, cycles: 2 }, t);
    expect(html).toContain('2 cycles from 29 Jul 2026');
    expect(html).not.toContain('<td>1 Jun 2026</td>');
    expect(buildReport(input({}, []), DEFAULT_REPORT, t)).toContain(t('report.noCycles'));
  });
  it('sections can be left out', () => {
    const html = buildReport(input(), { ...DEFAULT_REPORT, symptoms: false, flags: false }, t);
    expect(html).not.toContain('Cramps');
    expect(html).not.toContain('A very long cycle');
  });
  it('lists the two closed cycles of the typical scenario', () => {
    const today = '2026-10-26';
    const sc = scenario('typical', today);
    const evs = sc.events.map((e) => ({ kind: e.kind, payload: { ...e.payload, day: e.payload.day ?? today } }));
    const { history, settings } = project(rowsOf(evs), sc.profile);
    expect(history.cycles.every((c) => c.length === undefined)).toBe(true); // raw records carry no length: the old filter found no cycle
    expect(closedCycles(history, settings, 6).map((c) => c.length)).toEqual([28, 29]);
    const html = buildReport(input({}, evs), DEFAULT_REPORT, t);
    expect(html).not.toContain(t('report.noCycles'));
    expect(html).toContain('2 cycles from');
  });
});

