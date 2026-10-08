// View-model for the Today screen (PLAN.md §8.3, §8.5, §9.5). Pure: copy keys + parameters + ring geometry, no React.
import { addDays, type Confidence, diffDays, type HealthFlag, type ISODate, type Prediction } from '@sanguine/engine';
import i18n from '@/i18n';
import { formatDay, formatRange } from '@/ui/format';

/** R-01 (PLAN.md §11.2): the ovulation estimate card ships; one commit can hide it by flipping this. */
export const SHOW_OVULATION_ESTIMATE = true;

export interface Msg { key: string; params?: Record<string, string | number> }

export type RingModel =
  | { kind: 'noData' }
  | { kind: 'suspended' }
  | {
      kind: 'cycle';
      cycleLength: number;
      dayOfCycle: number;
      period: { from: number; to: number };
      fertile: Array<{ from: number; to: number; opacity: number }>;
      predicted?: { from: number; to: number };
      today: { deg: number };
    };

export interface FlagCardModel { code: string; titleKey: string; body: Msg; extraKey: string | undefined; insightOnly: boolean }
export interface EstimateModel { title: Msg; legal: Msg; uncertain: boolean; expanded: boolean; basisKey: string; confidence: Confidence }
export interface TodayModel {
  state: 'empty' | 'suspended' | 'inProgress' | 'predicted' | 'late';
  headline: Msg;
  subtitle?: Msg;
  confidence?: Confidence;
  ring: RingModel;
  estimate?: EstimateModel;
  flags: FlagCardModel[];
  footerKey: 'legal.footer';
  dayOfCycle?: number;
}
export interface TodayInput {
  prediction: Prediction | undefined;
  hasCycles: boolean;
  today: ISODate;
  /** Effective preference: user setting, teen mode and the SHOW_OVULATION_ESTIMATE flag already folded in by the caller. */
  showEstimate: boolean;
  todayFlow: string | undefined;
  bleedDays?: number;
}

const DEG = 360;
const FERTILE_MIN_OPACITY = 0.1;
const EXPAND_P = 0.2;
const UNCERTAIN_SPAN_DAYS = 6; // §8.5: arms longer than 6 days read "estimate uncertain"
const DEFAULT_BLEED_DAYS = 5;
const MIN_RING_DAYS = 21;
const LIFE_OPTION: Record<string, string> = { hormonal_contraception: 'hormonal', pregnant: 'pregnant', postpartum: 'postpartum' };

const word = (c: Confidence | undefined): string => (c ? i18n.t(`confidence.${c}`) : '');
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** "13" and "23 Oct" for "13–23 Oct"; "27 Oct" and "2 Nov" across months. */
export function rangeParts(lo: ISODate, hi: ISODate): { lo: string; hi: string } {
  const full = formatRange(lo, hi);
  const sep = full.includes(' – ') ? ' – ' : '–';
  const [a, b] = full.split(sep);
  return { lo: a ?? formatDay(lo), hi: b ?? formatDay(hi) };
}

export function ringModel(i: { cycleLength: number; dayOfCycle: number; bleedDays: number; fertile: Array<{ day: number; p: number }>; predicted: { from: number; to: number } | undefined; kind: 'cycle' }): RingModel {
  const L = i.cycleLength;
  const deg = (day: number) => (day / L) * DEG; // day boundary: day 1 starts at 0
  return {
    kind: 'cycle', cycleLength: L, dayOfCycle: i.dayOfCycle,
    period: { from: 0, to: deg(i.bleedDays) },
    fertile: i.fertile.filter((f) => f.day >= 1 && f.day <= L).map((f) => ({ from: deg(f.day - 1), to: deg(f.day), opacity: clamp(f.p, FERTILE_MIN_OPACITY, 1) })),
    ...(i.predicted ? { predicted: { from: clamp(deg(i.predicted.from), 0, DEG), to: clamp(deg(i.predicted.to), 0, DEG) } } : {}),
    today: { deg: clamp(deg(i.dayOfCycle - 0.5), 0, DEG) },
  };
}

function flagCards(flags: HealthFlag[]): FlagCardModel[] {
  return flags.map((f) => ({
    code: f.code,
    titleKey: `flags.${f.code}.title`,
    body: { key: `flags.${f.code}.body`, params: f.params as Record<string, number> },
    extraKey: f.code === 'missed' && f.params.sexLogged === 1 ? 'flags.missed.pregnancyTest' : undefined,
    insightOnly: f.insightOnly === true,
  }));
}

export function buildToday(i: TodayInput): TodayModel {
  const p = i.prediction;
  const base = { footerKey: 'legal.footer' as const };
  if (!i.hasCycles || !p) {
    return { ...base, state: 'empty', headline: { key: 'today.empty.title' }, subtitle: { key: 'today.empty.body' }, ring: { kind: 'noData' }, flags: [] };
  }
  if (p.suspended) {
    return {
      ...base, state: 'suspended', ring: { kind: 'suspended' }, flags: [],
      headline: { key: 'today.suspended', params: { stateKey: `settings.lifeState.options.${LIFE_OPTION[p.suspended.reason] ?? 'none'}` } },
    };
  }
  const phase = p.currentPhase;
  const next = p.nextPeriod;
  const day = phase?.dayOfCycle ?? 1;
  const start = addDays(i.today, -(day - 1));

  // ring
  const L = Math.max(MIN_RING_DAYS, next ? diffDays(next.point, start) : 28);
  const bleed = i.bleedDays ?? DEFAULT_BLEED_DAYS;
  const ring = ringModel({
    kind: 'cycle', cycleLength: L, dayOfCycle: day, bleedDays: bleed,
    fertile: i.showEstimate ? (p.fertileDays ?? []).map((f) => ({ day: diffDays(f.date, start) + 1, p: f.pInWindow })) : [],
    predicted: next ? { from: diffDays(next.i80.lo, start), to: diffDays(next.i80.hi, start) + 1 } : undefined,
  });

  // headline
  let state: TodayModel['state'] = 'predicted';
  let headline: Msg;
  let subtitle: Msg | undefined;
  if (phase?.phase === 'menstrual' && next && i.today < next.i80.lo) {
    state = 'inProgress';
    headline = { key: 'today.periodInProgress', params: { day } };
    if (i.todayFlow && i.todayFlow !== 'none') subtitle = { key: 'today.periodLogged', params: { flow: i.todayFlow } };
  } else if (!next) {
    headline = { key: 'today.empty.title' };
  } else if (i.today > next.i80.hi) {
    state = 'late';
    headline = { key: 'today.periodLater' };
    subtitle = { key: 'today.periodLateRange', params: { range: formatRange(next.i80.lo, next.i80.hi) } };
  } else if (i.today >= next.i80.lo) {
    headline = { key: 'today.periodExpectedBy', params: { date: formatDay(next.i80.hi) } };
    subtitle = { key: 'today.mostLikely', params: { date: formatDay(next.point) } };
  } else {
    headline = { key: 'today.periodLikely', params: { lo: diffDays(next.i80.lo, i.today), hi: diffDays(next.i80.hi, i.today) } };
    subtitle = { key: 'today.mostLikely', params: { date: formatDay(next.point) } };
  }

  // ovulation estimate card
  let estimate: EstimateModel | undefined;
  if (i.showEstimate && p.ovulation) {
    const o = p.ovulation;
    const r = rangeParts(o.i80.lo, o.i80.hi);
    const uncertain = diffDays(o.i80.hi, o.i80.lo) > UNCERTAIN_SPAN_DAYS;
    const todayP = p.fertileDays?.find((f) => f.date === i.today)?.pInWindow ?? 0;
    estimate = {
      uncertain, confidence: o.confidence, expanded: todayP >= EXPAND_P, basisKey: `today.estimateBasis.${o.basis}`,
      title: uncertain
        ? { key: 'today.ovulationUncertain', params: { lo: r.lo, hi: r.hi } }
        : { key: 'today.ovulationCollapsed', params: { point: formatDay(o.point), lo: r.lo, hi: r.hi, confidence: word(o.confidence) } },
      legal: { key: 'legal.estimateCard', params: { point: formatDay(o.point), lo: r.lo, hi: r.hi } },
    };
  }

  return { ...base, state, headline, ...(subtitle ? { subtitle } : {}), ...(next ? { confidence: next.confidence } : {}), ring, ...(estimate ? { estimate } : {}), flags: flagCards(p.flags), dayOfCycle: day };
}
