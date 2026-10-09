// One sync pass for one health type (PLAN.md §7.2, §7.3): read the platform, then write what the platform lacks.
import { addDays, contentHash, eventToRecord, eventValue, recordDay, recordToEvent, syncedType } from './mapping';
import type { EventSink, HealthType, LinkStore, PlatformDriver, ReadResult, SinkEvent, SyncOptions, SyncReport } from './types';
import { emptyReport, READ_ONLY_TYPES } from './types';

const ECHO_WINDOW_MS = 48 * 3600 * 1000;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function syncType(d: PlatformDriver, links: LinkStore, sink: EventSink, type: HealthType, o: SyncOptions): Promise<SyncReport> {
  const report = emptyReport();
  const platform = d.platform;
  const src = { provenance: 'imported', source_app: platform } as const;

  // ---- pull ----
  let read: ReadResult;
  try { read = await d.read(type, await links.anchor(platform, type), o.since); } catch (e) { report.failed.push({ op: 'read', error: msg(e) }); return report; }
  const wroteHashes = await links.wroteHashesSince(platform, new Date(Date.parse(o.now) - ECHO_WINDOW_MS).toISOString());
  let events = await sink.events();
  const liveOf = () => events.filter((e) => !e.retracted && syncedType(e) === type);
  const readTime = async (e: SinkEvent) => (await links.byEventId(e.id)).filter((l) => l.direction === 'read').reduce((m, l) => (l.writtenAt > m ? l.writtenAt : m), '');
  const retract = async (e: SinkEvent) => { await sink.retract(e.id, src); e.retracted = true; report.retracted++; };

  for (const r of read.records) {
    const day = recordDay(r, o.deviceZone);
    const value = r.value;
    const hash = contentHash(day, type, value);
    // echo: never re-import what we wrote
    if (r.source === d.ownSource || wroteHashes.has(hash) || (await links.byExternalId(platform, r.externalId))?.direction === 'wrote'
      || (r.clientRecordId !== undefined && (await links.byEventId(r.clientRecordId)).some((l) => l.direction === 'wrote'))) { report.echoed++; continue; }
    // already imported: unchanged is ignored, an edit replaces the imported event (a manual event the link points at is never retracted)
    const known = await links.byExternalId(platform, r.externalId);
    if (known) {
      if (known.contentHash === hash) continue;
      const old = events.find((e) => e.id === known.eventId);
      if (old && !old.retracted && old.provenance === 'imported') await retract(old);
      await links.remove(platform, r.externalId);
    }
    const link = (eventId: string) => links.put({ eventId, platform, externalId: r.externalId, direction: 'read', contentHash: hash, writtenAt: r.modifiedAt });
    const live = liveOf();
    const sameDay = live.filter((e) => e.effectiveDay === day);

    const same = sameDay.find((e) => { const v = eventValue(e); return v !== null && contentHash(day, type, v) === hash; });
    const startNear = !same && type === 'period_flow' && value.kind === 'flow' && value.cycleStart === true
      ? live.find((e) => (e.effectiveDay === addDays(day, -1) || e.effectiveDay === addDays(day, 1)) && !live.some((p) => p.effectiveDay === addDays(e.effectiveDay, -1)))
      : undefined;
    if (same ?? startNear) { await link((same ?? startNear as SinkEvent).id); report.duplicates++; continue; }

    const add = async () => {
      const { kind, payload } = recordToEvent(r, day);
      const ev = await sink.append({ kind, payload, provenance: 'imported', source_app: r.source, external_id: r.externalId });
      events = [...events, ev];
      await link(ev.id);
      return ev;
    };
    if (sameDay.length === 0) { await add(); report.imported++; continue; }
    // conflict: a manual entry wins; among imports the latest platform modification wins; the loser stays as a retracted event
    report.conflicts++;
    const manual = sameDay.some((e) => e.provenance === 'manual');
    let newest = '';
    if (!manual) for (const e of sameDay) { const t = await readTime(e); if (t > newest) newest = t; }
    const wins = !manual && r.modifiedAt > newest;
    if (wins) for (const e of sameDay) await retract(e);
    const ev = await add();
    if (wins) report.imported++; else { await sink.retract(ev.id, src); ev.retracted = true; }
  }

  // ---- deletions: platform -> Sanguine ----
  for (const id of read.deleted) {
    const link = await links.byExternalId(platform, id);
    if (!link) continue;
    const ev = events.find((e) => e.id === link.eventId);
    if (ev && !ev.retracted) {
      if (link.direction === 'wrote' && ev.provenance === 'manual') { report.asks.push({ eventId: ev.id, externalId: id, reason: 'deleted_remote_manual' }); continue; }
      if (link.direction === 'read' && ev.provenance === 'imported') await retract(ev);
    }
    await links.remove(platform, id);
  }

  // ---- push: Sanguine -> platform ----
  if (!READ_ONLY_TYPES.includes(type)) {
    events = await sink.events();
    const mine = events.filter((e) => syncedType(e) === type);
    const liveDays = new Set(mine.filter((e) => !e.retracted).map((e) => e.effectiveDay));
    // ponytail: one link lookup per event, add a batched byEventIds when a log is large enough to notice
    for (const e of mine) {
      const own = await links.byEventId(e.id);
      if (e.retracted) {
        for (const l of own.filter((x) => x.direction === 'wrote')) {
          try { await d.delete(type, l.externalId); await links.remove(platform, l.externalId); report.deletedRemote++; } catch (err) { report.failed.push({ op: 'delete', eventId: e.id, externalId: l.externalId, error: msg(err) }); }
        }
      } else if (own.length === 0) {
        const rec = eventToRecord(e, o.deviceZone, { cycleStart: type === 'period_flow' && !liveDays.has(addDays(e.effectiveDay, -1)) });
        if (!rec) continue;
        try {
          const externalId = await d.write(rec);
          await links.put({ eventId: e.id, platform, externalId, direction: 'wrote', contentHash: contentHash(e.effectiveDay, type, rec.value), writtenAt: o.now });
          report.written++;
        } catch (err) { report.failed.push({ op: 'write', eventId: e.id, error: msg(err) }); }
      }
    }
  }

  if (!read.throttled) await links.setAnchor(platform, type, read.anchor, o.now);
  return report;
}
