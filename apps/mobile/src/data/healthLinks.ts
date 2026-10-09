// SQLite side of health sync (PLAN.md §5.2, §7.2): `health_link` ties an event to a platform record, `health_sync` keeps one anchor per type.
import type { HealthType, LinkRow, LinkStore, Platform } from '@sanguine/health-adapter';
import type { Database } from './database';

interface Row { event_id: string; platform: Platform; external_id: string; direction: 'read' | 'wrote'; content_hash: string; written_at: string }
const toLink = (r: Row): LinkRow => ({ eventId: r.event_id, platform: r.platform, externalId: r.external_id, direction: r.direction, contentHash: r.content_hash, writtenAt: r.written_at });

export function sqliteLinks(db: Database): LinkStore {
  return {
    async byExternalId(platform, externalId) {
      const r = await db.get<Row>('SELECT * FROM health_link WHERE platform = ? AND external_id = ?', [platform, externalId]);
      return r ? toLink(r) : null;
    },
    async byEventId(eventId) {
      return (await db.all<Row>('SELECT * FROM health_link WHERE event_id = ?', [eventId])).map(toLink);
    },
    async wroteHashesSince(platform, since) {
      const rows = await db.all<{ content_hash: string }>("SELECT content_hash FROM health_link WHERE platform = ? AND direction = 'wrote' AND written_at >= ?", [platform, since]);
      return new Set(rows.map((r) => r.content_hash));
    },
    async put(l) {
      await db.run(
        `INSERT INTO health_link (event_id, platform, external_id, direction, content_hash, written_at) VALUES (?,?,?,?,?,?)
         ON CONFLICT(platform, external_id) DO UPDATE SET event_id = excluded.event_id, direction = excluded.direction, content_hash = excluded.content_hash, written_at = excluded.written_at`,
        [l.eventId, l.platform, l.externalId, l.direction, l.contentHash, l.writtenAt],
      );
    },
    async remove(platform, externalId) {
      await db.run('DELETE FROM health_link WHERE platform = ? AND external_id = ?', [platform, externalId]);
    },
    async anchor(platform, type: HealthType) {
      return (await db.get<{ anchor: string | null }>('SELECT anchor FROM health_sync WHERE platform = ? AND data_type = ?', [platform, type]))?.anchor ?? null;
    },
    async setAnchor(platform, type, anchor, at) {
      await db.run(
        `INSERT INTO health_sync (platform, data_type, direction, anchor, last_sync_at) VALUES (?, ?, 'both', ?, ?)
         ON CONFLICT(platform, data_type) DO UPDATE SET anchor = excluded.anchor, last_sync_at = excluded.last_sync_at`,
        [platform, type, anchor, at],
      );
    },
  };
}
