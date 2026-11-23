// App-side driver of the health-adapter (PLAN.md §7.2): runs one sync pass per enabled type against the local database.
import { emptyReport, type HealthType, type Platform, type PlatformDriver, type SyncOptions, type SyncReport, syncType } from '@sanguine/health-adapter';
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

/** Call before a pass with the current window. If it is wider than the one the last pass used, the platform cursors (anchors) are cleared so the next
 *  read starts from the new `since`: a driver given an anchor only returns changes and never looks further back. The links stay, so records already
 *  imported are recognised and not imported again. Narrowing and an unchanged window do nothing. Nothing stored (an install from before this) counts as
 *  the narrowest window, which costs one bounded, de-duplicated re-read. Runs inside the pass, so it cannot overlap a running sync. */
export async function reconcileWindow(db: Database, platform: Platform, window: HealthWindow): Promise<void> {
  const before = await getSetting<HealthWindow>(db, WINDOW_KEY, '30d');
  if (isWider(window, before)) await db.run('UPDATE health_sync SET anchor = NULL WHERE platform = ?', [platform]);
  if (before !== window) await setSetting(db, WINDOW_KEY, window);
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
