import type { Database } from './database';
import { type Migration, MIGRATIONS } from './migrations';

export interface MigrateResult { applied: number[]; current: number }

function validate(migrations: Migration[]): void {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) throw new Error(`migrations must be numbered 1..n without gaps; found ${m.version} at position ${i + 1}`);
  });
}

export async function migrate(db: Database, migrations: Migration[] = MIGRATIONS, now: () => string = () => new Date().toISOString()): Promise<MigrateResult> {
  validate(migrations);
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migration (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const done = (await db.all<{ version: number }>('SELECT version FROM schema_migration ORDER BY version')).map((r) => r.version);
  const latest = migrations.length;
  const highest = done.at(-1) ?? 0;
  if (highest > latest) throw new Error(`database schema v${highest} is newer than this app (v${latest}); update the app`);
  const applied: number[] = [];
  for (const m of migrations) {
    if (done.includes(m.version)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.run('INSERT INTO schema_migration (version, applied_at) VALUES (?, ?)', [m.version, now()]);
    });
    applied.push(m.version);
  }
  return { applied, current: latest };
}
