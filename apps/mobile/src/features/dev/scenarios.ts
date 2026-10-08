// Development-only data scenarios (PLAN.md §9.6 sample content), relative to "today" so screens always show the same numbers.
import { addDays, type ISODate } from '@sanguine/engine';
import type { NewEvent } from '@/data/events';
import type { Profile } from '@/data/project';

export type ScenarioName = 'empty' | 'typical' | 'inProgress' | 'irregular' | 'skippedLog';
export const SCENARIOS: ScenarioName[] = ['empty', 'typical', 'inProgress', 'irregular', 'skippedLog'];

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
