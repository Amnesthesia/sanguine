// D-112: closed-cycle estimates use the known length, without changing biomarker records.
import { predictiveVariance } from './cycleLength';
import { addDays } from './dates';
import { evaluateLifeStates, lifeStateStart, lowerCap } from './lifestate';
import { confidenceGrade, fitLuteal, lutealLengths, ovulationInterval } from './ovulation';
import { analyzeCycles } from './predict';
import type { Confidence, EngineSettings, History, ISODate, Interval, OvulationEstimate } from './types';

export interface PastOvulation {
  cycleId: string;
  cycleStart: ISODate;
  point: ISODate;
  i80: Interval;
  basis: OvulationEstimate['basis'];
  confidence: Confidence;
}

export function pastOvulations(history: History, settings: EngineSettings): PastOvulation[] {
  const records = analyzeCycles(history, settings).map(({ record }) => record);
  const luteal = fitLuteal(lutealLengths(records));
  const sd = Math.sqrt(predictiveVariance(luteal));
  const rows: PastOvulation[] = [];
  for (const record of records) {
    if (record.quality !== 'valid' || !record.nextStart || record.length === undefined) continue;
    const nextStart = record.nextStart;
    // Evaluate every overlapping state, including one that ended during this cycle.
    const lifeStates = settings.lifeStates.filter((s) => lifeStateStart(s) < nextStart
      && (s.until === undefined || s.until >= record.start)
      && (s.kind !== 'postpartum' || record.start >= s.delivered))
      .map(({ until: _until, ...s }) => s);
    // Later completed cycles must not erase an earlier cycle's warm-up.
    const completed = records.filter((c) => c.nextStart !== undefined && c.nextStart <= nextStart);
    const gate = evaluateLifeStates(completed, { ...settings, lifeStates }, addDays(nextStart, -1));
    if (gate.bleedingOnly) continue;
    const biomarker = record.ovulation?.basis !== 'calendar' ? record.ovulation : undefined;
    if (!biomarker && !gate.calendarEstimate) continue;
    const offset = record.length - luteal.m - 1;
    const estimate: OvulationEstimate = biomarker ?? {
      point: addDays(record.start, offset), offset, sd, basis: 'calendar', confidence: confidenceGrade(sd),
    };
    rows.push({
      cycleId: record.id, cycleStart: record.start, point: estimate.point,
      i80: ovulationInterval(estimate, record.start), basis: estimate.basis,
      confidence: lowerCap(gate.confidenceCap, estimate.confidence ?? confidenceGrade(estimate.sd)),
    });
  }
  return rows;
}
