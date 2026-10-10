// View-models for Insights (PLAN.md §8.3): history rows, the cycle-length chart, symptom-by-phase bars and accuracy text.
import { addDays, type CycleRecord, type DailyLog, diffDays, type ISODate, studentTQuantile } from '@sanguine/engine';
import type { LedgerSummary } from '@/data/ledger';
import { formatDay, formatMonthShort } from '@/ui/format';

export interface HistoryRow {
  id: string;
  start: string;
  startISO: ISODate;
  lengthDays: number | undefined;
  dayOfCycle: number | undefined;
  bleedDays: number | undefined;
  basis: string;
  quality: CycleRecord['quality'];
  current: boolean;
  /** An unusually long cycle: offer "Was there a period in between?", "I was pregnant" and "this was this long" (D-053). */
  offerMissedLog: boolean;
  nextStartISO: ISODate | undefined;
  midDay: ISODate | undefined;
}

export function historyRows(cycles: CycleRecord[], today: ISODate): HistoryRow[] {
  return [...cycles].sort((a, b) => (a.start < b.start ? 1 : -1)).map((c) => ({
    id: c.id, start: formatDay(c.start), startISO: c.start, lengthDays: c.length,
    dayOfCycle: c.length === undefined ? diffDays(today, c.start) + 1 : undefined, bleedDays: c.bleedDays,
    basis: c.ovulation && c.ovulation.basis !== 'calendar' ? c.ovulation.basis : 'calendar', quality: c.quality,
    current: c.nextStart === undefined, nextStartISO: c.nextStart,
    offerMissedLog: c.quality === 'suspect_skip' && c.length !== undefined,
    midDay: c.quality === 'suspect_skip' && c.length !== undefined ? addDays(c.start, Math.round(c.length / 2)) : undefined,
  }));
}

export interface LengthSeries { points: Array<{ start: ISODate; length: number }>; band: { lo: number; hi: number } | undefined }
const MAX_POINTS = 12;

export function cycleLengthSeries(cycles: CycleRecord[], model: { mean: number; nu: number; scale: number } | undefined): LengthSeries {
  const points = cycles.filter((c) => c.quality === 'valid' && c.length !== undefined).slice(-MAX_POINTS).map((c) => ({ start: c.start, length: c.length as number }));
  const band = model ? (() => { const q = studentTQuantile(0.9, model.nu) * model.scale; return { lo: model.mean - q, hi: model.mean + q }; })() : undefined;
  return { points, band };
}

export type Phase = 'menstrual' | 'follicular' | 'luteal';
export interface PhaseBar { code: string; share: Record<Phase, number> }
const PHASES: Phase[] = ['menstrual', 'follicular', 'luteal'];
const LUTEAL_FALLBACK_DAYS = 13; // only to draw the bars when no biomarker dated ovulation: cycle length minus ~13

/** Share of logged days with each of the two most frequent symptoms, per phase. A pattern in the person's own logs; it never feeds the engine. */
export function phaseBars(cycles: CycleRecord[], logs: DailyLog[], today: ISODate): PhaseBar[] {
  const use = cycles.filter((c) => c.quality === 'valid');
  const phaseOf = (d: ISODate): Phase | undefined => {
    const c = [...use].reverse().find((x) => x.start <= d && (x.nextStart === undefined ? diffDays(today, x.start) < 90 : d < x.nextStart));
    if (!c) return undefined;
    const off = diffDays(d, c.start);
    const bleed = c.bleedDays ?? (c.end ? diffDays(c.end, c.start) + 1 : 5);
    if (off < bleed) return 'menstrual';
    const ov = c.ovulation ? (c.ovulation.offset ?? diffDays(c.ovulation.point, c.start)) : c.length ? c.length - LUTEAL_FALLBACK_DAYS : undefined;
    return ov === undefined || off <= ov ? 'follicular' : 'luteal';
  };
  const total: Record<Phase, number> = { menstrual: 0, follicular: 0, luteal: 0 };
  const counts = new Map<string, Record<Phase, number>>();
  for (const l of logs) {
    const ph = phaseOf(l.date);
    if (!ph) continue;
    total[ph]++;
    for (const s of l.symptoms ?? []) {
      const c = counts.get(s.code) ?? { menstrual: 0, follicular: 0, luteal: 0 };
      c[ph]++;
      counts.set(s.code, c);
    }
  }
  const top = [...counts.entries()].sort(([a, x], [b, y]) => PHASES.reduce((s, p) => s + y[p], 0) - PHASES.reduce((s, p) => s + x[p], 0) || (a < b ? -1 : 1)).slice(0, 2);
  return top.map(([code, c]) => ({ code, share: { menstrual: total.menstrual ? c.menstrual / total.menstrual : 0, follicular: total.follicular ? c.follicular / total.follicular : 0, luteal: total.luteal ? c.luteal / total.luteal : 0 } }));
}

export function accuracyText(s: LedgerSummary): { summary: { hits: number; total: number }; missDays: string } | undefined {
  return s.total === 0 ? undefined : { summary: { hits: s.in80, total: s.total }, missDays: s.meanAbsError.toFixed(1) };
}

/** X-axis labels for the cycle-length chart: month names; the day too when two cycles start in the same month; the year once
 *  the points span more than one year (D-093, U-22). */
export function lengthAxisLabels(starts: ISODate[]): string[] {
  const years = new Set(starts.map((d) => d.slice(0, 4)));
  const months = starts.map((d) => d.slice(0, 7));
  const repeats = new Set(months).size < months.length;
  return starts.map((d) => `${repeats ? formatDay(d) : formatMonthShort(d)}${years.size > 1 ? ` ${d.slice(0, 4)}` : ''}`);
}
