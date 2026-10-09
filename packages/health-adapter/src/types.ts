// Health sync contracts (PLAN.md §7). The core knows nothing about HealthKit, Health Connect, SQLite or React Native:
// the app supplies a PlatformDriver, a LinkStore and an EventSink.
export type ISODate = string;
export type Platform = 'healthkit' | 'healthconnect';
export type HealthType = 'period_flow' | 'intermenstrual' | 'bbt' | 'skin_temp' | 'lh' | 'mucus' | 'sex';
export const HEALTH_TYPES: readonly HealthType[] = ['period_flow', 'intermenstrual', 'bbt', 'skin_temp', 'lh', 'mucus', 'sex'];
/** Read from the platform, never written back (§7.1). */
export const READ_ONLY_TYPES: readonly HealthType[] = ['skin_temp'];

export type RecordValue =
  | { kind: 'flow'; level: 'spotting' | 'light' | 'medium' | 'heavy'; cycleStart?: boolean }
  | { kind: 'bleeding' }
  | { kind: 'temp'; celsius: number }
  | { kind: 'lh'; result: 'negative' | 'positive' | 'high' | 'indeterminate' }
  | { kind: 'mucus'; quality: 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite' }
  | { kind: 'sex'; protected: boolean };

/** A platform record in Sanguine's vocabulary; drivers convert to and from their native shape. */
export interface HealthRecord {
  type: HealthType;
  externalId: string; // HealthKit UUID or Health Connect record id
  source: string; // bundle id or package name of the writing app
  start: string; // ISO instant
  end: string; // ISO instant
  zone?: string; // IANA zone or "+HH:MM" offset on the sample, where the platform supplies one
  modifiedAt: string; // platform modification instant (orders conflicts)
  clientRecordId?: string; // our event id, when we wrote it
  value: RecordValue;
}
export type NewRecord = Omit<HealthRecord, 'externalId' | 'source' | 'modifiedAt'>;

export interface ReadResult { records: HealthRecord[]; deleted: string[]; anchor: string | null; throttled?: boolean }
export interface PlatformDriver {
  platform: Platform;
  ownSource: string; // our bundle id or package: records from it are echoes
  requestPermission?(types: HealthType[]): Promise<void>;
  read(type: HealthType, anchor: string | null, since: string): Promise<ReadResult>;
  write(record: NewRecord): Promise<string>; // returns the external id
  delete(type: HealthType, externalId: string): Promise<void>;
}

export interface LinkRow { eventId: string; platform: Platform; externalId: string; direction: 'read' | 'wrote'; contentHash: string; writtenAt: string }
export interface LinkStore {
  byExternalId(platform: Platform, externalId: string): Promise<LinkRow | null>;
  byEventId(eventId: string): Promise<LinkRow[]>;
  wroteHashesSince(platform: Platform, since: string): Promise<Set<string>>;
  put(row: LinkRow): Promise<void>;
  remove(platform: Platform, externalId: string): Promise<void>;
  anchor(platform: Platform, type: HealthType): Promise<string | null>;
  setAnchor(platform: Platform, type: HealthType, anchor: string | null, at: string): Promise<void>;
}

export interface SinkEvent {
  id: string; kind: string; payload: Record<string, unknown>; effectiveDay: ISODate;
  provenance: 'manual' | 'imported' | 'sensor'; retracted: boolean; lamport: number;
  sourceApp?: string | null; externalId?: string | null;
}
export interface EventSink {
  events(): Promise<SinkEvent[]>; // every event, with `retracted` set when a retract targets it
  append(e: { kind: string; payload: Record<string, unknown>; provenance: 'imported'; source_app: string; external_id: string }): Promise<SinkEvent>;
  retract(eventId: string, o: { provenance: 'imported'; source_app: string }): Promise<SinkEvent>;
}

export interface SyncOptions { now: string; deviceZone: string; since: string }
export interface SyncReport {
  imported: number; echoed: number; duplicates: number; conflicts: number; retracted: number; written: number; deletedRemote: number;
  /** Deletions the user must confirm (§7.3: a manually confirmed entry is never retracted silently). */
  asks: Array<{ eventId: string; externalId: string; reason: 'deleted_remote_manual' }>;
  failed: Array<{ op: 'read' | 'write' | 'delete'; eventId?: string; externalId?: string; error: string }>;
}
export const emptyReport = (): SyncReport => ({ imported: 0, echoed: 0, duplicates: 0, conflicts: 0, retracted: 0, written: 0, deletedRemote: 0, asks: [], failed: [] });
