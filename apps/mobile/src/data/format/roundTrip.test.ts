// The own-format round trip must reproduce what project.ts derives: an event history exported to the format and imported into a fresh database
// gives the same cycle, daily_log, biomarker and life_state tables (D-159). Deterministic: fixed seed. Documented limits are in docs/FORMAT.md "Round trip".
import { openNote, sealNote } from '@sanguine/crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Database } from '../database';
import type { NewEvent } from '../events';
import type { Clock } from '../ids';
import { migrate } from '../migrate';
import { activeEvents } from '../project';
import { EventStore } from '../store';
import { openTestDb } from '../testDb';
import { exportSanguineData } from './exportSanguineData';
import { importSanguineData } from './importSanguineData';
import { validateSanguineData } from './sanguineData';

let n = 0;
const clock: Clock = { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n++ * 7 + i + 3) % 256) };
const KEY = new Uint8Array(32).fill(7);
const dayOf = (i: number) => `2026-09-${String(i).padStart(2, '0')}`;

type Op =
  | { t: 'flow'; d: number; level: string; kind: string; clots: boolean }
  | { t: 'pstart'; d: number; merge?: boolean }
  | { t: 'pend'; d: number }
  | { t: 'symptom'; d: number; code: string; i: number }
  | { t: 'energy'; d: number; l: number }
  | { t: 'sex'; d: number; p: boolean }
  | { t: 'note'; d: number; text: string }
  | { t: 'bbt'; d: number; v: number; dist: boolean }
  | { t: 'skin'; d: number; v: number; src: string }
  | { t: 'bio'; d: number; type: 'lh' | 'mucus' | 'cervix' | 'preg_test'; k: number }
  | { t: 'cmark'; d: number; exclude: boolean }
  | { t: 'life'; kind: string; s: number; e?: number; outcome?: boolean }
  | { t: 'retract'; at: number };

const day = fc.integer({ min: 1, max: 30 });
const op: fc.Arbitrary<Op> = fc.oneof(
  { weight: 5, arbitrary: fc.record({ t: fc.constant('flow' as const), d: day, level: fc.constantFrom('none', 'spotting', 'light', 'medium', 'heavy'), kind: fc.constantFrom('period', 'period', 'period', 'intermenstrual', 'withdrawal_bleed'), clots: fc.boolean() }) },
  { weight: 3, arbitrary: fc.record({ t: fc.constant('pstart' as const), d: day, merge: fc.constantFrom(undefined, true, false) }) },
  { weight: 2, arbitrary: fc.record({ t: fc.constant('pend' as const), d: day }) },
  { weight: 3, arbitrary: fc.record({ t: fc.constant('symptom' as const), d: day, code: fc.constantFrom('cramps', 'acne', 'headache'), i: fc.integer({ min: 0, max: 3 }) }) },
  { weight: 2, arbitrary: fc.record({ t: fc.constant('energy' as const), d: day, l: fc.integer({ min: 0, max: 5 }) }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant('sex' as const), d: day, p: fc.boolean() }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant('note' as const), d: day, text: fc.constantFrom('felt fine', 'tired, sore') }) },
  { weight: 2, arbitrary: fc.record({ t: fc.constant('bbt' as const), d: day, v: fc.integer({ min: 3600, max: 3700 }), dist: fc.boolean() }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant('skin' as const), d: day, v: fc.integer({ min: 3450, max: 3600 }), src: fc.constantFrom('wrist', 'finger') }) },
  { weight: 2, arbitrary: fc.record({ t: fc.constant('bio' as const), d: day, type: fc.constantFrom('lh' as const, 'mucus' as const, 'cervix' as const, 'preg_test' as const), k: fc.integer({ min: 0, max: 4 }) }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant('cmark' as const), d: day, exclude: fc.boolean() }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant('life' as const), kind: fc.constantFrom('pregnant', 'perimenopause', 'postpartum'), s: fc.integer({ min: 1, max: 15 }), e: fc.option(fc.integer({ min: 16, max: 30 }), { nil: undefined }), outcome: fc.boolean() }) },
  { weight: 3, arbitrary: fc.record({ t: fc.constant('retract' as const), at: fc.nat(60) }) },
);

const LH = ['negative', 'positive', 'high', 'peak', 'indeterminate'] as const;
const MUCUS = ['dry', 'sticky', 'creamy', 'watery', 'eggwhite'] as const;
const POS = ['low', 'mid', 'high'] as const;
const FIRM = ['firm', 'medium', 'soft'] as const;
const OPEN = ['closed', 'partial', 'open'] as const;

async function build(store: EventStore, ops: Op[]) {
  const rows: Array<{ id: string }> = [];
  const used = new Set<string>(); // one lh/mucus/cervix/preg_test per day and type: the format holds one (documented limit)
  const lifeUsed = new Set<string>(); // one span per kind: a second span with the same start day shares an id (documented limit)
  const add = async (e: NewEvent) => { rows.push(await store.append(e)); };
  for (const o of ops) {
    const d = 'd' in o ? dayOf(o.d) : '';
    switch (o.t) {
      case 'flow': await add({ kind: 'flow', payload: { day: d, level: o.level, flow_kind: o.kind, ...(o.clots ? { clots: true } : {}) } }); break;
      case 'pstart': await add({ kind: 'period.start', payload: { day: d, ...(o.merge !== undefined ? { merge: o.merge } : {}) } }); break;
      case 'pend': await add({ kind: 'period.end', payload: { day: d } }); break;
      case 'symptom': await add({ kind: 'symptom', payload: { day: d, code: o.code, intensity: o.i } }); break;
      case 'energy': await add({ kind: 'energy', payload: { day: d, level: o.l } }); break;
      case 'sex': await add({ kind: 'sex', payload: { day: d, protected: o.p } }); break;
      case 'note': await add({ kind: 'note', payload: { day: d, cipher: sealNote(KEY, o.text, clock.randomBytes) } }); break;
      case 'bbt': await add({ kind: 'biomarker', payload: { day: d, type: 'bbt', value: { valueC: o.v / 100 }, source: 'oral', ...(o.dist ? { disturbed: true } : {}) } }); break;
      case 'skin': await add({ kind: 'biomarker', payload: { day: d, type: 'skin_temp', value: { valueC: o.v / 100 }, source: o.src } }); break;
      case 'bio': {
        if (used.has(`${o.type}:${d}`)) break;
        used.add(`${o.type}:${d}`);
        if (o.type === 'lh') await add({ kind: 'biomarker', payload: { day: d, type: 'lh', value: { result: LH[o.k] }, source: 'strip' } });
        else if (o.type === 'preg_test') await add({ kind: 'biomarker', payload: { day: d, type: 'preg_test', value: { result: o.k % 2 ? 'positive' : 'negative' }, source: 'strip' } });
        else if (o.type === 'mucus') await add({ kind: 'biomarker', payload: { day: d, type: 'mucus', value: { quality: MUCUS[o.k], ...(o.k % 2 ? { amount: 'light' } : {}) }, source: 'app' } });
        else await add({ kind: 'biomarker', payload: { day: d, type: 'cervix', value: { position: POS[o.k % 3], firmness: FIRM[o.k % 3], opening: OPEN[o.k % 3] }, source: 'app' } });
        break;
      }
      case 'cmark': await add({ kind: o.exclude ? 'cycle.exclude' : 'cycle.confirm_long', payload: { cycle_start: d || dayOf(1) } }); break;
      case 'life': {
        if (lifeUsed.has(o.kind)) break;
        lifeUsed.add(o.kind);
        await add({ kind: 'life_state.set', payload: { kind: o.kind, detail: {}, day: dayOf(o.s) } });
        if (o.e !== undefined) await add({ kind: 'life_state.end', payload: { kind: o.kind, day: dayOf(o.e), ...(o.kind === 'pregnant' && o.outcome ? { outcome: 'birth' } : {}) } });
        break;
      }
      case 'retract': if (rows.length > 0) rows.push(await store.retract((rows[o.at % rows.length] as { id: string }).id)); break;
    }
  }
}

/** The outcome of each closed span (the derived life_state table does not keep it): read from the end event that closed it. */
async function outcomes(db: Database, store: EventStore) {
  const ends = activeEvents(await store.events()).filter((e) => e.kind === 'life_state.end').map((e) => ({ day: e.effective_day, ...(JSON.parse(e.payload) as { kind: string; outcome?: string }) }));
  const spans = await db.all<{ kind: string; until_day: string }>('SELECT kind, until_day FROM life_state WHERE until_day IS NOT NULL ORDER BY from_day, kind');
  return spans.map((sp) => `${sp.kind}:${sp.until_day}:${ends.find((e) => e.kind === sp.kind && e.day === sp.until_day)?.outcome ?? ''}`);
}

async function tables(db: Database, store: EventStore) {
  const dl = (await db.all<{ day: string; flow: string | null; flow_kind: string | null; clots: number; symptoms: string; sex: string | null; energy: number | null; notes_cipher: Uint8Array | null }>('SELECT day, flow, flow_kind, clots, symptoms, sex, energy, notes_cipher FROM daily_log ORDER BY day'))
    // a day whose only trace was a cleared symptom or energy has no content to export (documented limit)
    .filter((r) => r.flow || r.sex || r.notes_cipher || r.energy || r.symptoms !== '[]')
    .map((r) => ({ ...r, notes_cipher: undefined, note: r.notes_cipher ? openNote(KEY, new TextDecoder().decode(r.notes_cipher)) : null }));
  const bio = (await db.all<{ day: string; type: string; value: string; source: string; disturbed: number }>('SELECT day, type, value, source, disturbed FROM biomarker')).map((b) => ({ ...b, value: JSON.parse(b.value) as unknown }));
  bio.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    cycle: await db.all('SELECT start_day, end_day, length_days, bleed_days, quality, ov_day, ov_basis FROM cycle ORDER BY start_day'),
    dl, bio,
    life: await db.all('SELECT kind, detail, from_day, until_day FROM life_state ORDER BY from_day, kind'),
    outcomes: await outcomes(db, store),
  };
}

describe('own-format round trip reproduces the projector (D-159)', () => {
  it('any history of flows, period marks, symptoms, biomarkers, life states, marks and retractions', async () => {
    await fc.assert(fc.asyncProperty(fc.array(op, { maxLength: 40 }), async (ops) => {
      const db = openTestDb();
      await migrate(db);
      const store = new EventStore(db, clock);
      await build(store, ops);
      const { data } = await exportSanguineData(db, store, { exportedAt: '2026-10-10T00:00:00Z', noteKey: KEY });
      const checked = validateSanguineData(JSON.parse(JSON.stringify(data)));
      expect(checked.problems).toEqual([]);
      const db2 = openTestDb();
      await migrate(db2);
      const store2 = new EventStore(db2, clock);
      await importSanguineData(db2, store2, checked.data, { sourceApp: 'sanguine', today: '2026-10-10', clock, noteKey: KEY });
      const a = await tables(db, store);
      const b = await tables(db2, store2);
      expect(b).toEqual(a);
    }), { seed: 20261124, numRuns: 300 });
  }, 120_000);
});

describe('documented limits of the round trip (docs/FORMAT.md "Round trip")', () => {
  const setup = async () => { const db = openTestDb(); await migrate(db); return { db, store: new EventStore(db, clock) }; };
  const out = async (db: Database, store: EventStore) => (await exportSanguineData(db, store, { exportedAt: '2026-10-10T00:00:00Z', noteKey: KEY })).data;
  it('one LH, mucus, cervix and pregnancy test per day: the latest is kept', async () => {
    const { db, store } = await setup();
    await store.append({ kind: 'biomarker', payload: { day: '2026-09-14', type: 'lh', value: { result: 'positive' }, source: 'strip' } });
    await store.append({ kind: 'biomarker', payload: { day: '2026-09-14', type: 'lh', value: { result: 'peak' }, source: 'strip' } });
    expect((await out(db, store)).days[0]?.lh).toBe('peak');
  });
  it('progesterone has no field and is left out', async () => {
    const { db, store } = await setup();
    await store.append({ kind: 'biomarker', payload: { day: '2026-09-14', type: 'progesterone', value: { ngMl: 12 }, source: 'lab' } });
    expect((await out(db, store)).days).toEqual([]);
  });
  it('a temperature source the format does not know comes back as the default for its type', async () => {
    const { db, store } = await setup();
    await store.append({ kind: 'biomarker', payload: { day: '2026-09-14', type: 'bbt', value: { valueC: 36.4 }, source: 'manual' } });
    expect((await out(db, store)).days[0]?.temperatures).toEqual([{ valueC: 36.4, type: 'bbt' }]);
  });
  it('a day with only a cleared symptom leaves no day in the file', async () => {
    const { db, store } = await setup();
    await store.append({ kind: 'symptom', payload: { day: '2026-09-14', code: 'acne', intensity: 1 } });
    await store.append({ kind: 'symptom', payload: { day: '2026-09-14', code: 'acne', intensity: 0 } });
    expect((await out(db, store)).days).toEqual([]);
  });
  it('two spans of one kind that start on the same day become one', async () => {
    const { db, store } = await setup();
    await store.append({ kind: 'life_state.set', payload: { kind: 'pregnant', detail: {}, day: '2026-01-01' } });
    await store.append({ kind: 'life_state.end', payload: { kind: 'pregnant', day: '2026-02-01' } });
    await store.append({ kind: 'life_state.set', payload: { kind: 'pregnant', detail: {}, day: '2026-01-01' } });
    const db2 = openTestDb();
    await migrate(db2);
    await importSanguineData(db2, new EventStore(db2, clock), await out(db, store), { sourceApp: 'sanguine', today: '2026-10-10', clock });
    expect(await db.all('SELECT until_day FROM life_state')).toHaveLength(2);
    expect(await db2.all('SELECT until_day FROM life_state')).toHaveLength(1);
  });
});
