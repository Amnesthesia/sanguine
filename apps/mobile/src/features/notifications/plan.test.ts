import { addDays, type EngineSettings, type History, type ISODate, predict } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, eventRange, planReminders, REMINDER_HOUR, reminderText } from './plan';

const S: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };
function hist(): History {
  const starts: ISODate[] = ['2026-09-30'];
  for (const l of [29, 28, 29, 28]) starts.unshift(addDays(starts[0] as ISODate, -l));
  return { cycles: starts.map((s, i) => ({ id: `c${i}`, start: s, quality: 'valid' as const })), temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
}
const today = '2026-10-01';
const p = predict(hist(), S, today);
const on = { enabled: true, late: false, descriptive: false, fertility: true, today, nowHour: 8 };

describe('planReminders (D-090)', () => {
  it('the defaults: 3 days before ovulation, 3 and 1 days before the period, at 09:00, earliest first', () => {
    const plans = planReminders(p, DEFAULT_RULES, on);
    const period = p.nextPeriod?.i80.lo as string;
    const ov = p.ovulation?.i80.lo as string;
    expect(plans.map((x) => [x.event, x.fireDate])).toEqual([['ovulation', addDays(ov, -3)], ['period', addDays(period, -3)], ['period', addDays(period, -1)]]);
    expect(plans.every((x) => x.hour === REMINDER_HOUR)).toBe(true);
    expect(plans[1]?.lo).toBe(3);
    expect(plans[2]?.lo).toBe(1);
    expect(plans[2]?.hi).toBeGreaterThan(1);
  });
  it('the fertile window counts back from its first likely day, and needs at least two days', () => {
    const plans = planReminders(p, [{ id: 'f', days: 2, event: 'fertile' }], on);
    expect(plans[0]?.fireDate).toBe(addDays(eventRange(p, 'fertile')?.lo as string, -2));
    expect(eventRange({ ...p, fertileDays: [{ date: '2026-10-12', pInWindow: 0.9 }] }, 'fertile')).toBeUndefined();
  });
  it('no ovulation or fertile reminders without the fertility tools (under 18, or the estimate hidden)', () => {
    expect(planReminders(p, DEFAULT_RULES, { ...on, fertility: false }).map((x) => x.event)).toEqual(['period', 'period']);
  });
  it('nothing when off, paused, without a prediction, or when the moment has passed', () => {
    expect(planReminders(p, DEFAULT_RULES, { ...on, enabled: false })).toEqual([]);
    expect(planReminders(undefined, DEFAULT_RULES, on)).toEqual([]);
    const paused = predict(hist(), { ...S, lifeStates: [{ kind: 'pregnant', since: '2026-09-01' }] }, today);
    expect(planReminders(paused, DEFAULT_RULES, on)).toEqual([]);
    const fire = addDays(p.nextPeriod?.i80.lo as string, -1);
    const one = [{ id: 'x', days: 1, event: 'period' as const }];
    expect(planReminders(p, one, { ...on, today: addDays(fire, 1) })).toEqual([]);
    expect(planReminders(p, one, { ...on, today: fire, nowHour: 10 })).toEqual([]);
    expect(planReminders(p, one, { ...on, today: fire, nowHour: 8 })[0]?.fireDate).toBe(fire);
  });
});

describe('late period (D-090)', () => {
  it('fires the morning after the 80% range ends, once, and not once that day has passed', () => {
    const hi = p.nextPeriod?.i80.hi as string;
    const late = planReminders(p, [], { ...on, late: true });
    expect(late).toEqual([{ id: 'late', event: 'late', fireDate: addDays(hi, 1), hour: REMINDER_HOUR, descriptive: false, lo: 0, hi: 0 }]);
    expect(planReminders(p, [], { ...on, late: true, today: addDays(hi, 2) })).toEqual([]);
    expect(planReminders(p, [], { ...on, late: false })).toEqual([]);
    expect(reminderText(late[0] as never).key).toBe('notifications.body.late');
  });
});

describe('reminderText', () => {
  it('a range of days, or "from today" when the range starts on the day', () => {
    expect(reminderText({ event: 'period', lo: 3, hi: 8 })).toEqual({ key: 'notifications.body.period', params: { lo: 3, hi: 8 } });
    expect(reminderText({ event: 'ovulation', lo: 0, hi: 4 })).toEqual({ key: 'notifications.body.ovulationNow', params: { hi: 4 } });
  });
});
