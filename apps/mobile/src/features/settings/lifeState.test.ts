import { describe, expect, it } from 'vitest';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { addPastPregnancy, changeLifeState, choiceOf, currentLifeStates, lifeStateHistory } from './lifeState';

async function setup() {
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  const store = new EventStore(db, { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) });
  return { db, store };
}

describe('changeLifeState', () => {
  it('sets a state, then replaces it: the old one gets an end day, the new one starts', async () => {
    const { db, store } = await setup();
    await changeLifeState(store, db, { choice: 'hormonal', day: '2026-01-01', method: 'implant' });
    await changeLifeState(store, db, { choice: 'postHormonal', day: '2026-09-01', method: 'implant' });
    const rows = await lifeStateHistory(db);
    expect(rows.map((r) => [r.kind, r.from_day, r.until_day])).toEqual([['hormonal_contraception', '2026-01-01', '2026-09-01'], ['post_contraception', '2026-09-01', null]]);
    expect(rows[0]?.detail).toEqual({ method: 'implant' });
    expect(currentLifeStates(rows, '2026-10-10').map((r) => r.kind)).toEqual(['post_contraception']);
  });
  it('"none" ends the open states and sets nothing', async () => {
    const { db, store } = await setup();
    await changeLifeState(store, db, { choice: 'perimenopause', day: '2026-01-01' });
    await changeLifeState(store, db, { choice: 'none', day: '2026-10-01' });
    expect(currentLifeStates(await lifeStateHistory(db), '2026-10-10')).toEqual([]);
  });
  it('postpartum keeps the breastfeeding detail and feeds the engine settings', async () => {
    const { db, store } = await setup();
    await changeLifeState(store, db, { choice: 'postpartum', day: '2026-08-01', breastfeeding: true });
    expect((await store.engineInputs()).settings.lifeStates).toEqual([{ kind: 'postpartum', delivered: '2026-08-01', breastfeeding: true }]);
  });
  it('is a no-op when nothing is open and "none" is chosen', async () => {
    const { db, store } = await setup();
    await changeLifeState(store, db, { choice: 'none', day: '2026-10-01' });
    expect(await store.events()).toEqual([]);
  });
});

describe('pregnancy outcome (P3-12, D-053)', () => {
  it('"after a pregnancy loss" ends the pregnancy with outcome loss and pauses estimates until the next period', async () => {
    const { db, store } = await setup();
    await changeLifeState(store, db, { choice: 'pregnant', day: '2026-01-10' });
    await changeLifeState(store, db, { choice: 'afterLoss', day: '2026-03-01' });
    const ends = (await store.events()).filter((e) => e.kind === 'life_state.end').map((e) => JSON.parse(e.payload));
    expect(ends).toEqual([{ kind: 'pregnant', day: '2026-03-01', outcome: 'loss' }]);
    const rows = await lifeStateHistory(db);
    expect(rows.map((r) => [r.kind, r.from_day, r.until_day])).toEqual([['pregnant', '2026-01-10', '2026-03-01'], ['postpartum', '2026-03-01', null]]);
    expect(rows[1]?.detail).toEqual({ breastfeeding: false, after: 'loss' });
    expect(choiceOf(rows[1] as never)).toBe('afterLoss');
    expect((await store.engineInputs()).settings.lifeStates.at(-1)).toEqual({ kind: 'postpartum', delivered: '2026-03-01', breastfeeding: false });
  });
  it('"recently gave birth" after pregnant records outcome birth', async () => {
    const { db, store } = await setup();
    await changeLifeState(store, db, { choice: 'pregnant', day: '2026-01-10' });
    await changeLifeState(store, db, { choice: 'postpartum', day: '2026-09-20', breastfeeding: true });
    const end = (await store.events()).find((e) => e.kind === 'life_state.end');
    expect(JSON.parse(end?.payload ?? '{}')).toMatchObject({ outcome: 'birth' });
    expect(choiceOf((await lifeStateHistory(db))[1] as never)).toBe('postpartum');
  });
  it('a past pregnancy turns the long cycle and the bleed that ended it into paused cycles, not possible missed logs', async () => {
    const { db, store } = await setup();
    for (const d of ['2025-01-01', '2025-01-29', '2025-02-26', '2025-03-26', '2025-12-01', '2026-01-02', '2026-01-30']) await store.append({ kind: 'flow', payload: { day: d, level: 'medium', flow_kind: 'period' } });
    const quality = async () => (await db.all<{ start_day: string; quality: string }>('SELECT start_day, quality FROM cycle ORDER BY start_day')).map((c) => c.quality);
    expect((await quality())[3]).toBe('suspect_skip'); // 250 days
    await addPastPregnancy(store, { from: '2025-03-26', until: '2025-12-01', outcome: 'loss' });
    expect(await quality()).toEqual(['valid', 'valid', 'valid', 'life_state', 'life_state', 'valid', 'valid']);
  });
  it('a marked past pregnancy never displaces the current state in Settings', async () => {
    const { db, store } = await setup();
    await changeLifeState(store, db, { choice: 'hormonal', day: '2026-01-01', method: 'implant' });
    await addPastPregnancy(store, { from: '2024-03-01', until: '2024-10-20', outcome: 'loss' });
    expect(currentLifeStates(await lifeStateHistory(db), '2026-10-10')[0]?.kind).toBe('hormonal_contraception');
  });
});
