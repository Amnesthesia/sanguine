// View-model for the Today cycle dial (D-121, PLAN.md §9.5): which cycle days carry which arc. Pure, no React. Days are 1-based and inclusive.
import { diffDays, addDays, type ISODate, type Prediction } from '@sanguine/engine';
import { ovulationDrawable, shownFertileDays } from './fertileShown';

export interface DialArc { from: number; to: number; kind: 'period' | 'periodEstimate' | 'fertile'; p?: number }
export interface DialModel { days: number; arcs: DialArc[]; ovulationDay?: number; todayDay?: number }
export interface DialInput {
  prediction?: Prediction;
  today: ISODate;
  /** Logged period days; days before the current cycle start are ignored. */
  periodDays: ISODate[];
  /** Effective gate (user setting, teen mode and the ovulation flag folded in by the caller): off draws no fertile arc and no ovulation point. */
  showEstimate: boolean;
  includeUncertain: boolean;
}

const EMPTY: DialModel = { days: 0, arcs: [] };

export function dialModel(i: DialInput): DialModel {
  const p = i.prediction;
  if (!p || p.suspended || !p.nextPeriod || !p.currentPhase) return EMPTY;
  const todayDay = p.currentPhase.dayOfCycle;
  const start = addDays(i.today, -(todayDay - 1));
  const dayOf = (d: ISODate) => diffDays(d, start) + 1;
  const days = Math.max(dayOf(p.nextPeriod.i80.hi), todayDay); // a late period keeps today on the dial
  const arcs: DialArc[] = [];

  const logged = [...new Set(i.periodDays.map(dayOf))].filter((d) => d >= 1 && d <= days).sort((a, b) => a - b);
  for (const d of logged) {
    const last = arcs[arcs.length - 1];
    if (last && last.to === d - 1) last.to = d;
    else arcs.push({ from: d, to: d, kind: 'period' });
  }
  if (p.currentBleed) {
    const from = Math.max(1, ...logged) + 1;
    const to = Math.min(days, dayOf(p.currentBleed.i80.hi));
    if (to >= from) arcs.push({ from, to, kind: 'periodEstimate' });
  }
  arcs.push({ from: Math.max(1, dayOf(p.nextPeriod.i80.lo)), to: days, kind: 'periodEstimate' });

  const model: DialModel = { days, arcs, todayDay };
  if (!i.showEstimate) return model;
  for (const f of shownFertileDays(p, { includeUncertain: i.includeUncertain })) {
    const d = dayOf(f.date);
    if (d >= 1 && d <= days) arcs.push({ from: d, to: d, kind: 'fertile', p: f.pInWindow });
  }
  if (p.ovulation && ovulationDrawable(p, i.includeUncertain)) {
    const d = dayOf(p.ovulation.point);
    if (d >= 1 && d <= days) model.ovulationDay = d;
  }
  return model;
}
