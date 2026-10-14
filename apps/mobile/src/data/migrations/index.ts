import { sql as m001 } from './001_init';
import { sql as m002 } from './002_post_pregnancy';
import { sql as m003 } from './003_health_link_written_at';
import { sql as m004 } from './004_daily_log_energy';

export interface Migration { version: number; name: string; sql: string }

/** Numbered, applied in order inside a transaction each (PLAN.md §5.4). Never edit a shipped migration: add the next number. */
export const MIGRATIONS: Migration[] = [
  { version: 1, name: 'init', sql: m001 },
  { version: 2, name: 'post_pregnancy_flow_kind', sql: m002 },
  { version: 3, name: 'health_link_written_at', sql: m003 },
  { version: 4, name: 'daily_log_energy', sql: m004 },
];
