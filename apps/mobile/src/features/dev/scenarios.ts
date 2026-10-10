// Development-only data scenarios (PLAN.md §9.6 sample content), relative to "today" so screens always show the same numbers.
import { addDays, type ISODate } from '@sanguine/engine';
import type { NewEvent } from '@/data/events';
import type { Profile } from '@/data/project';

export type ScenarioName = 'empty' | 'typical' | 'inProgress' | 'irregular' | 'skippedLog' | 'pattern' | 'pregnant' | 'lookback' | 'lunar' | 'shortCycle';
export const SCENARIOS: ScenarioName[] = ['empty', 'typical', 'inProgress', 'irregular', 'skippedLog', 'pattern', 'pregnant', 'lookback', 'lunar', 'shortCycle'];

const period = (start: ISODate, bleed = 4, level: 'light' | 'medium' | 'heavy' = 'medium'): NewEvent[] =>
  Array.from({ length: bleed }, (_, i) => ({ kind: 'flow', payload: { day: addDays(start, i), level, flow_kind: 'period' } }));

/** Start dates oldest first from the last start and the cycle lengths (oldest first). */
function startsFrom(last: ISODate, lengths: number[]): ISODate[] {
  const out: ISODate[] = [last];
  for (let i = lengths.length - 1; i >= 0; i--) out.unshift(addDays(out[0] as ISODate, -(lengths[i] as number)));
  return out;
}

export function scenario(name: ScenarioName, today: ISODate): { profile: Profile; events: NewEvent[] } {
  const profile: Profile = { birthYear: Number(today.slice(0, 4)) - 34 };
  if (name === 'empty') return { profile: { birthYear: profile.birthYear as number }, events: [] };

  if (name === 'irregular') {
    const starts = startsFrom(addDays(today, -15), [24, 38, 31, 45, 27, 36]);
    return { profile, events: starts.flatMap((s) => period(s, 5)) };
  }
  if (name === 'skippedLog') {
    // PLAN.md fixture B: one 56-day cycle that is probably a missed log
    const starts = startsFrom(addDays(today, -12), [27, 29, 56, 28, 30, 28]);
    return { profile, events: starts.flatMap((s) => period(s, 4)) };
  }
  if (name === 'pattern') {
    // P8-4: age 47, the perimenopause life state, cycles that vary, vasomotor symptoms logged
    const starts = startsFrom(addDays(today, -40), [27, 34, 25, 63, 29, 22]);
    const lifeState: NewEvent = { kind: 'life_state.set', payload: { kind: 'perimenopause', detail: {}, day: addDays(today, -200) } };
    const days = [-1, -3, -9, -20, -50];
    return { profile: { birthYear: Number(today.slice(0, 4)) - 47 }, events: [...starts.flatMap((s) => period(s, 5)), lifeState,
      ...days.map((d): NewEvent => ({ kind: 'symptom', payload: { day: addDays(today, d), code: 'hot_flushes', intensity: 2 } })),
      { kind: 'symptom', payload: { day: addDays(today, -2), code: 'night_sweats', intensity: 2 } }] };
  }
  if (name === 'shortCycle') {
    // P8-13 item 5 (D-094): regular 28-day cycles, then bleeding two days ago only 16 days after the last period
    const starts = startsFrom(addDays(today, -2), [28, 29, 28, 28, 16]);
    return { profile, events: [...starts.slice(0, -1).flatMap((s) => period(s, 5)), ...period(starts.at(-1) as ISODate, 3, 'light')] };
  }
  if (name === 'lunar') {
    // D-089: seven very regular cycles of 29 and 30 days, close to a lunar month
    const starts = startsFrom(addDays(today, -8), [30, 29, 30, 29, 30, 29, 30]);
    return { profile, events: starts.flatMap((s) => period(s, 5)) };
  }
  if (name === 'pregnant') {
    // P8-5: pregnancy set 3 weeks ago, last period start 7 weeks ago
    const starts = startsFrom(addDays(today, -49), [28, 29]);
    return { profile, events: [...starts.flatMap((s) => period(s, 4)), { kind: 'life_state.set', payload: { kind: 'pregnant', detail: {}, day: addDays(today, -21) } }] };
  }
  if (name === 'lookback') {
    // P8-11: day 2 today; cramps around day 2 in 3 of 4 past cycles; mood_low every cycle (excluded code, must not show); headache once
    const starts = startsFrom(addDays(today, -1), [28, 29, 27, 28]);
    const past = starts.slice(0, -1);
    return { profile, events: [
      ...past.flatMap((s) => period(s, 4)), ...period(starts.at(-1) as ISODate, 2),
      ...past.slice(0, 3).map((s): NewEvent => ({ kind: 'symptom', payload: { day: addDays(s, 1), code: 'cramps', intensity: 2 } })),
      ...past.map((s): NewEvent => ({ kind: 'symptom', payload: { day: addDays(s, 1), code: 'mood_low', intensity: 2 } })),
      { kind: 'symptom', payload: { day: addDays(past[0] as ISODate, 1), code: 'headache', intensity: 1 } },
    ] };
  }
  if (name === 'inProgress') {
    const starts = startsFrom(addDays(today, -1), [28, 29]);
    return { profile, events: [...starts.slice(0, -1).flatMap((s) => period(s, 4)), ...period(starts.at(-1) as ISODate, 2)] };
  }
  // typical: day 11 today, cycles of 28 and 29 days (§9.6)
  const starts = startsFrom(addDays(today, -10), [28, 29]);
  const last = starts.at(-1) as ISODate;
  const events: NewEvent[] = [
    ...starts.flatMap((s) => period(s, 4)),
    { kind: 'symptom', payload: { day: last, code: 'cramps', intensity: 2 } },
    { kind: 'symptom', payload: { day: last, code: 'headache', intensity: 1 } },
    { kind: 'symptom', payload: { day: addDays(last, 1), code: 'cramps', intensity: 1 } },
    { kind: 'symptom', payload: { day: addDays(today, -1), code: 'bloating', intensity: 2 } },
    { kind: 'biomarker', payload: { day: today, type: 'bbt', value: { valueC: 36.42 }, source: 'oral', measured_at: `${today}T06:40:00+10:00` } },
  ];
  return { profile, events };
}
