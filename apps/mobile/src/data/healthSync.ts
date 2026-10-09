// App-side driver of the health-adapter (PLAN.md §7.2): runs one sync pass per enabled type against the local database.
import { emptyReport, type HealthType, type PlatformDriver, type SyncOptions, type SyncReport, syncType } from '@sanguine/health-adapter';
import type { Database } from './database';
import { sqliteLinks } from './healthLinks';
import { storeSink } from './healthSink';
import type { EventStore } from './store';

/** How far back the first import reads (PLAN.md §7.2: default two years; Health Connect without the history permission only offers 30 days). */
export type HealthWindow = '30d' | '1y' | '2y';
export const DEFAULT_HEALTH_WINDOW: HealthWindow = '2y';

export function sinceFor(w: HealthWindow, today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  if (w === '30d') d.setUTCDate(d.getUTCDate() - 30);
  else d.setUTCFullYear(d.getUTCFullYear() - (w === '1y' ? 1 : 2));
  return d.toISOString();
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
