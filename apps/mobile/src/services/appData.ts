// App bootstrap: open the database, run migrations, hand out the single EventStore.
import { discardDatabase, expoDatabase } from '@/data/expoDatabase';
import type { Database } from '@/data/database';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { deviceClock } from './clock';
import { getOrCreateDbKey } from './secrets';

const DB_NAME = 'sanguine.db';
let ready: Promise<{ db: Database; store: EventStore }> | undefined;

export function appData(): Promise<{ db: Database; store: EventStore }> {
  ready ??= (async () => {
    const db = await expoDatabase.open(DB_NAME, await getOrCreateDbKey());
    await migrate(db);
    return { db, store: new EventStore(db, deviceClock) };
  })();
  ready.catch(() => { ready = undefined; }); // a failed open is retried on the next call, not cached
  return ready;
}

/** The user's confirmed "start again" when the database cannot be opened with this phone's key (D-043). */
export async function startFreshDatabase(): Promise<void> {
  ready = undefined;
  await discardDatabase(DB_NAME);
}
