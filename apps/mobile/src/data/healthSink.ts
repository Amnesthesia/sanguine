// The event log as the health-adapter sees it (PLAN.md §7.3): imports and platform deletions go through the same append-only store as everything else.
import type { EventSink, SinkEvent } from '@sanguine/health-adapter';
import type { EventRow } from './events';
import { activeEvents } from './project';
import type { EventStore } from './store';

const toSink = (r: EventRow, retracted: boolean): SinkEvent => ({
  id: r.id, kind: r.kind, payload: JSON.parse(r.payload) as Record<string, unknown>, effectiveDay: r.effective_day,
  provenance: r.provenance, retracted, lamport: r.lamport, sourceApp: r.source_app, externalId: r.external_id,
});

export function storeSink(store: EventStore): EventSink {
  return {
    async events() {
      const rows = await store.events();
      const live = new Set(activeEvents(rows).map((r) => r.id));
      return rows.filter((r) => r.kind !== 'retract' && r.kind !== 'import.batch').map((r) => toSink(r, !live.has(r.id)));
    },
    async append(e) {
      return toSink(await store.append(e), false);
    },
    async retract(eventId, o) {
      const target = (await store.events()).find((r) => r.id === eventId);
      if (!target) throw new Error(`cannot retract unknown event ${eventId}`);
      await store.append({ kind: 'retract', payload: {}, retracts: eventId, effective_day: target.effective_day, provenance: o.provenance, source_app: o.source_app });
      return toSink(target, true);
    },
  };
}
