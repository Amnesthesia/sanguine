import { addDays, type EngineSettings, type History, type ISODate, predict } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { planReminder, REMINDER_HOUR } from './plan';

const S: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };
function hist(): History {
  const starts: ISODate[] = ['2026-09-30'];
  for (const l of [29, 28]) starts.unshift(addDays(starts[0] as ISODate, -l));
  return { cycles: starts.map((s, i) => ({ id: `c${i}`, start: s, quality: 'valid' as const })), temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
}
const today = '2026-10-10';
const p = predict(hist(), S, today);

describe('planReminder', () => {
  it('fires the day before the 80% range starts, at 09:00, with the days until the range', () => {
    const plan = planReminder(p, true, false, today, 8);
    const lo = p.nextPeriod?.i80.lo as string;
    expect(plan?.fireDate).toBe(addDays(lo, -1));
    expect(plan?.hour).toBe(REMINDER_HOUR);
    expect(plan?.lo).toBe(1);
    expect(plan?.hi).toBeGreaterThan(plan?.lo ?? 99);
    expect(plan?.descriptive).toBe(false);
  });
  it('nothing when off, paused, without a prediction, or when the moment has passed', () => {
    expect(planReminder(p, false, false, today, 8)).toBeUndefined();
    expect(planReminder(undefined, true, false, today, 8)).toBeUndefined();
    const paused = predict(hist(), { ...S, lifeStates: [{ kind: 'pregnant', since: '2026-09-01' }] }, today);
    expect(planReminder(paused, true, false, today, 8)).toBeUndefined();
    const fire = addDays(p.nextPeriod?.i80.lo as string, -1);
    expect(planReminder(p, true, false, addDays(fire, 1), 8)).toBeUndefined();
    expect(planReminder(p, true, false, fire, 10)).toBeUndefined();
    expect(planReminder(p, true, false, fire, 8)?.fireDate).toBe(fire);
  });
});
