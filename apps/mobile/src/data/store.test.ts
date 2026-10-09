import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from './database';
import type { EventRow } from './events';
import { type Clock, uuidv7 } from './ids';
import { migrate } from './migrate';
import { activeEvents, project } from './project';
import { EventStore } from './store';
import { openTestDb } from './testDb';

function fakeClock(): Clock {
  let ms = Date.UTC(2026, 9, 10, 8, 0, 0);
  let n = 0;
  return {
    nowMs: () => (ms += 1),
    iso: () => `2026-10-10T08:00:${String(n++ % 60).padStart(2, '0')}+10:00`,
    tz: () => 'Australia/Sydney',
    randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n * 31 + i * 17) % 256),
  };
}
let db: Database;
let store: EventStore;
beforeEach(async () => {
  db = openTestDb();
  await migrate(db);
  store = new EventStore(db, fakeClock());
});

const flow = (day: string, level = 'medium', flow_kind = 'period', extra = {}) => ({ kind: 'flow', payload: { day, level, flow_kind, ...extra } });
const cycles = () => db.all<Record<string, unknown>>('SELECT * FROM cycle ORDER BY start_day');
const periodsOf = async (starts: string[]) => { for (const d of starts) await store.append(flow(d)); };

describe('uuidv7', () => {
  it('is version 7, variant 10, and sorts by time', () => {
    const rnd = new Uint8Array(10).fill(255);
    const a = uuidv7(1_000, rnd);
    const b = uuidv7(2_000, rnd);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
    expect(() => uuidv7(1, new Uint8Array(3))).toThrow();
  });
});

describe('append', () => {
  it('assigns increasing lamport, one device id, tz and provenance', async () => {
    const a = await store.append(flow('2026-10-01'));
    const b = await store.append(flow('2026-10-02'));
    expect([a.lamport, b.lamport]).toEqual([1, 2]);
    expect(a.device_id).toBe(b.device_id);
    expect(a.tz).toBe('Australia/Sydney');
    expect(a.provenance).toBe('manual');
    expect(a.effective_day).toBe('2026-10-01');
  });
  it('rejects invalid payloads without writing anything', async () => {
    await expect(store.append({ kind: 'flow', payload: { day: '2026-10-01', level: 'torrent', flow_kind: 'period' } })).rejects.toThrow(/invalid flow/);
    await expect(store.append({ kind: 'symptom', payload: { day: '2026-10-01', code: 'cramps', intensity: 4 } })).rejects.toThrow(/intensity/);
    await expect(store.append({ kind: 'nonsense', payload: {} })).rejects.toThrow(/unknown kind/);
    await expect(store.append({ kind: 'biomarker', payload: { day: '2026-10-01', type: 'bbt', value: { valueC: 'hot' }, source: 'oral' } })).rejects.toThrow(/valueC/);
    expect(await store.events()).toEqual([]);
  });
  it('appendMany is atomic', async () => {
    await expect(store.appendMany([flow('2026-10-01'), { kind: 'flow', payload: { day: 'bad' } }])).rejects.toThrow();
    expect(await store.events()).toEqual([]);
    expect(await cycles()).toEqual([]);
  });
});

describe('cycles from flow (§5.4)', () => {
  it('a flow day starts a cycle; consecutive days extend it; gaps of one day are allowed', async () => {
    await periodsOf(['2026-10-01', '2026-10-02', '2026-10-04']);
    expect(await cycles()).toMatchObject([{ start_day: '2026-10-01', end_day: '2026-10-04', bleed_days: 4, next_start: null, length_days: null }]);
  });
  it('a two-day gap starts a new cycle with derived length and next_start', async () => {
    await periodsOf(['2026-09-03', '2026-09-04', '2026-10-01', '2026-10-02']);
    expect(await cycles()).toMatchObject([
      { start_day: '2026-09-03', end_day: '2026-09-04', next_start: '2026-10-01', length_days: 28 },
      { start_day: '2026-10-01', end_day: '2026-10-02', next_start: null },
    ]);
  });
  it('period days up to 7 days apart are one period (D-052)', async () => {
    await periodsOf(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-12']);
    expect(await cycles()).toMatchObject([{ start_day: '2026-10-01', end_day: '2026-10-12', bleed_days: 12, next_start: null }]);
  });
  it('an 8-day gap starts a new cycle', async () => {
    await periodsOf(['2026-09-03', '2026-09-04', '2026-09-12']);
    expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-03', '2026-09-12']);
  });
  it('a period.start with merge:false splits a run inside the join window', async () => {
    await periodsOf(['2026-09-03', '2026-09-04', '2026-09-10']);
    await store.append({ kind: 'period.start', payload: { day: '2026-09-10', merge: false } });
    expect(await cycles()).toMatchObject([
      { start_day: '2026-09-03', end_day: '2026-09-04', next_start: '2026-09-10', length_days: 7 },
      { start_day: '2026-09-10' },
    ]);
  });
  it('retracting the split restores the join', async () => {
    await periodsOf(['2026-09-03', '2026-09-10']);
    const split = await store.append({ kind: 'period.start', payload: { day: '2026-09-10', merge: false } });
    await store.retract(split.id);
    expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-03']);
  });
  it('a bare period.start inside the join window joins (back-filling an earlier day)', async () => {
    await store.append(flow('2026-09-25'));
    await store.append({ kind: 'period.start', payload: { day: '2026-09-20' } });
    expect(await cycles()).toMatchObject([{ start_day: '2026-09-20', end_day: '2026-09-25' }]);
  });
  it('one explicit no-flow day inside the gap still joins; two split', async () => {
    await periodsOf(['2026-09-01', '2026-09-02']);
    await store.append(flow('2026-09-04', 'none'));
    await store.append(flow('2026-09-06'));
    expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-01']);
    await store.append(flow('2026-09-05', 'none'));
    expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-01', '2026-09-06']);
  });
  it('spotting and non-period bleeding never start a cycle', async () => {
    await store.append(flow('2026-10-01', 'spotting'));
    await store.append(flow('2026-10-05', 'medium', 'withdrawal_bleed'));
    await store.append(flow('2026-10-09', 'light', 'intermenstrual'));
    expect(await cycles()).toEqual([]);
    expect(await db.all('SELECT day, flow, flow_kind FROM daily_log ORDER BY day')).toHaveLength(3);
  });
  it('period.start alone creates a cycle; period.end overrides the last day', async () => {
    await store.append({ kind: 'period.start', payload: { day: '2026-10-01' } });
    await store.append(flow('2026-10-02', 'light'));
    await store.append({ kind: 'period.end', payload: { day: '2026-10-06' } });
    expect(await cycles()).toMatchObject([{ start_day: '2026-10-01', end_day: '2026-10-06', bleed_days: 6 }]);
  });
  it('later flow on the same day replaces the earlier one; level none clears the period day', async () => {
    await store.append(flow('2026-10-01', 'heavy'));
    await store.append(flow('2026-10-01', 'none'));
    expect(await cycles()).toEqual([]);
    expect(await db.get('SELECT flow FROM daily_log WHERE day = ?', ['2026-10-01'])).toEqual({ flow: 'none' });
  });
  it('cycle quality comes from the engine (a 56-day cycle among regular ones is suspect_skip)', async () => {
    await periodsOf(['2026-01-01', '2026-01-29', '2026-02-27', '2026-04-23', '2026-05-21', '2026-06-19']);
    const q = (await cycles()).map((c) => c.quality);
    expect(q).toEqual(['valid', 'valid', 'suspect_skip', 'valid', 'valid', 'valid']);
  });
  it('cycle.confirm_long re-admits it and cycle.exclude removes one', async () => {
    await periodsOf(['2026-01-01', '2026-01-29', '2026-02-27', '2026-04-23', '2026-05-21', '2026-06-19']);
    const confirm = await store.append({ kind: 'cycle.confirm_long', payload: { cycle_start: '2026-02-27', reason: 'real' } });
    expect((await cycles())[2]?.quality).toBe('valid');
    await store.append({ kind: 'cycle.exclude', payload: { cycle_start: '2026-01-01', reason: 'travel' } });
    expect((await cycles())[0]?.quality).toBe('user_excluded');
    await store.retract(confirm.id);
    expect((await cycles())[2]?.quality).toBe('suspect_skip');
  });
});

describe('retract (§5.3)', () => {
  it('retracting the only flow event removes the cycle and re-links its neighbours', async () => {
    await periodsOf(['2026-09-03', '2026-10-01']);
    const mid = await store.append(flow('2026-09-20'));
    expect(await cycles()).toHaveLength(3);
    await store.retract(mid.id);
    expect(await cycles()).toMatchObject([{ start_day: '2026-09-03', next_start: '2026-10-01', length_days: 28 }, { start_day: '2026-10-01' }]);
  });
  it('the event stays in the log; a retract row points at it', async () => {
    const e = await store.append(flow('2026-10-01'));
    const r = await store.retract(e.id);
    expect(await db.get('SELECT COUNT(*) n FROM event')).toEqual({ n: 2 });
    expect(r.retracts).toBe(e.id);
    expect(r.kind).toBe('retract');
    expect(await cycles()).toEqual([]);
    expect(await db.all('SELECT * FROM daily_log')).toEqual([]);
  });
  it('retracting a retract restores the original (undo of undo)', async () => {
    const e = await store.append(flow('2026-10-01'));
    const r = await store.retract(e.id);
    await store.retract(r.id);
    expect(await cycles()).toHaveLength(1);
  });
  it('cannot retract an unknown event', async () => {
    await expect(store.retract('nope')).rejects.toThrow(/unknown event/);
  });
});

describe('daily log', () => {
  it('symptoms are per code, latest wins, intensity 0 removes; sex and notes are stored', async () => {
    const d = '2026-10-01';
    await store.append({ kind: 'symptom', payload: { day: d, code: 'cramps', intensity: 2 } });
    await store.append({ kind: 'symptom', payload: { day: d, code: 'headache', intensity: 1 } });
    await store.append({ kind: 'symptom', payload: { day: d, code: 'cramps', intensity: 3 } });
    await store.append({ kind: 'symptom', payload: { day: d, code: 'headache', intensity: 0 } });
    await store.append({ kind: 'sex', payload: { day: d, protected: true } });
    await store.append({ kind: 'note', payload: { day: d, cipher: 'abc' } });
    const row = await db.get<{ symptoms: string; sex: string; notes_cipher: Uint8Array }>('SELECT * FROM daily_log WHERE day = ?', [d]);
    expect(JSON.parse(row?.symptoms ?? '')).toEqual([{ code: 'cramps', intensity: 3 }]);
    expect(JSON.parse(row?.sex ?? '')).toEqual({ protected: true });
    expect(new TextDecoder().decode(row?.notes_cipher)).toBe('abc');
  });
  it('updated_event points at the last event for the day', async () => {
    await store.append(flow('2026-10-01'));
    const s = await store.append({ kind: 'symptom', payload: { day: '2026-10-01', code: 'cramps', intensity: 1 } });
    expect((await db.get<{ updated_event: string }>('SELECT updated_event FROM daily_log'))?.updated_event).toBe(s.id);
  });
  it('logging symptoms never creates or moves a cycle', async () => {
    await periodsOf(['2026-10-01']);
    const before = JSON.stringify(await cycles());
    await store.append({ kind: 'symptom', payload: { day: '2026-10-15', code: 'cramps', intensity: 3 } });
    expect(JSON.stringify(await cycles())).toBe(before);
  });
});

describe('biomarkers and life states', () => {
  it('biomarker rows are projected and feed the engine inputs', async () => {
    await store.append({ kind: 'biomarker', payload: { day: '2026-10-05', type: 'bbt', value: { valueC: 36.42 }, source: 'oral', measured_at: '2026-10-05T06:40:00+10:00' } });
    await store.append({ kind: 'biomarker', payload: { day: '2026-10-06', type: 'lh', value: { result: 'positive' }, source: 'strip' } });
    expect(await db.all('SELECT day, type, source FROM biomarker ORDER BY day')).toEqual([{ day: '2026-10-05', type: 'bbt', source: 'oral' }, { day: '2026-10-06', type: 'lh', source: 'strip' }]);
    const { history } = await store.engineInputs();
    expect(history.temperatures).toMatchObject([{ date: '2026-10-05', valueC: 36.42, timeOfDay: '06:40', source: 'oral' }]);
    expect(history.lh).toMatchObject([{ date: '2026-10-06', result: 'positive' }]);
  });
  it('life_state.set and .end build a row with an until day and map to engine settings', async () => {
    await store.append({ kind: 'life_state.set', payload: { kind: 'hormonal_contraception', detail: { method: 'combined_pill' }, day: '2026-10-01' } });
    expect((await store.engineInputs()).settings.lifeStates).toEqual([{ kind: 'hormonal_contraception', method: 'combined_pill', since: '2026-10-01' }]);
    await store.append({ kind: 'life_state.end', payload: { kind: 'hormonal_contraception', day: '2026-12-01' } });
    expect(await db.all('SELECT kind, from_day, until_day FROM life_state')).toEqual([{ kind: 'hormonal_contraception', from_day: '2026-10-01', until_day: '2026-12-01' }]);
    expect((await store.engineInputs()).settings.lifeStates[0]).toMatchObject({ until: '2026-12-01' });
  });
  it('the profile (birth year etc.) reaches the engine settings', async () => {
    await store.setProfile({ birthYear: 1989, menarcheYear: 2002 });
    expect((await store.engineInputs()).settings).toMatchObject({ birthYear: 1989, menarcheYear: 2002, window: 12 });
  });
});

describe('rebuild (§5.4)', () => {
  it('is idempotent and reproduces the incremental projections exactly', async () => {
    await periodsOf(['2026-08-04', '2026-09-01', '2026-09-30']);
    await store.append({ kind: 'symptom', payload: { day: '2026-10-01', code: 'cramps', intensity: 2 } });
    await store.append({ kind: 'biomarker', payload: { day: '2026-10-10', type: 'bbt', value: { valueC: 36.42 }, source: 'oral' } });
    const dump = async () => JSON.stringify(await Promise.all(['cycle', 'daily_log', 'biomarker', 'life_state'].map((t) => db.all(`SELECT * FROM ${t} ORDER BY 1`))));
    const incremental = await dump();
    await store.rebuild();
    expect(await dump()).toBe(incremental);
    await store.rebuild();
    expect(await dump()).toBe(incremental);
  });
  it('rebuilds a corrupted projection from the log', async () => {
    await periodsOf(['2026-09-01', '2026-09-30']);
    await db.run('DELETE FROM cycle');
    await db.run("INSERT INTO cycle (id, start_day, quality) VALUES ('junk', '2000-01-01', 'valid')");
    await store.rebuild();
    expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-01', '2026-09-30']);
  });
});

describe('projection is order independent (property)', () => {
  const rows = (): EventRow[] => {
    const mk = (i: number, kind: string, payload: object, day: string, extra: Partial<EventRow> = {}): EventRow => ({
      id: `e${String(i).padStart(3, '0')}`, lamport: i, device_id: 'd', recorded_at: 'x', effective_day: day, tz: 'UTC', kind, payload: JSON.stringify(payload),
      provenance: 'manual', source_app: null, external_id: null, retracts: null, schema_v: 1, ...extra,
    });
    return [
      mk(1, 'flow', { day: '2026-08-04', level: 'medium', flow_kind: 'period' }, '2026-08-04'),
      mk(2, 'flow', { day: '2026-09-01', level: 'heavy', flow_kind: 'period' }, '2026-09-01'),
      mk(3, 'flow', { day: '2026-09-02', level: 'light', flow_kind: 'period' }, '2026-09-02'),
      mk(4, 'symptom', { day: '2026-09-02', code: 'cramps', intensity: 2 }, '2026-09-02'),
      mk(5, 'flow', { day: '2026-09-30', level: 'medium', flow_kind: 'period' }, '2026-09-30'),
      mk(6, 'retract', {}, '2026-09-02', { retracts: 'e003', kind: 'retract' }),
      mk(7, 'biomarker', { day: '2026-09-10', type: 'bbt', value: { valueC: 36.4 }, source: 'oral' }, '2026-09-10'),
      mk(8, 'life_state.set', { kind: 'perimenopause', detail: {}, day: '2026-01-01' }, '2026-01-01'),
    ];
  };
  it('project(events) equals project(shuffle(events))', () => {
    const base = JSON.stringify(project(rows()));
    fc.assert(fc.property(fc.shuffledSubarray(rows(), { minLength: 8, maxLength: 8 }), (shuffled) => {
      expect(JSON.stringify(project(shuffled))).toBe(base);
    }), { numRuns: 200 });
  });
  it('activeEvents drops retracted events and keeps order', () => {
    expect(activeEvents(rows()).map((e) => e.id)).not.toContain('e003');
    expect(activeEvents(rows()).map((e) => e.lamport)).toEqual([...activeEvents(rows()).map((e) => e.lamport)].sort((a, b) => a - b));
  });
});

describe('merging a start into a later one (§5.4)', () => {
  it('a start 5 days before another joins it unless the later day is split (D-052)', async () => {
    await periodsOf(['2026-09-20', '2026-09-25']);
    expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-20']);
    await store.append({ kind: 'period.start', payload: { day: '2026-09-25', merge: false } });
    expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-20', '2026-09-25']);
  });
  it('with a confirmed merge the two starts are one period beginning on the earlier day', async () => {
    await store.append(flow('2026-09-25'));
    await store.append({ kind: 'period.start', payload: { day: '2026-09-20', merge: true } });
    expect(await cycles()).toMatchObject([{ start_day: '2026-09-20', end_day: '2026-09-25' }]);
  });
  it('a merge flag does not join starts more than 7 days apart', async () => {
    await store.append(flow('2026-09-25'));
    await store.append({ kind: 'period.start', payload: { day: '2026-09-10', merge: true } });
    expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-10', '2026-09-25']);
  });
  it('rejects a non-boolean merge flag', async () => {
    await expect(store.append({ kind: 'period.start', payload: { day: '2026-09-20', merge: 'yes' } })).rejects.toThrow(/merge/);
  });
});
