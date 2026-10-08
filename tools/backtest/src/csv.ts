// Rolling-origin forecast over a CSV of period start dates (one 'YYYY-MM-DD' per line, optional header 'date').
import { readFileSync } from 'node:fs';
import { diffDays, predict } from '@sanguine/engine';
import type { CycleRecord, EngineSettings, History } from '@sanguine/engine';

export interface CsvResult { cycles: number; forecasts: number; mae: number; cov80: number; cov95: number; width80: number }

export function runCsv(path: string, lambda = 0.92, minHistory = 3): CsvResult {
  const starts = readFileSync(path, 'utf8').split(/\r?\n/).map((l) => l.trim().split(',')[0] as string).filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l)).sort();
  const settings: EngineSettings = { lifeStates: [], recencyLambda: lambda, window: 12 };
  let n = 0, ae = 0, c80 = 0, c95 = 0, w = 0;
  for (let k = minHistory + 1; k < starts.length; k++) {
    const known = starts.slice(0, k);
    const cycles: CycleRecord[] = known.map((s, i) => ({ id: `c${i}`, start: s, quality: 'valid' }));
    const h: History = { cycles, temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
    const p = predict(h, settings, known.at(-1) as string).nextPeriod;
    if (!p) continue;
    const actual = starts[k] as string;
    n++;
    ae += Math.abs(diffDays(actual, p.point));
    if (p.i80.lo <= actual && actual <= p.i80.hi) c80++;
    if (p.i95.lo <= actual && actual <= p.i95.hi) c95++;
    w += diffDays(p.i80.hi, p.i80.lo);
  }
  return { cycles: starts.length, forecasts: n, mae: n ? ae / n : 0, cov80: n ? c80 / n : 0, cov95: n ? c95 / n : 0, width80: n ? w / n : 0 };
}
