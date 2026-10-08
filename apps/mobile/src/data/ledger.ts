// On-device calibration ledger (PLAN.md §4.15): one record per closed cycle, never leaves the phone.
// The record keeps what the engine forecast on the day the cycle started, so it is scored without hindsight.
import { diffDays, lifeStateStart, predict, type History } from '@sanguine/engine';
import type { Database } from './database';
import type { CycleRow, Projection } from './project';

const SCORED_BASIS = 'calendar';

function historyAsOf(h: History, asOf: string): History {
  const upTo = <T extends { date: string }>(xs: T[]) => xs.filter((x) => x.date <= asOf);
  return {
    ...h,
    cycles: h.cycles.filter((c) => c.start <= asOf).map((c) => ({ ...c, ...(c.end && c.end > asOf ? { end: asOf } : {}) })),
    temperatures: upTo(h.temperatures), lh: upTo(h.lh), mucus: upTo(h.mucus), cervix: upTo(h.cervix), logs: upTo(h.logs),
    excluded: (h.excluded ?? []).filter((d) => d <= asOf), confirmedLong: (h.confirmedLong ?? []).filter((d) => d <= asOf),
  };
}

function forecastFor(p: Projection, c: CycleRow) {
  const asOf = c.start_day;
  const settings = { ...p.settings, lifeStates: p.settings.lifeStates.filter((s) => lifeStateStart(s) <= asOf) };
  return predict(historyAsOf(p.history, asOf), settings, asOf).nextPeriod;
}

/** Inserts missing records, re-scores a cycle whose actual end changed, and removes records of cycles that no longer qualify. */
export async function updateLedger(tx: Database, p: Projection, engineVersion: string): Promise<void> {
  const closed = p.cycles.filter((c) => c.quality === 'valid' && c.next_start !== null);
  const existing = new Map((await tx.all<{ cycle_id: string; actual_day: string }>('SELECT cycle_id, actual_day FROM prediction_score')).map((r) => [r.cycle_id, r.actual_day]));
  const keep = new Set(closed.map((c) => c.id));
  for (const id of existing.keys()) if (!keep.has(id)) await tx.run('DELETE FROM prediction_score WHERE cycle_id = ?', [id]);
  for (const c of closed) {
    const actual = c.next_start as string;
    if (existing.get(c.id) === actual) continue;
    const f = forecastFor(p, c);
    if (!f) continue;
    const err = Math.abs(diffDays(actual, f.point));
    await tx.run(
      `INSERT OR REPLACE INTO prediction_score (cycle_id, engine_version, predicted_day, lo80, hi80, actual_day, basis, confidence, abs_error, in80, in95)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [c.id, engineVersion, f.point, f.i80.lo, f.i80.hi, actual, SCORED_BASIS, f.confidence, err,
        f.i80.lo <= actual && actual <= f.i80.hi ? 1 : 0, f.i95.lo <= actual && actual <= f.i95.hi ? 1 : 0],
    );
  }
}

export interface LedgerSummary { total: number; in80: number; in95: number; meanAbsError: number }

export async function ledgerSummary(db: Database): Promise<LedgerSummary> {
  const r = await db.get<{ n: number; a: number | null; b: number | null; e: number | null }>('SELECT COUNT(*) n, SUM(in80) a, SUM(in95) b, AVG(abs_error) e FROM prediction_score');
  return { total: r?.n ?? 0, in80: r?.a ?? 0, in95: r?.b ?? 0, meanAbsError: r?.e ?? 0 };
}
