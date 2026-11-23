// Local-only check against the owner's real Clue download. Skipped unless CLUE_ZIP and CLUE_ZIP_PASSWORD are set (CLUE_JSON optional:
// the extracted measurements.json). Prints counts only: never dates, notes or values. The password is never printed.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../database';
import { importSanguineData } from '../format/importSanguineData';
import type { Clock } from '../ids';
import { migrate } from '../migrate';
import { EventStore } from '../store';
import { openTestDb } from '../testDb';
import { clue } from './clue';

const { CLUE_ZIP, CLUE_ZIP_PASSWORD, CLUE_JSON } = process.env;
let n = 0;
const clock: Clock = { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) };
const bytes = (p: string) => new Uint8Array(readFileSync(p));

describe.skipIf(!CLUE_ZIP || !CLUE_ZIP_PASSWORD)('real Clue sample (local only)', () => {
  let db: Database;
  let store: EventStore;
  beforeEach(async () => { db = openTestDb(); await migrate(db); store = new EventStore(db, clock); });

  it('decodes, matches the unzipped file, and a second import adds nothing', async () => {
    const zip = clue.decode({ name: 'zip', bytes: bytes(CLUE_ZIP as string) }, { password: CLUE_ZIP_PASSWORD });
    if (CLUE_JSON) expect(clue.decode({ name: 'json', bytes: bytes(CLUE_JSON) }, {})).toEqual(zip);
    const o = { sourceApp: 'clue', today: '2026-11-24' as const, clock, noteKey: new Uint8Array(32).fill(7) };
    const first = await importSanguineData(db, store, zip.data, o);
    const second = await importSanguineData(db, store, zip.data, o);
    console.log(`clue real sample: ${zip.data.days.length} days, ${first.added} records added, ${second.added} added on the second import, ${zip.problems.length} problem lines`);
    expect(first.added).toBeGreaterThan(0);
    expect(second.added).toBe(0);
  });
});
