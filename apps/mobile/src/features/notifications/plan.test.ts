import { addDays, analyzeCycles, diffDays, type EngineSettings, type History, type ISODate, predict } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { phaseOn } from '@/features/guidance/guidance';
import { cleanText, DEFAULT_RULES, eventRange, MAX_TEXT, planReminders, REMINDER_HOUR, reminderBody, type ReminderRule, reminderText } from './plan';

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

describe('phase reminders (D-152)', () => {
  // four completed 28-29 day cycles, the open one started 2026-09-30: today is cycle day 2, follicular starts after the bleed
  const settings = S;
  const cycles = analyzeCycles(hist(), settings).map((c) => c.record);
  const phase = { cycles, showEstimate: true };
  const D = (event: ReminderRule['event'], days = 0): ReminderRule => ({ id: `${event}-${days}`, days, event });
  const runDays = (want: string): string[] => {
    const out: string[] = [];
    for (let i = 0; i < 70; i++) {
      const d = addDays('2026-09-30', i);
      const g = phaseOn({ date: d, today, prediction: p, cycles, showEstimate: true });
      if (g && (want === 'follicular' ? g.phase === 'follicular' : g.phase === 'luteal' || g.phase === 'premenstrual')) out.push(d);
    }
    return out;
  };
  it('early is the first half of the follicular run, late the second, and the pair covers the run with no gap', () => {
    const run = runDays('follicular');
    expect(run.length).toBeGreaterThanOrEqual(4);
    const early = eventRange(p, 'follicularEarly', { ...phase, today });
    const late = eventRange(p, 'follicularLate', { ...phase, today });
    expect(early?.lo).toBe(run[0]);
    expect(late?.hi).toBe(run[run.length - 1]);
    expect(addDays(early?.hi as string, 1)).toBe(late?.lo);
    expect(late?.lo).toBe(run[Math.floor(run.length / 2)]); // the midpoint belongs to late
  });
  it('the luteal run starts the day after ovulation, or on it when the estimate is hidden', () => {
    const shown = eventRange(p, 'lutealEarly', { ...phase, today })?.lo as string;
    const hidden = eventRange(p, 'lutealEarly', { cycles, showEstimate: false, today })?.lo as string;
    expect(diffDays(shown, hidden)).toBe(2); // the ovulatory day and one either side are follicular/luteal again
  });
  it('nothing for a late period or a suspended prediction', () => {
    const lateToday = addDays(p.nextPeriod?.i80.hi as string, 3);
    expect(planReminders(predict(hist(), S, lateToday), [D('lutealLate'), D('follicularLate')], { ...on, today: lateToday, phase })).toEqual([]);
    const paused = predict(hist(), { ...S, lifeStates: [{ kind: 'pregnant', since: '2026-09-01' }] }, today);
    expect(planReminders(paused, [D('lutealLate')], { ...on, phase })).toEqual([]);
  });
  it('luteal runs from the day after ovulation to the end of the premenstrual days', () => {
    const run = runDays('luteal');
    expect(run.length).toBeGreaterThanOrEqual(4);
    expect(eventRange(p, 'lutealEarly', { ...phase, today })?.lo).toBe(run[0]);
    expect(eventRange(p, 'lutealLate', { ...phase, today })?.hi).toBe(run[run.length - 1]);
  });
  it('fires on the first day of the half, 09:00, and counts back N days', () => {
    const lo = eventRange(p, 'lutealLate', { ...phase, today })?.lo as string;
    const plans = planReminders(p, [D('lutealLate'), D('lutealLate', 2)], { ...on, phase });
    expect(plans.map((x) => [x.event, x.fireDate, x.hour])).toEqual([['lutealLate', addDays(lo, -2), 9], ['lutealLate', lo, 9]]);
  });
  it('nothing without a phase context, while the ovulation estimate is uncertain, or once the half has started', () => {
    expect(planReminders(p, [D('follicularLate')], on)).toEqual([]);
    const wide = { ...p, ovulation: p.ovulation && { ...p.ovulation, i80: { lo: addDays(p.ovulation.i80.lo, -8), hi: addDays(p.ovulation.i80.hi, 8) } } };
    expect(planReminders(wide, [D('lutealEarly'), D('follicularEarly')], { ...on, phase })).toEqual([]);
    const lo = eventRange(p, 'lutealEarly', { ...phase, today })?.lo as string;
    expect(planReminders(p, [D('lutealEarly')], { ...on, today: addDays(lo, 1), phase })).toEqual([]);
  });
  it('are not fertility events: they survive the fertility gate and the hidden estimate', () => {
    const plans = planReminders(p, [D('follicularLate'), D('lutealEarly')], { ...on, fertility: false, phase: { cycles, showEstimate: false } });
    expect(plans.map((x) => x.event).sort()).toEqual(['follicularLate', 'lutealEarly']);
  });
  it('the defaults start the follicular and the luteal phase', () => {
    expect(DEFAULT_RULES.map((r) => `${r.event}:${r.days}`)).toEqual(['follicularEarly:0', 'ovulation:3', 'lutealEarly:0', 'period:3', 'period:1']);
    expect(planReminders(p, DEFAULT_RULES, { ...on, phase }).map((x) => x.event)).toEqual(expect.arrayContaining(['follicularEarly', 'lutealEarly']));
  });
});

describe('own text and the body (D-152)', () => {
  const t = (k: string) => k;
  const base = { id: 'x', event: 'period' as const, fireDate: '2026-10-10', hour: 9, descriptive: false, lo: 3, hi: 8 };
  it('own text is trimmed, cut at the limit and dropped when empty', () => {
    expect(cleanText('  hello ')).toBe('hello');
    expect(cleanText('   ')).toBeUndefined();
    expect(cleanText(undefined)).toBeUndefined();
    expect(cleanText('a'.repeat(300))).toHaveLength(MAX_TEXT);
  });
  it('a plan carries the rule text, and a blank text is not carried', () => {
    const lo = eventRange(p, 'period')?.lo as string;
    const plans = planReminders(p, [{ id: 'a', days: 1, event: 'period', text: ' Breathe. ' }, { id: 'b', days: 2, event: 'period', text: ' ' }], on);
    expect(plans.find((x) => x.id === 'a')?.text).toBe('Breathe.');
    expect('text' in (plans.find((x) => x.id === 'b') as object)).toBe(false);
    expect(plans.find((x) => x.id === 'a')?.fireDate).toBe(addDays(lo, -1));
  });
  it('own text shows even with details off; then details; then the discreet default', () => {
    expect(reminderBody({ ...base, text: 'Be kind to yourself' }, t)).toBe('Be kind to yourself');
    expect(reminderBody({ ...base, descriptive: true }, t)).toBe('notifications.body.period');
    expect(reminderBody(base, t)).toBe('notifications.defaultBody');
  });
  it('a phase reminder\'s discreet default is the feeling check-in, and its details name the phase', () => {
    expect(reminderBody({ ...base, event: 'lutealLate' }, t)).toBe('notifications.discreetBody.phase');
    expect(reminderBody({ ...base, event: 'lutealLate', descriptive: true }, t)).toBe('notifications.body.lutealLate');
    expect(reminderText({ event: 'follicularEarly', lo: 0, hi: 3 })).toEqual({ key: 'notifications.body.follicularEarly', params: {} });
  });
});
