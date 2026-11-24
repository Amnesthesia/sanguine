import { FakeDriver } from '@sanguine/health-adapter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';

vi.mock('expo-constants', () => ({ default: { expoConfig: {} } }));
vi.mock('../clock', () => ({ deviceClock: { nowMs: () => 1_700_000_000_000, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Brisbane', randomBytes: (k: number) => new Uint8Array(k) }, todayLocal: () => '2026-10-09' }));
import { syncHealthOnce } from './index';

describe('syncHealthOnce', () => {
  let log: string[];
  let driver: FakeDriver;
  beforeEach(() => {
    log = [];
    driver = new FakeDriver('2026-10-09T07:00:00Z');
    const read = driver.read.bind(driver);
    driver.read = async (t, a, s) => { log.push(`read:start:${a === null ? 'null' : 'anchor'}`); await new Promise((r) => setTimeout(r, 5)); const r = await read(t, a, s); log.push('read:end'); return r; };
  });
  it('overlapping calls (foreground and background) never interleave: each pass, backfill included, finishes before the next starts', async () => {
    const db = openTestDb();
    await migrate(db);
    const store = new EventStore(db, { nowMs: () => 1_700_000_000_000, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Brisbane', randomBytes: (k) => new Uint8Array(k) });
    const prefs = { healthTypes: ['period_flow' as const], healthWindow: '2y' as const, sexLogging: false };
    await Promise.all([syncHealthOnce(db, store, prefs, driver), syncHealthOnce(db, store, prefs, driver)]);
    // call 1: backfill read, normal read; call 2: normal read only (window already done)
    expect(log).toEqual(['read:start:null', 'read:end', 'read:start:null', 'read:end', 'read:start:anchor', 'read:end']);
  });
});
