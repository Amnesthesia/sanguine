// Look-back note on Today (P8-11, D-087, amends C-10): which of the user's own symptoms she logged around this cycle day in her
// past cycles. Reads closed valid cycles and daily logs only; never feeds the engine and never forecasts.
import { addDays, type CycleRecord, type DailyLog, type ISODate } from '@sanguine/engine';
import type { TodayModel } from './todayModel';

/** Physical, non-intimate codes only (D-087): no mood, libido, bowel, bleeding or mid-cycle codes on a screen others may glance at. */
export const NOTE_SYMPTOMS: ReadonlySet<string> = new Set([
  'cramps', 'headache', 'bloating', 'breast_tenderness', 'acne', 'fatigue', 'back_pain', 'joint_pain', 'pelvic_pain',
  'nausea', 'dizziness', 'insomnia', 'food_cravings', 'appetite_increase', 'oily_skin', 'puffiness', 'smell_sensitivity',
]);
const LOOKBACK = 6; // closed cycles looked at
const MIN_CYCLES = 3;
const MIN_HITS = 3;
const MIN_SHARE = 0.5;
const WINDOW = 1; // cycle day ±1
const MAX_LINES = 2;

export interface NoteLine { code: string; hits: number; cycles: number }

// ponytail: aligned by cycle day from the start; luteal symptoms in irregular cycles drift. Upgrade path: align closed cycles by
// days before nextStart when today sits inside the next-period interval.
export function symptomNote(cycles: CycleRecord[], logs: DailyLog[], dayOfCycle: number | undefined): NoteLine[] {
  if (dayOfCycle === undefined) return [];
  const past = cycles
    .filter((c) => c.quality === 'valid' && c.length !== undefined && c.nextStart !== undefined)
    .sort((a, b) => (a.start < b.start ? -1 : 1))
    .slice(-LOOKBACK);
  if (past.length < MIN_CYCLES) return [];
  const byDay = new Map<ISODate, string[]>();
  for (const l of logs) {
    const codes = (l.symptoms ?? []).map((s) => s.code).filter((c) => NOTE_SYMPTOMS.has(c));
    if (codes.length) byDay.set(l.date, [...(byDay.get(l.date) ?? []), ...codes]);
  }
  const hits = new Map<string, number>();
  for (const c of past) {
    const seen = new Set<string>();
    for (let d = Math.max(1, dayOfCycle - WINDOW); d <= Math.min(c.length as number, dayOfCycle + WINDOW); d++)
      for (const code of byDay.get(addDays(c.start, d - 1)) ?? []) seen.add(code);
    for (const code of seen) hits.set(code, (hits.get(code) ?? 0) + 1);
  }
  return [...hits]
    .filter(([, h]) => h >= MIN_HITS && h / past.length >= MIN_SHARE)
    .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1))
    .slice(0, MAX_LINES)
    .map(([code, h]) => ({ code, hits: h, cycles: past.length }));
}

/** The note shows only on an ordinary Today: not empty, suspended (pregnant, hormonal) or late, and only if the user leaves it on. */
export const noteDay = (on: boolean, state: TodayModel['state'], dayOfCycle: number | undefined): number | undefined =>
  on && (state === 'predicted' || state === 'inProgress') ? dayOfCycle : undefined;
