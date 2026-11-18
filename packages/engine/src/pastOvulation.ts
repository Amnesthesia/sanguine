// D-112: closed-cycle estimates use the known length, without changing biomarker records.
import { predictiveVariance } from './cycleLength';
import { addDays } from './dates';
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
    // IUD cycles remain valid for period predictions, but have no ovulation estimate.
    if (settings.lifeStates.some((s) => s.kind === 'hormonal_contraception' && s.method === 'hormonal_iud'
      && s.since < nextStart && (s.until === undefined || s.until >= record.start))) continue;
    const offset = record.length - luteal.m - 1;
    const estimate: OvulationEstimate = record.ovulation ?? {
      point: addDays(record.start, offset), offset, sd, basis: 'calendar', confidence: confidenceGrade(sd),
    };
    rows.push({
      cycleId: record.id, cycleStart: record.start, point: estimate.point,
      i80: ovulationInterval(estimate, record.start), basis: estimate.basis,
      confidence: estimate.confidence ?? confidenceGrade(estimate.sd),
    });
  }
  return rows;
}
