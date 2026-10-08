import { describe, expect, it } from 'vitest';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { changeLifeState, currentLifeStates, lifeStateHistory } from './lifeState';

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
