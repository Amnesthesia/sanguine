// "Delete everything" (PLAN.md §8.2, APP 12-13): drops every table and trigger, then migrates a fresh database.
// The append-only triggers block DELETE on `event` by design, so the log is dropped, not emptied.
import type { Database } from './database';
import { migrate } from './migrate';

export async function wipeAll(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    const objs = await tx.all<{ type: string; name: string }>("SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND type IN ('trigger','table','index')");
    for (const o of objs.filter((x) => x.type === 'trigger')) await tx.exec(`DROP TRIGGER IF EXISTS "${o.name}"`);
    // children before `event`, so foreign keys never see an orphan while dropping
    const order = ['health_link', 'daily_log', 'biomarker', 'life_state', 'event'];
    const tables = objs.filter((x) => x.type === 'table').map((x) => x.name);
    for (const name of [...order.filter((n) => tables.includes(n)), ...tables.filter((n) => !order.includes(n))]) await tx.exec(`DROP TABLE IF EXISTS "${name}"`);
  });
  await migrate(db);
}
