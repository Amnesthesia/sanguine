import { predict, type EngineSettings, type History } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { flagContext, loadFlagState, MUTE_DAYS, muteFlag, recordRaised } from './flagState';
import { migrate } from './migrate';
import { openTestDb } from './testDb';

const S: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };
const lens = [24, 38, 31, 45, 27, 36];
function irregular(): History {
  const starts = ['2026-10-01'];
  for (let i = lens.length - 1; i >= 0; i--) {
    const d = new Date(`${starts[0]}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (lens[i] as number));
    starts.unshift(d.toISOString().slice(0, 10));
  }
  return { cycles: starts.map((s, i) => ({ id: `c${i}`, start: s, quality: 'valid' as const })), temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
}

describe('flag state', () => {
  it('mutes for 90 days and keeps raisedOn stable', async () => {
    const db = openTestDb();
    await migrate(db);
    const h = irregular();
    let st = await loadFlagState(db);
    const first = predict({ ...h, ...flagContext(st) }, S, '2026-10-10');
    expect(first.flags.map((f) => f.code)).toEqual(['variability']);
    expect(first.flags[0]?.raisedOn).toBe('2026-10-10');
    await recordRaised(db, first.flags, st);
    st = await loadFlagState(db);
    const later = predict({ ...h, ...flagContext(st) }, S, '2026-10-20');
    expect(later.flags[0]?.raisedOn).toBe('2026-10-10'); // not re-announced
    await muteFlag(db, 'variability', '2026-10-20');
    st = await loadFlagState(db);
    expect(st.muted.variability).toBe('2027-01-18');
    expect(predict({ ...h, ...flagContext(st) }, S, '2026-11-01').flags).toEqual([]);
    expect(MUTE_DAYS).toBe(90);
    expect(predict({ ...h, ...flagContext(st) }, S, '2027-01-19').flags.map((f) => f.code)).toContain('variability'); // mute over (the missed-period flag also applies by then)
  });
  it('recordRaised reports no change when nothing is new', async () => {
    const db = openTestDb();
    await migrate(db);
    expect(await recordRaised(db, [], await loadFlagState(db))).toBe(false);
  });
});
