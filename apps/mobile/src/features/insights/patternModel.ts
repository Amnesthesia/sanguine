// Cycle-pattern view while the perimenopause life state is set (P8-4, roadmap R3-1). Descriptive counts of the user's own logs against the
// two published STRAW+10 markers (a difference of 7 days or more between consecutive cycles; 60 days or more without a period). No stage
// label and no "12 months" milestone (DECISIONS: they would act as an assessment). Symptoms here never feed the engine.
import { type CycleRecord, type DailyLog, diffDays, type EngineSettings, type ISODate } from '@sanguine/engine';

export const PATTERN_SYMPTOMS = ['hot_flushes', 'night_sweats', 'insomnia'] as const;
const WINDOW = 10; // closed cycles looked at
const LONG_DAYS = 60;
const CHANGE_DAYS = 7;
/** ponytail: stage labels stay off; a reviewer turning this on needs copy and a decision record first (D-081). */
export const SHOW_TRANSITION_STAGE = false;

export interface CyclePattern {
  lengths: number[];
  spread: { min: number; max: number } | undefined;
  longCycles: number;
  changes7: number;
  daysSinceStart: number | undefined;
  symptoms: Array<{ code: (typeof PATTERN_SYMPTOMS)[number]; last4w: number; last12w: number }>;
}

export function cyclePattern(cycles: CycleRecord[], logs: DailyLog[], today: ISODate): CyclePattern {
  const sorted = [...cycles].sort((a, b) => (a.start < b.start ? -1 : 1));
  const lengths = sorted.filter((c) => c.length !== undefined).slice(-WINDOW).map((c) => c.length as number);
  const last = sorted[sorted.length - 1];
  const symptoms = PATTERN_SYMPTOMS.map((code) => {
    const days = logs.filter((l) => l.symptoms?.some((s) => s.code === code)).map((l) => diffDays(today, l.date)).filter((d) => d >= 0);
    return { code, last4w: days.filter((d) => d < 28).length, last12w: days.filter((d) => d < 84).length };
  });
  return {
    lengths,
    spread: lengths.length ? { min: Math.min(...lengths), max: Math.max(...lengths) } : undefined,
    longCycles: lengths.filter((l) => l >= LONG_DAYS).length,
    changes7: lengths.slice(1).filter((l, i) => Math.abs(l - (lengths[i] as number)) >= CHANGE_DAYS).length,
    daysSinceStart: last ? diffDays(today, last.start) : undefined,
    symptoms,
  };
}

export const inPatternState = (states: EngineSettings['lifeStates'], today: ISODate): boolean =>
  states.some((s) => s.kind === 'perimenopause' && s.since <= today && (s.until === undefined || s.until >= today));
