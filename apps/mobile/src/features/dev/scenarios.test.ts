import { predict } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { SCENARIOS, scenario } from './scenarios';

async function load(name: Parameters<typeof scenario>[0], today = '2026-10-10') {
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  const store = new EventStore(db, { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) });
  const s = scenario(name, today);
  await store.setProfile(s.profile);
  await store.appendMany(s.events);
  const { history, settings } = await store.engineInputs();
  return { prediction: predict(history, settings, today), history };
}

describe('dev scenarios', () => {
  it('all names are covered', () => expect(SCENARIOS).toEqual(['empty', 'typical', 'inProgress', 'irregular', 'skippedLog', 'pattern', 'pregnant']));
  it('typical: cycle day 11, cycles of 28 and 29 days, a fair-estimate next period', async () => {
    const { prediction: p, history } = await load('typical');
    expect(p.currentPhase?.dayOfCycle).toBe(11);
    expect(history.cycles).toHaveLength(3);
    expect(p.nextPeriod?.confidence).toBe('medium');
    expect(history.temperatures).toHaveLength(1);
  });
  it('inProgress: day 2 of a period', async () => {
    const { prediction: p } = await load('inProgress');
    expect(p.currentPhase).toEqual({ phase: 'menstrual', dayOfCycle: 2 });
  });
  it('irregular: the variability flag and a rough next-period estimate', async () => {
    const { prediction: p } = await load('irregular');
    expect(p.flags.map((f) => f.code)).toEqual(['variability']);
    expect(p.nextPeriod?.confidence).toBe('low');
  });
  it('skippedLog: the 56-day cycle is suspect', async () => {
    const { prediction: p } = await load('skippedLog');
    expect(p.cycleQuality.filter((c) => c.quality === 'suspect_skip')).toHaveLength(1);
  });
  it('empty has no cycles', async () => expect((await load('empty')).history.cycles).toEqual([]));
});
