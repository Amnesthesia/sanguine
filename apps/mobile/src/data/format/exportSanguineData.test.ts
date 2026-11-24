import { sealNote } from '@sanguine/crypto';
import { describe, expect, it } from 'vitest';
import type { Clock } from '../ids';
import { migrate } from '../migrate';
import { EventStore } from '../store';
import { openTestDb } from '../testDb';
import { exportSanguineData } from './exportSanguineData';
import { validateSanguineData } from './sanguineData';

let n = 0;
const clk: Clock = { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n++ * 7 + i + 3) % 256) };
const KEY = new Uint8Array(32).fill(7);

async function seeded() {
  const db = openTestDb();
  await migrate(db);
  const store = new EventStore(db, clk);
  const a = (kind: string, payload: Record<string, unknown>, extra: Record<string, unknown> = {}) => store.append({ kind, payload, ...extra } as never);
  await a('flow', { day: '2026-09-01', level: 'medium', flow_kind: 'period', clots: true });
  await a('flow', { day: '2026-09-02', level: 'none', flow_kind: 'period' });
  await a('symptom', { day: '2026-09-01', code: 'cramps', intensity: 2 });
  await a('symptom', { day: '2026-09-01', code: 'acne', intensity: 1 });
  await a('symptom', { day: '2026-09-01', code: 'acne', intensity: 0 });
  await a('energy', { day: '2026-09-01', level: 3 });
  await a('sex', { day: '2026-09-03', protected: true });
  await a('biomarker', { day: '2026-09-10', type: 'bbt', value: { valueC: 36.42 }, source: 'oral', measured_at: '2026-09-10T06:40:00+10:00', disturbed: true });
  await a('biomarker', { day: '2026-09-11', type: 'lh', value: { result: 'positive' }, source: 'strip' });
  await a('biomarker', { day: '2026-09-11', type: 'mucus', value: { quality: 'eggwhite', amount: 'heavy' }, source: 'app' });
  await a('note', { day: '2026-09-03', cipher: sealNote(KEY, 'felt fine', clk.randomBytes) });
  const mistake = await a('flow', { day: '2026-09-20', level: 'heavy', flow_kind: 'period' });
  await store.retract(mistake.id);
  await a('life_state.set', { kind: 'pregnant', detail: {}, day: '2026-01-01' });
  await a('life_state.end', { kind: 'pregnant', outcome: 'birth', day: '2026-02-01' });
  await a('cycle.exclude', { cycle_start: '2026-09-01' });
  return { db, store };
}

describe('exportSanguineData', () => {
  it('exports every kind of entry, validates cleanly, and leaves out retracted ones', async () => {
    const { db, store } = await seeded();
    const { data, notesDropped } = await exportSanguineData(db, store, { noteKey: KEY, exportedAt: 'x' });
    expect(notesDropped).toBe(0);
    expect(validateSanguineData(JSON.parse(JSON.stringify(data))).problems).toEqual([]);
    const by = Object.fromEntries(data.days.map((d) => [d.date, d]));
    expect(by['2026-09-01']).toMatchObject({ flow: { level: 'medium', kind: 'period', clots: true }, symptoms: [{ code: 'cramps', intensity: 2 }], energy: 3 });
    expect(by['2026-09-02']?.flow).toEqual({ level: 'none', kind: 'period' }); // explicit no-flow is kept: it separates periods
    expect(by['2026-09-03']).toMatchObject({ sex: { protected: true }, note: 'felt fine' });
    expect(by['2026-09-10']?.temperatures).toEqual([{ valueC: 36.42, type: 'bbt', time: '06:40', source: 'oral', disturbed: true }]);
    expect(by['2026-09-11']).toMatchObject({ lh: 'positive', mucus: { quality: 'eggwhite', amount: 'heavy' } });
    expect(by['2026-09-20']).toBeUndefined();
    expect(data.lifeStates).toEqual([{ kind: 'pregnant', start: '2026-01-01', end: '2026-02-01', outcome: 'birth' }]);
    expect(data.cycleMarks).toEqual([{ cycleStart: '2026-09-01', mark: 'exclude' }]);
    expect(data.source).toEqual({ app: 'sanguine' });
    expect(JSON.stringify(data)).not.toContain('undefined');
  });
  it('drops and counts notes without the key', async () => {
    const { db, store } = await seeded();
    const { data, notesDropped } = await exportSanguineData(db, store, { exportedAt: 'x' });
    expect(notesDropped).toBe(1);
    expect(data.days.find((d) => d.date === '2026-09-03')).toEqual({ date: '2026-09-03', sex: { protected: true } });
    expect(JSON.stringify(data)).not.toContain('felt fine');
  });
});
