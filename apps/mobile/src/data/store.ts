// Append-only event store with retract semantics and full projection rebuilds (PLAN.md §5.3-5.4).
import type { Database } from './database';
import { ENGINE_VERSION } from '@sanguine/engine';
import { updateLedger } from './ledger';
import { type EventRow, type NewEvent, validateEvent } from './events';
import { type Clock, uuidv7 } from './ids';
import { type Profile, project, type Projection } from './project';

export class EventStore {
  constructor(private readonly db: Database, private readonly clock: Clock) {}

  private async deviceId(tx: Database): Promise<string> {
    const row = await tx.get<{ value: string }>("SELECT value FROM setting WHERE key = 'device_id'");
    if (row) return JSON.parse(row.value) as string;
    const id = uuidv7(this.clock.nowMs(), this.clock.randomBytes(10));
    await tx.run("INSERT INTO setting (key, value) VALUES ('device_id', ?)", [JSON.stringify(id)]);
    return id;
  }

  private async insert(tx: Database, e: NewEvent): Promise<EventRow> {
    const effective = validateEvent(e);
    if (e.retracts) {
      const target = await tx.get<{ id: string }>('SELECT id FROM event WHERE id = ?', [e.retracts]);
      if (!target) throw new Error(`cannot retract unknown event ${e.retracts}`);
    }
    const lamport = ((await tx.get<{ m: number | null }>('SELECT MAX(lamport) AS m FROM event'))?.m ?? 0) + 1;
    const row: EventRow = {
      id: uuidv7(this.clock.nowMs(), this.clock.randomBytes(10)), lamport, device_id: await this.deviceId(tx), recorded_at: this.clock.iso(),
      effective_day: effective, tz: this.clock.tz(), kind: e.kind, payload: JSON.stringify(e.payload), provenance: e.provenance ?? 'manual',
      source_app: e.source_app ?? null, external_id: e.external_id ?? null, retracts: e.retracts ?? null, schema_v: 1,
    };
    await tx.run(
      `INSERT INTO event (id, lamport, device_id, recorded_at, effective_day, tz, kind, payload, provenance, source_app, external_id, retracts, schema_v)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [row.id, row.lamport, row.device_id, row.recorded_at, row.effective_day, row.tz, row.kind, row.payload, row.provenance, row.source_app, row.external_id, row.retracts, row.schema_v],
    );
    return row;
  }

  /** Writes events atomically and rebuilds the projections once. */
  async appendMany(events: NewEvent[]): Promise<EventRow[]> {
    return this.db.transaction(async (tx) => {
      const rows: EventRow[] = [];
      for (const e of events) rows.push(await this.insert(tx, e));
      await this.rebuildIn(tx);
      return rows;
    });
  }
  async append(e: NewEvent): Promise<EventRow> {
    return (await this.appendMany([e]))[0] as EventRow;
  }

  /** Undo or delete: records a `retract` event for `eventId`. Retracting a retract restores its target. */
  async retract(eventId: string): Promise<EventRow> {
    const target = await this.db.get<{ effective_day: string }>('SELECT effective_day FROM event WHERE id = ?', [eventId]);
    if (!target) throw new Error(`cannot retract unknown event ${eventId}`);
    return this.append({ kind: 'retract', payload: {}, retracts: eventId, effective_day: target.effective_day });
  }

  async events(): Promise<EventRow[]> {
    return this.db.all<EventRow>('SELECT * FROM event ORDER BY lamport, id');
  }

  async profile(): Promise<Profile> {
    const row = await this.db.get<{ value: string }>("SELECT value FROM setting WHERE key = 'profile'");
    return row ? (JSON.parse(row.value) as Profile) : {};
  }
  async setProfile(p: Profile): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run("INSERT INTO setting (key, value) VALUES ('profile', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [JSON.stringify(p)]);
      await this.rebuildIn(tx);
    });
  }

  /** Engine inputs computed from the log (not from the projection tables), so they are always current. */
  async engineInputs(): Promise<Pick<Projection, 'history' | 'settings'>> {
    const { history, settings } = project(await this.events(), await this.profile());
    return { history, settings };
  }

  /** Rebuild inside an already open transaction (used by import). */
  rebuildWithin(tx: Database): Promise<void> {
    return this.rebuildIn(tx);
  }

  /** Drops and replays every projection from the log. Idempotent. */
  async rebuild(): Promise<void> {
    await this.db.transaction((tx) => this.rebuildIn(tx));
  }

  private async rebuildIn(tx: Database): Promise<void> {
    const events = await tx.all<EventRow>('SELECT * FROM event ORDER BY lamport, id');
    const profileRow = await tx.get<{ value: string }>("SELECT value FROM setting WHERE key = 'profile'");
    const p = project(events, profileRow ? (JSON.parse(profileRow.value) as Profile) : {});
    for (const t of ['cycle', 'daily_log', 'biomarker', 'life_state']) await tx.run(`DELETE FROM ${t}`);
    for (const c of p.cycles)
      await tx.run('INSERT INTO cycle (id,start_day,end_day,next_start,length_days,bleed_days,quality,ov_day,ov_sd,ov_basis,luteal_days) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [c.id, c.start_day, c.end_day, c.next_start, c.length_days, c.bleed_days, c.quality, c.ov_day, c.ov_sd, c.ov_basis, c.luteal_days]);
    for (const d of p.dailyLog)
      await tx.run('INSERT INTO daily_log (day,flow,flow_kind,clots,symptoms,sex,notes_cipher,updated_event) VALUES (?,?,?,?,?,?,?,?)',
        [d.day, d.flow, d.flow_kind, d.clots, d.symptoms, d.sex, d.notes_cipher, d.updated_event]);
    for (const b of p.biomarkers)
      await tx.run('INSERT INTO biomarker (id,day,type,value,measured_at,source,provenance,disturbed,event_id) VALUES (?,?,?,?,?,?,?,?,?)',
        [b.id, b.day, b.type, b.value, b.measured_at, b.source, b.provenance, b.disturbed, b.event_id]);
    for (const l of p.lifeStates)
      await tx.run('INSERT INTO life_state (id,kind,detail,from_day,until_day,event_id) VALUES (?,?,?,?,?,?)', [l.id, l.kind, l.detail, l.from_day, l.until_day, l.event_id]);
    await updateLedger(tx, p, ENGINE_VERSION);
  }
}
