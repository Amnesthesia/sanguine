import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import type { DayEvent } from './actions';
import { describeEvent, shortDescribe } from './describe';

const ev = (kind: string, data: Record<string, unknown>): DayEvent => ({ id: 'x', lamport: 1, device_id: 'd', recorded_at: '', effective_day: '2026-10-10', tz: 'UTC', kind, payload: JSON.stringify(data), provenance: 'manual', source_app: null, external_id: null, retracts: null, schema_v: 1, data });
const t = i18n.t.bind(i18n);

describe('describeEvent', () => {
  it('flow with its kind', () => {
    expect(describeEvent(ev('flow', { level: 'medium', flow_kind: 'period' }), t, 'C')).toBe('Medium flow');
    expect(describeEvent(ev('flow', { level: 'light', flow_kind: 'withdrawal_bleed' }), t, 'C')).toBe('Light flow · withdrawal bleed');
    expect(describeEvent(ev('flow', { level: 'none', flow_kind: 'period' }), t, 'C')).toBe('Nothing logged');
  });
  it('symptoms use the catalogue label and intensity', () =>
    expect(describeEvent(ev('symptom', { code: 'breast_tenderness', intensity: 2 }), t, 'C')).toBe('Breast tenderness 2/3'));
  it('temperature in the chosen unit with time and source', () => {
    const e = ev('biomarker', { type: 'bbt', value: { valueC: 36.42 }, source: 'oral', measured_at: '2026-10-10T06:40:00' });
    expect(describeEvent(e, t, 'C')).toBe('Temperature 36.42 °C · 06:40 · Oral');
    expect(describeEvent(e, t, 'F')).toBe('Temperature 97.56 °F · 06:40 · Oral');
  });
  it('tests and observations', () => {
    expect(describeEvent(ev('biomarker', { type: 'lh', value: { result: 'positive' } }), t, 'C')).toBe('Ovulation test: Positive');
    expect(describeEvent(ev('biomarker', { type: 'mucus', value: { quality: 'eggwhite' } }), t, 'C')).toBe('Cervical mucus: Egg white');
    expect(describeEvent(ev('biomarker', { type: 'mucus', value: { quality: 'eggwhite', amount: 'heavy' } }), t, 'C')).toBe('Cervical mucus: Egg white, a lot');
    expect(describeEvent(ev('biomarker', { type: 'preg_test', value: { result: 'negative' } }), t, 'C')).toBe('Pregnancy test: Negative');
    expect(describeEvent(ev('biomarker', { type: 'cervix', value: { position: 'high', firmness: 'soft', opening: 'open' } }), t, 'C')).toBe('Cervical position: high, soft, open');
  });
  it('sex and notes never show private detail', () => {
    expect(describeEvent(ev('sex', { protected: true }), t, 'C')).toBe('Sex: Condom used');
    expect(describeEvent(ev('note', { cipher: 'n1:abcd' }), t, 'C')).toBe('Private note');
  });
});

describe('shortDescribe (calendar summary)', () => {
  it('names symptoms without intensity and writes BBT briefly', () => {
    expect(shortDescribe(ev('symptom', { code: 'bloating', intensity: 2 }), t, 'C')).toBe('Bloating');
    expect(shortDescribe(ev('biomarker', { type: 'bbt', value: { valueC: 36.42 } }), t, 'C')).toBe('BBT 36.42 °C');
    expect(shortDescribe(ev('flow', { level: 'heavy', flow_kind: 'period' }), t, 'C')).toBe('Heavy flow');
  });
});
