// In-memory platform, link store and event sink: the test double for the sync core and the simulator fallback for the drivers.
import type { EventSink, HealthRecord, HealthType, LinkRow, LinkStore, NewRecord, Platform, PlatformDriver, ReadResult, SinkEvent } from './types';

type Seed = Partial<HealthRecord> & Pick<HealthRecord, 'type' | 'start' | 'value'>;

export class FakeDriver implements PlatformDriver {
  platform: Platform = 'healthkit';
  ownSource = 'app.sanguine.mobile';
  writes: HealthRecord[] = [];
  deletes: string[] = [];
  failWrites = false;
  throttleNext = false;
  lastAnchor: string | null | undefined;
  private seq = 0;
  private store = new Map<string, { seq: number; rec: HealthRecord }>();
  private removed: Array<{ seq: number; type: HealthType; id: string }> = [];
  constructor(public now: string) {}

  seed(records: Seed[]): HealthRecord[] {
    return records.map((s) => {
      const rec: HealthRecord = { externalId: `fake-${this.seq + 1}`, source: 'com.other', end: s.start, modifiedAt: this.now, ...s };
      this.store.set(rec.externalId, { seq: ++this.seq, rec });
      return rec;
    });
  }
  /** Another app edits a record: it is delivered again with a new modification time. */
  modify(externalId: string, patch: Partial<HealthRecord>): void {
    const cur = this.store.get(externalId);
    if (cur) this.store.set(externalId, { seq: ++this.seq, rec: { ...cur.rec, modifiedAt: this.now, ...patch } });
  }
  /** Another app (or the user in the Health app) deletes a record. */
  remoteDelete(externalId: string): void {
    const cur = this.store.get(externalId);
    if (!cur) return;
    this.store.delete(externalId);
    this.removed.push({ seq: ++this.seq, type: cur.rec.type, id: externalId });
  }

  async read(type: HealthType, anchor: string | null, since: string): Promise<ReadResult> {
    this.lastAnchor = anchor;
    const after = anchor === null ? 0 : Number(anchor);
    let records = [...this.store.values()].filter((v) => v.seq > after && v.rec.type === type && v.rec.start >= since).map((v) => v.rec);
    const deleted = this.removed.filter((r) => r.seq > after && r.type === type).map((r) => r.id);
    if (this.throttleNext) {
      this.throttleNext = false;
      records = records.slice(0, 1);
      return { records, deleted: [], anchor, throttled: true };
    }
    return { records, deleted, anchor: String(this.seq) };
  }
  async write(record: NewRecord): Promise<string> {
    if (this.failWrites) throw new Error('fake write failure');
    const [rec] = this.seed([{ ...record, source: this.ownSource }]);
    const written = rec as HealthRecord;
    this.writes.push(written);
    return written.externalId;
  }
  async delete(type: HealthType, externalId: string): Promise<void> {
    this.deletes.push(externalId);
    const cur = this.store.get(externalId);
    if (!cur) return;
    this.store.delete(externalId);
    this.removed.push({ seq: ++this.seq, type, id: externalId });
  }
  /** Records currently in the platform, for assertions. */
  all(): HealthRecord[] { return [...this.store.values()].map((v) => v.rec); }
}

export class MemoryLinks implements LinkStore {
  rows = new Map<string, LinkRow>();
  anchors = new Map<string, string | null>();
  private k = (p: Platform, id: string) => `${p}:${id}`;
  async byExternalId(p: Platform, id: string) { return this.rows.get(this.k(p, id)) ?? null; }
  async byEventId(eventId: string) { return [...this.rows.values()].filter((r) => r.eventId === eventId); }
  async wroteHashesSince(p: Platform, since: string) { return new Set([...this.rows.values()].filter((r) => r.platform === p && r.direction === 'wrote' && r.writtenAt >= since).map((r) => r.contentHash)); }
  async put(row: LinkRow) { this.rows.set(this.k(row.platform, row.externalId), row); }
  async remove(p: Platform, id: string) { this.rows.delete(this.k(p, id)); }
  async anchor(p: Platform, t: HealthType) { return this.anchors.get(`${p}:${t}`) ?? null; }
  async setAnchor(p: Platform, t: HealthType, a: string | null) { this.anchors.set(`${p}:${t}`, a); }
}

export class MemorySink implements EventSink {
  list: SinkEvent[] = [];
  private n = 0;
  async events() { return this.list.map((e) => ({ ...e })); }
  /** A user-logged event, as the logging sheet would write it. */
  manual(kind: string, payload: Record<string, unknown>): SinkEvent {
    const e: SinkEvent = { id: `ev-${++this.n}`, kind, payload, effectiveDay: String(payload.day), provenance: 'manual', retracted: false, lamport: this.n };
    this.list.push(e);
    return e;
  }
  async append(e: { kind: string; payload: Record<string, unknown>; provenance: 'imported'; source_app: string; external_id: string }) {
    const ev: SinkEvent = { id: `ev-${++this.n}`, kind: e.kind, payload: e.payload, effectiveDay: String(e.payload.day), provenance: e.provenance, retracted: false, lamport: this.n, sourceApp: e.source_app, externalId: e.external_id };
    this.list.push(ev);
    return { ...ev };
  }
  async retract(eventId: string) {
    const ev = this.list.find((x) => x.id === eventId);
    if (!ev) throw new Error(`no event ${eventId}`);
    ev.retracted = true;
    return { ...ev };
  }
}
