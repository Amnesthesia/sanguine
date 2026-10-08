// PLAN.md §4.10: health flags. Published ranges only (FIGO 2018, PCOS guideline 2023, STRAW+10); never names a condition.
// Wording lives in copy/flags.en-AU.json; the engine returns codes and numbers.
import { cyclePrior, fitCycleLength, predictiveInterval } from './cycleLength';
import { addDays, diffDays } from './dates';
import { lutealLengths } from './ovulation';
import type { CycleRecord, DailyLog, EngineSettings, FlagCode, HealthFlag, ISODate } from './types';

export const FLAG_RATE_LIMIT_DAYS = 90;
/** §11.1 C-02: a short luteal phase is an insight, never a health flag. */
export const SHORT_LUTEAL_MAX_DAYS = 9;
const ADULT = { short: 24, long: 38 };
const ADOLESCENT = { short: 21, long: 45 };
const VARIABILITY_WINDOW = 6;
const PROLONGED_DAYS = 8;
const HEAVY_DAYS = 3;
const MISSED_DAYS = 90;
const MISSED_MARGIN_DAYS = 14;
const FROM40_GAP_DAYS = 60;

export interface FlagContext {
  muted?: Array<{ code: FlagCode; until: ISODate }>;
  lastRaised?: Partial<Record<FlagCode, ISODate>>;
  upper95?: number; // upper end of the 95% cycle-length interval, days; computed from `cycles` when absent
  gapDays?: number; // perimenopause: replaces the 38-day long-cycle rule and the 90-day missed rule
  suspended?: boolean; // a life state pauses estimates: no cycle flags
}

type Stage = 'year1' | 'adolescent' | 'adult';

function stageOf(s: EngineSettings, today: ISODate): Stage {
  const year = Number(today.slice(0, 4));
  if (s.menarcheYear !== undefined) {
    const since = year - s.menarcheYear;
    return since < 1 ? 'year1' : since < 3 ? 'adolescent' : 'adult';
  }
  // teen mode without a menarche year: the stricter adolescent thresholds (§8.6)
  return s.birthYear !== undefined && year - s.birthYear < 18 ? 'adolescent' : 'adult';
}
function variabilityThreshold(age: number | undefined): number {
  if (age === undefined) return 9;
  return age >= 26 && age <= 41 ? 7 : 9;
}

/** Cycles inside a post-stop / post-delivery warm-up window (first three after the event). */
function warmupStarts(cycles: CycleRecord[], s: EngineSettings): Set<ISODate> {
  const out = new Set<ISODate>();
  for (const st of s.lifeStates) {
    const from = st.kind === 'post_contraception' ? st.stopped : st.kind === 'postpartum' ? st.delivered : undefined;
    if (!from) continue;
    for (const c of cycles.filter((x) => x.start >= from).slice(0, 3)) out.add(c.start);
  }
  return out;
}

export function evaluateFlags(cycles: CycleRecord[], logs: DailyLog[], settings: EngineSettings, today: ISODate, ctx: FlagContext = {}): HealthFlag[] {
  if (ctx.suspended) return [];
  const raw: Array<Omit<HealthFlag, 'raisedOn'>> = [];
  const year = Number(today.slice(0, 4));
  const age = settings.birthYear !== undefined ? year - settings.birthYear : undefined;
  const stage = stageOf(settings, today);
  const th = stage === 'adolescent' ? ADOLESCENT : ADULT;
  const longTh = ctx.gapDays ?? th.long;
  const done = cycles.filter((c) => c.length !== undefined);
  const valid = done.filter((c) => c.quality === 'valid');
  const len = (c: CycleRecord) => c.length as number;

  if (stage !== 'year1') {
    const last3 = valid.slice(-3);
    if (last3.length === 3 && last3.filter((c) => len(c) < th.short).length >= 2) raw.push({ code: 'short', params: { threshold: th.short } });
    // §4.14 S2: a probable skipped log still counts toward long cycles
    const long3 = done.filter((c) => c.quality === 'valid' || c.quality === 'suspect_skip').slice(-3);
    const nLong = long3.filter((c) => len(c) > longTh).length;
    if (long3.length === 3 && nLong >= 2) raw.push({ code: 'long', params: { count: nLong, threshold: longTh } });
    if (done.some((c) => (c.quality === 'valid' || c.quality === 'suspect_skip') && len(c) > 90)) raw.push({ code: 'longSingle', params: {} });

    const warm = warmupStarts(cycles, settings);
    const v6 = valid.filter((c) => !warm.has(c.start)).slice(-VARIABILITY_WINDOW);
    if (v6.length === VARIABILITY_WINDOW) {
      const range = Math.max(...v6.map(len)) - Math.min(...v6.map(len));
      const t = variabilityThreshold(age);
      if (range > t) raw.push({ code: 'variability', params: { days: t, range } });
    }
  }

  // bleeding
  const inPeriod = (c: CycleRecord, l: DailyLog) =>
    (l.flowKind === undefined || l.flowKind === 'period') && l.date >= c.start && l.date <= (c.end ?? addDays(c.start, 9));
  const recent2 = cycles.filter((c) => c.quality === 'valid' || c.quality === 'suspect_skip').slice(-2);
  if (recent2.length === 2) {
    const heavy = recent2.every((c) => logs.filter((l) => inPeriod(c, l) && l.flow === 'heavy').length >= HEAVY_DAYS);
    const clots = recent2.every((c) => logs.some((l) => inPeriod(c, l) && l.clots));
    if (heavy || clots) raw.push({ code: 'heavy', params: {} });
    if (recent2.every((c) => (c.bleedDays ?? 0) > PROLONGED_DAYS)) raw.push({ code: 'prolonged', params: {} });
  }
  const last3 = done.filter((c) => c.quality === 'valid').slice(-3);
  if (last3.length === 3) {
    const n = last3.filter((c) => logs.some((l) => l.flowKind === 'intermenstrual' && l.date >= c.start && l.date < (c.nextStart as ISODate))).length;
    if (n >= 2) raw.push({ code: 'intermenstrual', params: {} });
  }

  // missed period: the open cycle is the last one
  const openCycle = cycles.at(-1);
  if (openCycle && openCycle.nextStart === undefined && openCycle.quality !== 'life_state') {
    const elapsed = diffDays(today, openCycle.start);
    const upper95 = ctx.upper95 ?? defaultUpper95(cycles, settings);
    const limit = ctx.gapDays ?? Math.max(MISSED_DAYS, upper95 + MISSED_MARGIN_DAYS);
    const sexLogged = logs.some((l) => l.sex !== undefined && l.date >= openCycle.start) ? 1 : 0;
    if (elapsed > limit && stage !== 'year1') raw.push({ code: 'missed', params: { days: Math.floor(limit), sexLogged } });
    else if (elapsed > FROM40_GAP_DAYS && ((age !== undefined && age >= 40) || ctx.gapDays !== undefined) && stage !== 'year1') raw.push({ code: 'missedFrom40', params: { days: FROM40_GAP_DAYS } });
  }

  // insight only (§11.1 C-02)
  const lut = lutealLengths(cycles).slice(-3);
  if (lut.length === 3 && lut.filter((l) => l <= SHORT_LUTEAL_MAX_DAYS).length >= 2) raw.push({ code: 'shortLuteal', params: {}, insightOnly: true });

  return raw
    .filter((f) => !(ctx.muted ?? []).some((m) => m.code === f.code && today <= m.until))
    .map((f) => {
      const last = ctx.lastRaised?.[f.code];
      const keep = last !== undefined && diffDays(today, last) < FLAG_RATE_LIMIT_DAYS;
      return { ...f, raisedOn: keep ? (last as ISODate) : today };
    });
}

function defaultUpper95(cycles: CycleRecord[], s: EngineSettings): number {
  const lens = cycles.filter((c) => c.quality === 'valid' && c.length !== undefined).map((c) => c.length as number);
  const post = fitCycleLength(lens, cyclePrior(), s.recencyLambda, s.window);
  return predictiveInterval(post, 0.95)[1];
}
