// Android Health Connect driver (PLAN.md §7.2, §7.4). Written against the library's typings; not yet run on a device or emulator:
// the owner's iOS-only testing rule defers that to P3-14 (see DECISIONS D-060). Mapping and sync rules are tested in vitest.
import * as HealthConnect from 'react-native-health-connect';
import { type HealthType, type NewRecord, type PlatformDriver, READ_ONLY_TYPES, type ReadResult } from '@sanguine/health-adapter';
import { deviceClock } from '../clock';
import { HC_TYPES, type HcResult, recordToInsert, resultToRecord } from './healthConnectMapping';

interface HcApi {
  getSdkStatus(): Promise<number>;
  initialize(): Promise<boolean>;
  requestPermission(p: Array<{ accessType: 'read' | 'write'; recordType: string }>): Promise<unknown>;
  readRecords(t: string, o: { timeRangeFilter: { operator: 'after'; startTime: string }; pageSize?: number; pageToken?: string }): Promise<{ records: HcResult[]; pageToken?: string }>;
  getChanges(r: { changesToken?: string; recordTypes?: string[] }): Promise<{ upsertionChanges: Array<{ record: HcResult }>; deletionChanges: Array<{ recordId: string }>; nextChangesToken: string; changesTokenExpired: boolean; hasMore: boolean }>;
  insertRecords(r: Array<Record<string, unknown>>): Promise<string[]>;
  deleteRecordsByUuids(t: string, ids: string[], clientIds: string[]): Promise<void>;
  openHealthConnectSettings(): void;
}
const hc = HealthConnect as unknown as HcApi;
const SDK_AVAILABLE = 3; // SdkAvailabilityStatus.SDK_AVAILABLE
const EXPIRED_REREAD_DAYS = 30; // PLAN.md §7.2: an expired changes token triggers a bounded re-read

export async function healthConnectAvailable(): Promise<boolean> {
  try { return (await hc.getSdkStatus()) === SDK_AVAILABLE && (await hc.initialize()); } catch { return false; }
}
export const openHealthConnectSettings = () => hc.openHealthConnectSettings();

export function createHealthConnectDriver(ownPackage: string): PlatformDriver {
  return {
    platform: 'healthconnect',
    ownSource: ownPackage,

    async requestPermission(types: HealthType[]) {
      await hc.requestPermission(types.flatMap((t) => [{ accessType: 'read' as const, recordType: HC_TYPES[t] }, ...(READ_ONLY_TYPES.includes(t) ? [] : [{ accessType: 'write' as const, recordType: HC_TYPES[t] }])]));
    },

    async read(type, anchor, since): Promise<ReadResult> {
      const rt = HC_TYPES[type];
      const modifiedAt = deviceClock.iso();
      const raw: HcResult[] = [];
      const deleted: string[] = [];
      let token: string | null = null;
      if (anchor) {
        let t = anchor;
        let more = true;
        while (more) {
          const ch = await hc.getChanges({ changesToken: t, recordTypes: [rt] });
          if (ch.changesTokenExpired) { token = null; break; }
          raw.push(...ch.upsertionChanges.map((u) => u.record));
          deleted.push(...ch.deletionChanges.map((d) => d.recordId));
          t = ch.nextChangesToken;
          more = ch.hasMore;
          token = t;
        }
      }
      if (!anchor || token === null) {
        // first read, or the token expired: read from `since` (30 days back after an expiry) and take a fresh token
        const recent = new Date(deviceClock.nowMs() - EXPIRED_REREAD_DAYS * 86400000).toISOString();
        const from = anchor && recent > since ? recent : since;
        let pageToken: string | undefined;
        do {
          const page = await hc.readRecords(rt, { timeRangeFilter: { operator: 'after', startTime: from }, pageSize: 1000, ...(pageToken ? { pageToken } : {}) });
          raw.push(...page.records.map((r) => ({ ...r, recordType: rt })));
          pageToken = page.pageToken;
        } while (pageToken);
        token = (await hc.getChanges({ recordTypes: [rt] })).nextChangesToken;
      }
      const records = [];
      const skipped = [];
      for (const r of raw) {
        const m = resultToRecord({ ...r, recordType: r.recordType ?? rt }, modifiedAt);
        if (m === null) continue;
        if ('skipped' in m) skipped.push({ externalId: r.metadata?.id ?? '', reason: m.skipped });
        else records.push(m);
      }
      return { records, deleted, anchor: token, skipped };
    },

    async write(rec: NewRecord) {
      const row = recordToInsert(rec);
      if (!row) throw new Error(`${rec.type} is read-only`);
      const [id] = await hc.insertRecords([row]);
      if (!id) throw new Error('Health Connect did not return the record id');
      return id;
    },

    async delete(type, externalId) {
      await hc.deleteRecordsByUuids(HC_TYPES[type], [externalId], []);
    },
  };
}
