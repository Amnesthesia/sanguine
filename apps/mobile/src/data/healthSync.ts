// App-side driver of the health-adapter (PLAN.md §7.2): runs one sync pass per enabled type against the local database.
import { emptyReport, type HealthType, type PlatformDriver, type SyncOptions, type SyncReport, syncType } from '@sanguine/health-adapter';
import type { Database } from './database';
import { sqliteLinks } from './healthLinks';
import { getSetting, setSetting } from './settings';
import { storeSink } from './healthSink';
import type { EventStore } from './store';

/** How far back the first import reads (PLAN.md §7.2: default two years; Health Connect without the history permission only offers 30 days). */
export type HealthWindow = '30d' | '1y' | '2y' | 'all';
export const DEFAULT_HEALTH_WINDOW: HealthWindow = '2y';

export function sinceFor(w: HealthWindow, today: string): string {
  if (w === 'all') return '1970-01-01T00:00:00.000Z'; // Health Connect without the history permission clamps this itself (PLAN.md §7.2)
  const d = new Date(`${today}T00:00:00Z`);
  if (w === '30d') d.setUTCDate(d.getUTCDate() - 30);
  else d.setUTCFullYear(d.getUTCFullYear() - (w === '1y' ? 1 : 2));
  return d.toISOString();
}

export const isWider = (next: HealthWindow, prev: HealthWindow): boolean => WIDTH[next] > WIDTH[prev];
const WIDTH: Record<HealthWindow, number> = { '30d': 0, '1y': 1, '2y': 2, all: 3 };
const WINDOW_KEY = 'health.syncedWindow';

/** After the window was widened: one backfill pass over the new, wider range (see SyncOptions.backfill). The anchors are not touched, so deletions made
 *  before the widening still arrive through the incremental feed. The widest window done is stored only when no read failed, so a failed backfill
 *  retries on the next pass. Nothing stored (an install from before this) counts as the narrowest window: one bounded, de-duplicated re-read.
 *  Returns null when the window is not wider than the stored one. */
export async function backfillWidened(db: Database, store: EventStore, driver: PlatformDriver, types: HealthType[], window: HealthWindow, o: SyncOptions): Promise<SyncReport | null> {
  const done = await getSetting<HealthWindow>(db, WINDOW_KEY, '30d');
  if (!isWider(window, done)) return null;
  const report = await runHealthSync(db, store, driver, types, { ...o, backfill: true });
  if (!report.failed.some((f) => f.op === 'read')) await setSetting(db, WINDOW_KEY, window);
  return report;
}

/** Runs one task at a time, in call order: the foreground, the background task and a backfill must not interleave on the same driver and anchors. */
let gate: Promise<unknown> = Promise.resolve();
export function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = gate.then(task, task);
  gate = run.catch(() => undefined);
  return run;
}

export function mergeReports(rs: SyncReport[]): SyncReport {
  const out = emptyReport();
  for (const r of rs) {
    out.imported += r.imported; out.echoed += r.echoed; out.duplicates += r.duplicates; out.conflicts += r.conflicts;
    out.retracted += r.retracted; out.written += r.written; out.deletedRemote += r.deletedRemote;
    out.asks.push(...r.asks); out.failed.push(...r.failed);
  }
  return out;
}

/** The types that sync: sexual activity only while the user has turned its logging on (off by default and hidden under 18, PLAN.md §8.6). */
export const activeHealthTypes = (p: { healthTypes: HealthType[]; sexLogging: boolean }): HealthType[] => p.healthTypes.filter((t) => t !== 'sex' || p.sexLogging);

/** One pass over the enabled types. Appends go through one projection rebuild at the end. Never throws for a platform error: it is in `failed`. */
export async function runHealthSync(db: Database, store: EventStore, driver: PlatformDriver, types: HealthType[], o: SyncOptions): Promise<SyncReport> {
  const links = sqliteLinks(db);
  const sink = storeSink(store);
  const reports: SyncReport[] = [];
  await store.batch(async () => { for (const t of types) reports.push(await syncType(driver, links, sink, t, o)); });
  return mergeReports(reports);
}
