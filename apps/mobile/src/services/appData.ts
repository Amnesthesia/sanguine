// App bootstrap: open the database, run migrations, hand out the single EventStore.
import { expoDatabase } from '@/data/expoDatabase';
import type { Database } from '@/data/database';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { deviceClock } from './clock';

const DB_NAME = 'sanguine.db';
let ready: Promise<{ db: Database; store: EventStore }> | undefined;

export function appData(): Promise<{ db: Database; store: EventStore }> {
  ready ??= (async () => {
    const db = await expoDatabase.open(DB_NAME /* key: SQLCipher in Phase 3 */);
    await migrate(db);
    return { db, store: new EventStore(db, deviceClock) };
  })();
  return ready;
}
