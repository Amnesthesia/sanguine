import { sql as m001 } from './001_init';

export interface Migration { version: number; name: string; sql: string }

/** Numbered, applied in order inside a transaction each (PLAN.md §5.4). Never edit a shipped migration: add the next number. */
export const MIGRATIONS: Migration[] = [{ version: 1, name: 'init', sql: m001 }];
