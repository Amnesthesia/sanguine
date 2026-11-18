// View-model for the Today screen (PLAN.md §8.3, §8.5, §9.5). Pure: copy keys + parameters, no React. The dial's geometry is dialModel.
import { type Confidence, diffDays, type HealthFlag, type ISODate, type Prediction } from '@sanguine/engine';
import i18n from '@/i18n';
import { formatDay, formatRange } from '@/ui/format';
import { ovulationUncertain } from './fertileShown';

/** R-01 (PLAN.md §11.2): the ovulation estimate card ships; one commit can hide it by flipping this. */
export const SHOW_OVULATION_ESTIMATE = true;

export interface Msg { key: string; params?: Record<string, string | number> }

export interface FlagCardModel { code: string; titleKey: string; body: Msg; extraKey: string | undefined; insightOnly: boolean }
export interface EstimateModel { title: Msg; legal: Msg; uncertain: boolean; expanded: boolean; basisKey: string; confidence: Confidence }
export interface TodayModel {
  state: 'empty' | 'suspended' | 'inProgress' | 'predicted' | 'late';
  headline: Msg;
  subtitle?: Msg;
  confidence?: Confidence;
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
}

const EXPAND_P = 0.2;
const LIFE_OPTION: Record<string, string> = { hormonal_contraception: 'hormonal', pregnant: 'pregnant', postpartum: 'postpartum' };

const word = (c: Confidence | undefined): string => (c ? i18n.t(`confidence.${c}`) : '');

/** "13" and "23 Oct" for "13–23 Oct"; "27 Oct" and "2 Nov" across months. */
export function rangeParts(lo: ISODate, hi: ISODate): { lo: string; hi: string } {
  const full = formatRange(lo, hi);
  const sep = full.includes(' – ') ? ' – ' : '–';
  const [a, b] = full.split(sep);
  return { lo: a ?? formatDay(lo), hi: b ?? formatDay(hi) };
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
    return { ...base, state: 'empty', headline: { key: 'today.empty.title' }, subtitle: { key: 'today.empty.body' }, flags: [] };
  }
  if (p.suspended) {
    return {
      ...base, state: 'suspended', flags: [],
      headline: { key: 'today.suspended', params: { stateKey: `settings.lifeState.options.${LIFE_OPTION[p.suspended.reason] ?? 'none'}` } },
    };
  }
  const phase = p.currentPhase;
  const next = p.nextPeriod;
  const day = phase?.dayOfCycle ?? 1;

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
    subtitle = { key: 'today.mostLikelyRange', params: { range: formatRange(next.i80.lo, next.i80.hi), date: formatDay(next.point) } };
  }

  // ovulation estimate card
  let estimate: EstimateModel | undefined;
  if (i.showEstimate && p.ovulation) {
    const o = p.ovulation;
    const r = rangeParts(o.i80.lo, o.i80.hi);
    const uncertain = ovulationUncertain(p);
    const todayP = p.fertileDays?.find((f) => f.date === i.today)?.pInWindow ?? 0;
    estimate = {
      uncertain, confidence: o.confidence, expanded: todayP >= EXPAND_P, basisKey: `today.estimateBasis.${o.basis}`,
      // the title names the confidence only; the fixed §2.3 sentence below it carries the dates once (U-7, D-076)
      title: uncertain ? { key: 'today.ovulationUncertainShort' } : { key: 'today.ovulationTitle', params: { confidence: word(o.confidence) } },
      legal: { key: 'legal.estimateCard', params: { point: formatDay(o.point), lo: r.lo, hi: r.hi } },
    };
  }

  return { ...base, state, headline, ...(subtitle ? { subtitle } : {}), ...(next ? { confidence: next.confidence } : {}), ...(estimate ? { estimate } : {}), flags: flagCards(p.flags), dayOfCycle: day };
}
