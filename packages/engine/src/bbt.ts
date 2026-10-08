// PLAN.md §4.6: basal body temperature and wearable temperature shift detection.
import { addDays, diffDays } from './dates';
import {
  BBT_CUSUM_DISAGREE_SD, BBT_MIN_RISE_C, BBT_SD, TEMP_MIN_COVERAGE, TEMP_TIME_EXCLUSION_MIN, WEARABLE_MIN_RISE_C, WEARABLE_SD,
} from './params';
import type { ISODate, ShiftResult, TemperatureReading } from './types';

const CUSUM_THRESHOLD_C_DAYS = 0.5;
const CUSUM_SLACK_C = 0.05;
const ORAL_MIN_C = 35.0;
const ORAL_MAX_C = 37.5;
const BASELINE_READINGS = 6;

interface Config { rise: number; sd: number; basis: 'bbt' | 'wearable'; rangeCheck: boolean; sources: Array<TemperatureReading['source']> }
const ORAL: Config = { rise: BBT_MIN_RISE_C, sd: BBT_SD, basis: 'bbt', rangeCheck: true, sources: ['oral', 'vaginal', 'other'] };
const WEARABLE: Config = { rise: WEARABLE_MIN_RISE_C, sd: WEARABLE_SD, basis: 'wearable', rangeCheck: false, sources: ['wrist', 'finger'] };

function minutes(t: string): number {
  const [h, m] = t.split(':');
  return Number(h) * 60 + Number(m);
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}
/** SD multiplier by provenance (§4.7). */
function provenanceFactor(r: TemperatureReading): number {
  if (r.provenance === 'imported') return 1.5;
  if (r.provenance === 'manual' && r.timeOfDay === undefined) return 1.3;
  return 1;
}

/** One valid reading per day, cycle days only, after the exclusion rules. */
function validReadings(series: TemperatureReading[], cycleStart: ISODate, cfg: Config): TemperatureReading[] {
  const inCycle = series.filter((r) => cfg.sources.includes(r.source) && r.date >= cycleStart);
  const times = inCycle.filter((r) => r.timeOfDay !== undefined).map((r) => minutes(r.timeOfDay as string));
  const med = times.length ? median(times) : undefined;
  const kept = inCycle.filter((r) => {
    if (r.disturbed) return false;
    if (cfg.rangeCheck && (r.valueC < ORAL_MIN_C || r.valueC > ORAL_MAX_C)) return false;
    if (med !== undefined && r.timeOfDay !== undefined && Math.abs(minutes(r.timeOfDay) - med) > TEMP_TIME_EXCLUSION_MIN) return false;
    return true;
  });
  // sort by date then time; if a day has several readings keep the last one
  kept.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.timeOfDay ?? '') < (b.timeOfDay ?? '') ? -1 : (a.timeOfDay ?? '') > (b.timeOfDay ?? '') ? 1 : 0));
  const byDay = new Map<ISODate, TemperatureReading>();
  for (const r of kept) byDay.set(r.date, r);
  return [...byDay.values()];
}

/** Date index of the first CUSUM crossing run start, or null. Baseline = mean of the first six valid readings. */
function cusumFirstHigh(r: TemperatureReading[]): ISODate | null {
  if (r.length <= BASELINE_READINGS) return null;
  const baseline = r.slice(0, BASELINE_READINGS).reduce((s, x) => s + x.valueC, 0) / BASELINE_READINGS;
  let s = 0;
  let runStart = BASELINE_READINGS;
  for (let i = BASELINE_READINGS; i < r.length; i++) {
    const next = Math.max(0, s + ((r[i] as TemperatureReading).valueC - baseline - CUSUM_SLACK_C));
    if (next === 0) runStart = i + 1;
    s = next;
    if (s >= CUSUM_THRESHOLD_C_DAYS) return (r[Math.min(runStart, i)] as TemperatureReading).date;
  }
  return null;
}

function detect(series: TemperatureReading[], cycleStart: ISODate, cfg: Config): ShiftResult | null {
  const r = validReadings(series, cycleStart, cfg);
  for (let i = BASELINE_READINGS; i + 2 < r.length; i++) {
    const base = r.slice(i - BASELINE_READINGS, i);
    const coverline = Math.max(...base.map((x) => x.valueC));
    const highs = [r[i], r[i + 1], r[i + 2]] as TemperatureReading[];
    if (!highs.every((h) => h.valueC > coverline)) continue;
    if ((highs[2] as TemperatureReading).valueC < coverline + cfg.rise - 1e-9) continue;
    // two consecutive missing days break the run (a gap of 3+ calendar days between neighbours)
    const win = r.slice(i - BASELINE_READINGS, i + 3);
    if (win.some((x, k) => k > 0 && diffDays(x.date, (win[k - 1] as TemperatureReading).date) > 2)) continue;
    // at least half the days to date carry a valid reading
    const lastDate = (highs[2] as TemperatureReading).date;
    const days = diffDays(lastDate, cycleStart) + 1;
    if (r.filter((x) => x.date <= lastDate).length / days < TEMP_MIN_COVERAGE) continue;

    const first = (highs[0] as TemperatureReading).date;
    const cusum = cusumFirstHigh(r);
    const disagree = cusum !== null && Math.abs(diffDays(cusum, first)) > 2;
    const baseSd = disagree ? BBT_CUSUM_DISAGREE_SD : cfg.sd;
    const factor = Math.max(...win.map(provenanceFactor));
    const point = addDays(first, -1);
    return {
      firstHighDate: first,
      coverlineC: coverline,
      ovulation: {
        point, offset: diffDays(point, cycleStart), sd: baseSd * factor, basis: cfg.basis,
        confidence: disagree ? 'low' : 'medium',
      },
    };
  }
  return null;
}

/** Oral/vaginal/other series. Ovulation = the day before the first high reading, SD 1.5 (2.5 if CUSUM disagrees). */
export function detectBbtShift(series: TemperatureReading[], cycleStart: ISODate): ShiftResult | null {
  return detect(series, cycleStart, ORAL);
}
/** Wrist/finger series: own coverline, 0.3 C rise, SD 2.0. Never mixed with oral readings. */
export function detectWearableShift(series: TemperatureReading[], cycleStart: ISODate): ShiftResult | null {
  return detect(series, cycleStart, WEARABLE);
}
