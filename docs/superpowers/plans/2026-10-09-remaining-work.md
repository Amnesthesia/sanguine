# Remaining backlog (P3-7, P3-8, Phases 4, 5 and 6) Implementation Plan

> **Status (2026-10-10): executed.** Tasks 1-11 and 13-19 are done and committed (D-057 to D-064; BACKLOG P3-7, P3-8, P4-1, P4-2, P4-4, P5-2 to P5-4, P6-1 to P6-3 ticked). Still open, and tracked in `docs/BACKLOG.md` rather than here: Task 6's runtime check (P4-3, folded into the P3-14 Android pass), Task 5's wrist-temperature data check (P4-5, needs a real Apple Watch or Health Connect device), and Task 12 after its VERIFY step (P5-1, blocked: no documented Flo or Clue export format, D-062). Later work is planned in `2026-10-10-competitive-gaps.md` (Phase 8) and `2026-10-10-prediction-improvements.md` (P8-13).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native, in this session) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read `docs/agents/README.md`, `runbook.md` and `conventions.md` first.

**Goal:** Finish every open backlog item that does not need a person, in Phases 4, 5 and 6: P4-1 health-adapter core, P4-4 health settings UX, P4-2 iOS HealthKit driver, P4-5 wrist temperature, P4-3 Android Health Connect driver (code only), P3-7 cloud backup upload, P3-8 native icon/splash assets. P3-14 (Android pass) and P3-5b (Android widget) stay open by owner decision.

**Architecture:** `packages/health-adapter` is pure TypeScript like the engine: it knows nothing about React Native, SQLite or HealthKit. It takes three interfaces (a `PlatformDriver` for the platform, a `LinkStore` for `health_link`/`health_sync`, an `EventSink` for the event log) and implements mapping, echo prevention, duplicates, conflicts and deletions once. The app supplies the SQLite `LinkStore`, an `EventStore`-backed sink, and one driver per platform; a `FakeDriver` in the package is the test double and the simulator fallback when the native module is absent. Cloud backup follows the same shape: a `CloudStore` interface with iCloud, Google Drive and a local-folder fake.

**Tech Stack:** TypeScript 7, vitest, fast-check, Expo SDK 57 dev client, `@kingstinct/react-native-healthkit` (+ `react-native-nitro-modules`), `react-native-health-connect` v4, `react-native-cloud-store` (iCloud Documents), `expo-auth-session` + Google Drive REST (`appDataFolder`), `react-native-libsodium` (Argon2id), Maestro on the iOS simulator only.

**Spec:** `docs/PLAN.md` §5.5, §6.3, §6.6, §7 (all), §9.9, §10 (Phase 3 and 4 rows), §11; `docs/BACKLOG.md` P3-7, P3-8, P4-1..P4-5; `docs/DECISIONS.md` D-026, D-034, D-048, D-049, D-051.

## Global Constraints

- Owner rules (2026-10-09): **iOS simulator only** (iPhone 17 Pro Max `1C4C0CE9-4A7A-441F-8FCA-5EDBD373D757`); never boot the Android emulator. One Maestro run at a time across all sessions; Metro only on **8090**; no edits under `apps/mobile/src` while any Maestro suite runs (Metro reloads the app). Stage commits by explicit path. Session `sanguine-ec` owns the simulator until it messages that the D-051-revert suite is done; `sanguine-a4` owns the uncommitted P3-13 files (`importNaturalCycles.*`, `importDaily.*`, `exportImport.ts`, `privacy.tsx`, `copy/en-AU.json`, BACKLOG/DECISIONS/PLAN/risk-register hunks for D-056): never stage those.
- Decision ids: next free is **D-057**; run `grep -o "^- D-0[0-9]*" docs/DECISIONS.md | sort | tail -1` right before writing and announce the id to peers (`SendMessage`).
- Machine is under memory pressure (swap over 10 GB). Run only the vitest files a task touches (`pnpm -s vitest run <path>`), the full `pnpm -s test` once per task before commit, `pnpm -s typecheck` once per task; never two heavy commands at once. Follow the `guarding-resources` skill when the hook warns or denies.
- `packages/health-adapter` and `packages/engine`: no React, no platform APIs, no I/O, no `Date.now()`, no randomness. Everything that needs "now" takes it as an argument.
- No network calls except the backup upload (`apps/mobile/src/services/cloud/*`). Task 9 adds a test that fails on `fetch(` anywhere else under `apps/mobile/src`.
- Symptoms never change a prediction; health sync writes only logged observations, never predictions or flags (§7.1 last line).
- Event rows are append-only: deletions arrive as `retract` events with `provenance: 'imported'`.
- Copy lives in `copy/en-AU.json`; the forbidden-word test (`copy/*.test.ts`) and §2.3 wording stay as they are. Copy addresses women (D-050); no fertility wording in teen mode.
- Every new dependency: `pnpm soup` regenerates `docs/regulatory/soup.md`; add a line to `docs/regulatory/requirements.md` and `risk-register.md` where a rule changes. Commit messages reference the backlog id. Engine is untouched by this plan (hash unchanged); if a task is tempted to change `packages/engine`, stop and record why in DECISIONS.
- After every task: tick the BACKLOG item, append a `docs/PROGRESS.md` log line, refresh `docs/agents/handoff.md` ("in flight" and "next steps").

## Review Focus

1. A HealthKit sample that Sanguine itself wrote comes back on the next anchored read: must be dropped (not re-imported) even when its metadata key is missing because another app copied it. Test in Task 2 (`echo by content hash within 48 h`).
2. A period logged in Apple Health one day off from Sanguine's start day: must be treated as agreement, Sanguine's day kept, the platform record linked as `read` with no new event. Test in Task 2 (`period start within ±1 day`).
3. The user deletes in Apple Health a period day they had confirmed manually in Sanguine: the adapter must *not* retract silently; it returns an `asks` item for the UI. Test in Task 2 (`deletion of a manual event asks`).
4. A wrist temperature covering a night that ends after midnight must be attributed to the morning day in the sample's own zone, not the device zone. Test in Task 1 (`skin_temp day = end instant in sample zone`).
5. Cloud upload with no network, or a second change inside an hour, must neither throw to the UI nor upload twice; and the restore of a cloud file made before the Argon2 cost change must still open (parameters are in the header). Tests in Task 7 (`rate limit`, `offline`) and Task 10 (`old header opens`).

---

## File structure

```
packages/health-adapter/
  package.json                    name @sanguine/health-adapter, no runtime deps (test enforces, like engine)
  tsconfig.json                   copy of packages/crypto/tsconfig.json
  src/index.ts                    re-exports
  src/types.ts                    HealthType, HealthRecord, PlatformDriver, LinkStore, EventSink, SyncReport
  src/mapping.ts                  event <-> record, day attribution (§5.5), content hash
  src/sync.ts                     pull (import, echo, duplicates, conflicts, deletions) and push (writes, corrections, retract deletes)
  src/fake.ts                     FakeDriver (in-memory platform) + MemoryLinks (in-memory LinkStore) for tests and the simulator fallback
  src/*.test.ts                   unit tests + roundTrip.test.ts (§10 acceptance: 3 simulated cycles, zero duplicates)
apps/mobile/src/data/healthLinks.ts        SQLite LinkStore over health_link / health_sync
apps/mobile/src/data/healthSink.ts         EventSink over EventStore
apps/mobile/src/services/health/index.ts   driver selection (ios | android | fake), enabled types in prefs, runSync()
apps/mobile/src/services/health/healthkit.ts   P4-2 driver
apps/mobile/src/services/health/healthConnect.ts P4-3 driver (code only; untested until P3-14)
apps/mobile/src/services/health/background.ts  background delivery (iOS) / task (Android) registration
apps/mobile/src/app/settings/health.tsx    P4-4 screen
apps/mobile/src/app/dev/health-seed.tsx    debug screen to seed HealthKit on the simulator (DEV only)
apps/mobile/src/services/cloud/{index,icloud,drive,local}.ts  P3-7 CloudStore + drivers
apps/mobile/src/services/cloud/schedule.ts  change-triggered, Wi-Fi-only, hourly-capped upload
apps/mobile/.maestro/health.yaml, cloud-backup.yaml
```

Interfaces that every later task relies on (defined in Task 1, do not rename):

```ts
// packages/health-adapter/src/types.ts
export type ISODate = string;
export type Platform = 'healthkit' | 'healthconnect';
export type HealthType = 'period_flow' | 'intermenstrual' | 'bbt' | 'skin_temp' | 'lh' | 'mucus' | 'sex';
export const HEALTH_TYPES: readonly HealthType[];
export const READ_ONLY_TYPES: readonly HealthType[]; // ['skin_temp']

/** A platform record in Sanguine's vocabulary; drivers convert to/from their native shape. */
export interface HealthRecord {
  type: HealthType;
  externalId: string;            // HK UUID or HC record id
  source: string;                // bundle id / package name of the writing app
  start: string; end: string;    // ISO instants
  zone?: string;                 // IANA zone on the sample, if the platform supplies one
  modifiedAt: string;            // platform modification instant (conflict ordering)
  clientRecordId?: string;       // our event id when we wrote it (HK metadata com.sanguine.eventId / HC clientRecordId)
  value: RecordValue;
}
export type RecordValue =
  | { kind: 'flow'; level: 'spotting' | 'light' | 'medium' | 'heavy'; cycleStart?: boolean }
  | { kind: 'bleeding' }
  | { kind: 'temp'; celsius: number }                       // bbt or skin_temp (absolute, already de-delta'd by the driver)
  | { kind: 'lh'; result: 'negative' | 'positive' | 'high' | 'indeterminate' }
  | { kind: 'mucus'; quality: 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite' }
  | { kind: 'sex'; protected: boolean };

export interface ReadResult { records: HealthRecord[]; deleted: string[]; anchor: string | null; throttled?: boolean }
export interface PlatformDriver {
  platform: Platform;
  ownSource: string;                                 // our bundle id / package: records from it are echoes
  read(type: HealthType, anchor: string | null, since: string): Promise<ReadResult>;
  write(record: Omit<HealthRecord, 'externalId' | 'source' | 'modifiedAt'>): Promise<string>; // returns externalId
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
export interface SinkEvent { id: string; kind: string; payload: Record<string, unknown>; effectiveDay: ISODate; provenance: 'manual' | 'imported' | 'sensor'; retracted: boolean; lamport: number }
export interface EventSink {
  events(): Promise<SinkEvent[]>;                                              // live (unretracted) + retracted flag
  append(e: { kind: string; payload: Record<string, unknown>; provenance: 'imported'; source_app: string; external_id: string }): Promise<SinkEvent>;
  retract(eventId: string, o: { provenance: 'imported'; source_app: string }): Promise<SinkEvent>;
}
export interface SyncOptions { now: string; deviceZone: string; since: string; manualWins?: true }
export interface SyncReport {
  imported: number; echoed: number; duplicates: number; conflicts: number; retracted: number; written: number; deletedRemote: number;
  asks: Array<{ eventId: string; externalId: string; reason: 'deleted_remote_manual' }>; // UI must confirm these (§7.3)
  failed: Array<{ op: 'write' | 'delete'; eventId?: string; externalId?: string; error: string }>;
}
export function syncType(d: PlatformDriver, links: LinkStore, sink: EventSink, type: HealthType, o: SyncOptions): Promise<SyncReport>;
```

---

### Task 1: health-adapter package, types and pure mapping (P4-1 part 1, P4-5 mapping)

**Files:**
- Create: `packages/health-adapter/package.json`, `tsconfig.json`, `src/index.ts`, `src/types.ts`, `src/mapping.ts`
- Modify: `vitest.config.ts:12` (add `'health-adapter'` to the alias list), `apps/mobile/tsconfig.json` paths if the other packages are listed there (check `grep -n sanguine apps/mobile/tsconfig.json`)
- Test: `packages/health-adapter/src/mapping.test.ts`, `packages/health-adapter/src/purity.test.ts`

**Interfaces:** produces everything in the block above plus:
```ts
// mapping.ts
export function recordDay(r: HealthRecord, deviceZone: string): ISODate;        // §5.5
export function contentHash(day: ISODate, type: HealthType, value: RecordValue): string; // stable string key, no crypto needed: `${day}|${type}|${JSON.stringify(sortedValue)}`
export function recordToEvent(r: HealthRecord, day: ISODate): { kind: string; payload: Record<string, unknown> }; // flow -> 'flow' {day, level, flow_kind:'period'}; bleeding -> 'flow' {level:'spotting', flow_kind:'intermenstrual'}; temp -> 'biomarker' {type:'bbt'|'skin_temp', value:{valueC}, source:'oral'|'wrist', measured_at}; lh -> 'biomarker' {type:'lh', value:{result}, source:'strip'}; mucus -> 'biomarker' {type:'mucus', value:{quality}, source:'manual'}; sex -> 'sex' {day, protected}
export function eventToRecord(e: SinkEvent, zone: string): Omit<HealthRecord, 'externalId' | 'source' | 'modifiedAt'> | null; // inverse; null for kinds not synced (symptoms, notes, life states, post_pregnancy flow). start/end: flow = local midnight..next midnight in `zone`; bbt = measured_at instant or 06:00 local; sex = local noon
export function syncedType(e: SinkEvent): HealthType | null;
```
Payload shapes must match `apps/mobile/src/data/events.ts` `validateEvent` exactly (read it; `biomarker` needs `type`, `value` object, `source` string, optional `measured_at`; `flow` needs `level`, `flow_kind`).

- [x] **Step 1: Package scaffold.** Copy `packages/crypto/package.json` to `packages/health-adapter/package.json`, name `@sanguine/health-adapter`, version `0.1.0`, `dependencies: {}`. Copy `packages/crypto/tsconfig.json`. `src/index.ts`: `export * from './types'; export * from './mapping'; export * from './sync'; export * from './fake';` (sync/fake come in Task 2; create empty `export {}` files now so typecheck passes).
- [x] **Step 2: Purity test** `purity.test.ts` (mirror `packages/engine`'s version: `grep -rn "no runtime dependencies" packages/engine/src/*.test.ts` and copy it): asserts `package.json` has no `dependencies`, and no source file matches `/from ['"]react|expo|react-native|Date\.now\(|Math\.random\(|crypto\./`.
- [x] **Step 3: Failing mapping tests** in `mapping.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { contentHash, eventToRecord, recordDay, recordToEvent } from './mapping';
import type { HealthRecord } from './types';
const rec = (p: Partial<HealthRecord>): HealthRecord => ({ type: 'bbt', externalId: 'x', source: 'com.other', start: '2026-10-09T05:30:00+10:00', end: '2026-10-09T05:30:00+10:00', modifiedAt: '2026-10-09T06:00:00Z', value: { kind: 'temp', celsius: 36.5 }, ...p });
describe('recordDay (§5.5)', () => {
  it('BBT at 05:30 local is that day', () => expect(recordDay(rec({}), 'Australia/Sydney')).toBe('2026-10-09'));
  it('uses the sample zone over the device zone', () => expect(recordDay(rec({ start: '2026-10-09T23:30:00Z', end: '2026-10-09T23:30:00Z', zone: 'Australia/Sydney' }), 'UTC')).toBe('2026-10-10'));
  it('skin_temp day = end instant (morning after the night) in the sample zone', () => expect(recordDay(rec({ type: 'skin_temp', start: '2026-10-08T13:00:00Z', end: '2026-10-08T20:30:00Z', zone: 'Australia/Sydney' }), 'UTC')).toBe('2026-10-09'));
  it('a flow sample spanning a day is its start day', () => expect(recordDay(rec({ type: 'period_flow', start: '2026-10-09T00:00:00+10:00', end: '2026-10-10T00:00:00+10:00', value: { kind: 'flow', level: 'medium' } }), 'Australia/Sydney')).toBe('2026-10-09'));
});
describe('recordToEvent', () => {
  it('period flow', () => expect(recordToEvent(rec({ type: 'period_flow', value: { kind: 'flow', level: 'heavy' } }), '2026-10-09')).toEqual({ kind: 'flow', payload: { day: '2026-10-09', level: 'heavy', flow_kind: 'period' } }));
  it('intermenstrual bleeding is spotting of kind intermenstrual', () => expect(recordToEvent(rec({ type: 'intermenstrual', value: { kind: 'bleeding' } }), '2026-10-09').payload).toMatchObject({ level: 'spotting', flow_kind: 'intermenstrual' }));
  it('bbt carries measured_at and source oral', () => expect(recordToEvent(rec({}), '2026-10-09')).toEqual({ kind: 'biomarker', payload: { day: '2026-10-09', type: 'bbt', value: { valueC: 36.5 }, source: 'oral', measured_at: '2026-10-09T05:30:00+10:00' } }));
  it('skin_temp is source wrist', () => expect(recordToEvent(rec({ type: 'skin_temp' }), '2026-10-09').payload).toMatchObject({ type: 'skin_temp', source: 'wrist' }));
  it('lh', () => expect(recordToEvent(rec({ type: 'lh', value: { kind: 'lh', result: 'positive' } }), '2026-10-09').payload).toMatchObject({ type: 'lh', value: { result: 'positive' } }));
  it('sex', () => expect(recordToEvent(rec({ type: 'sex', value: { kind: 'sex', protected: true } }), '2026-10-09')).toEqual({ kind: 'sex', payload: { day: '2026-10-09', protected: true } }));
});
describe('eventToRecord', () => {
  const ev = (kind: string, payload: Record<string, unknown>) => ({ id: 'e1', kind, payload, effectiveDay: '2026-10-09', provenance: 'manual' as const, retracted: false, lamport: 1 });
  it('flow -> one-day interval at local midnight', () => expect(eventToRecord(ev('flow', { day: '2026-10-09', level: 'light', flow_kind: 'period' }), 'Australia/Sydney')).toEqual({ type: 'period_flow', start: '2026-10-09T00:00:00+10:00', end: '2026-10-10T00:00:00+10:00', zone: 'Australia/Sydney', clientRecordId: 'e1', value: { kind: 'flow', level: 'light' } }));
  it('post_pregnancy flow is never written', () => expect(eventToRecord(ev('flow', { day: '2026-10-09', level: 'light', flow_kind: 'post_pregnancy' }), 'UTC')).toBeNull());
  it('symptoms, notes, life states are never written', () => { for (const k of ['symptom', 'note', 'life_state.set']) expect(eventToRecord(ev(k, { day: '2026-10-09' }), 'UTC')).toBeNull(); });
  it('skin_temp is read-only', () => expect(eventToRecord(ev('biomarker', { day: '2026-10-09', type: 'skin_temp', value: { valueC: 36 }, source: 'wrist' }), 'UTC')).toBeNull());
  it('round-trips bbt', () => { const r = eventToRecord(ev('biomarker', { day: '2026-10-09', type: 'bbt', value: { valueC: 36.4 }, source: 'oral', measured_at: '2026-10-09T05:30:00+10:00' }), 'Australia/Sydney'); expect(recordToEvent({ ...r!, externalId: 'x', source: 's', modifiedAt: 'm' }, '2026-10-09').payload).toMatchObject({ type: 'bbt', value: { valueC: 36.4 } }); });
});
describe('contentHash', () => {
  it('is order-independent over value keys and distinguishes level', () => { expect(contentHash('2026-10-09', 'period_flow', { kind: 'flow', level: 'light' })).toBe(contentHash('2026-10-09', 'period_flow', { level: 'light', kind: 'flow' } as never)); expect(contentHash('2026-10-09', 'period_flow', { kind: 'flow', level: 'light' })).not.toBe(contentHash('2026-10-09', 'period_flow', { kind: 'flow', level: 'heavy' })); });
});
```
- [x] **Step 4: Run** `pnpm -s vitest run packages/health-adapter` — expected: FAIL, modules missing.
- [x] **Step 5: Implement `types.ts` and `mapping.ts`.** Zone maths without a library: use `Intl.DateTimeFormat(zone, { hourCycle: 'h23', year, month, day, hour, minute, second })` `formatToParts` to get local wall time of an instant, and for local-midnight-to-instant compute the offset by formatting the UTC guess and adjusting (the engine package avoids this because it works in days only; a 15-line helper `localMidnightIso(day, zone)` returning `YYYY-MM-DDT00:00:00±HH:MM` is enough; test it with Sydney (+10/+11 DST) and UTC). `recordDay`: `skin_temp` uses `end`, everything else `start`; zone = `r.zone ?? deviceZone`.
- [x] **Step 6: Run** the same command — expected: PASS. Then `pnpm -s typecheck` (one run).
- [x] **Step 7: Commit** `git add packages/health-adapter vitest.config.ts && git commit -m "P4-1 health-adapter: types and pure mapping (§5.5, §7.1)"` (append the Co-Authored-By line from the session reminder).

### Task 2: sync core with a fake driver and the §10 round-trip (P4-1 part 2)

**Files:**
- Create: `packages/health-adapter/src/sync.ts`, `src/fake.ts`
- Test: `src/sync.test.ts`, `src/roundTrip.test.ts`

**Interfaces:**
- Consumes Task 1 types and mapping.
- Produces `syncType` (signature above), `class FakeDriver implements PlatformDriver` with `seed(records)`, `remoteDelete(externalId)`, `writes: HealthRecord[]`, `deletes: string[]`, a deterministic id counter and `modifiedAt` taken from a `now` passed to `seed`; `class MemoryLinks implements LinkStore`; `class MemorySink implements EventSink` (arrays, lamport counter, `manual(kind, payload, day)` helper for tests).

- [x] **Step 1: Failing unit tests** in `sync.test.ts`, one `it` per §7.3 rule. Fixture: `const now = '2026-10-09T08:00:00Z'; const o = { now, deviceZone: 'Australia/Sydney', since: '2024-10-09T00:00:00Z' }`.
  - `imports a foreign period flow as an imported event with a read link` (sink has 1 event with `provenance 'imported'`, `external_id` = record externalId; links has a `read` row; report.imported 1).
  - `drops records whose source is ownSource` (echoed 1, nothing appended).
  - `drops records whose clientRecordId matches a wrote link` (echoed 1).
  - `drops a record whose content hash matches something we wrote within 48 h, even with no id` (echoed 1); and `imports it when the write was older than 48 h` (imported 1).
  - `same day same type same value from another app: links as read, no event` (duplicates 1, sink unchanged).
  - `same day different value: manual wins; the import is appended then retracted so day detail can show it` (conflicts 1; sink has imported event with `retracted: true`).
  - `same day different value among two imports: the later modifiedAt wins and the earlier is retracted`.
  - `period start within ±1 day of ours is agreement: our day kept, theirs linked read` (duplicates 1).
  - `remote deletion of an imported event retracts it with provenance imported` (retracted 1; link removed).
  - `remote deletion of an event the user logged manually asks instead of retracting` (asks has 1, sink unchanged).
  - `pushes an unlinked manual event and stores a wrote link with the returned externalId` (written 1; `driver.writes[0].clientRecordId === eventId`).
  - `a retracted event with a wrote link is deleted remotely and the link removed` (deletedRemote 1).
  - `a corrected day (new event, old retracted) deletes the old remote record and writes a new one` (deletedRemote 1, written 1).
  - `read-only types are never pushed` (skin_temp manual event: written 0).
  - `driver write failure is reported, not thrown, and retried next run` (failed has 1; a second `syncType` with a working driver writes it).
  - `persists the anchor and passes it on the next read` (driver records the anchor argument).
  - `throttled read result stops after what was returned and keeps the old anchor`.
- [x] **Step 2: Run** `pnpm -s vitest run packages/health-adapter/src/sync.test.ts` — FAIL (no `syncType`).
- [x] **Step 3: Implement `fake.ts` then `sync.ts`.** `syncType` order: (1) `read(type, anchor, since)`; (2) for each record: echo checks (ownSource, clientRecordId in wrote links, hash in `wroteHashesSince(now - 48 h)`), then `recordDay`, then duplicate/conflict against live sink events of that day and type (period-start ±1 day rule only for `period_flow` with `cycleStart`), append or link; (3) deletions: look up link, if event provenance manual push to `asks`, else retract; (4) push: for each live sink event with `syncedType === type` and no link, `write`; for each retracted event with a `wrote` link, `delete`; collect failures; (5) `setAnchor`. Every branch is a few lines; keep the file under 200 lines. `// ponytail: one pass per type, no batching; add batching when a driver throttles in practice.`
- [x] **Step 4: Run** the unit tests — PASS.
- [x] **Step 5: Round-trip acceptance** `roundTrip.test.ts` (§10 Phase 4 exit criterion "zero duplicates after 3 simulated cycles"): simulate 3 cycles of 28 days from 2026-01-05. For each cycle: Sanguine logs 5 flow days manually; sync all types; the "other app" (FakeDriver `seed`) writes BBT every day and one LH positive on day 14; sync again; then the fake reads back everything Sanguine wrote (so echoes exist) and sync a third time. Assertions after the loop: live `flow` events = 15, all manual; BBT imported events = 84, LH = 3; `report.duplicates + report.echoed` > 0 on later runs; no two live events share `(kind, day, type)`; `driver.writes.length === 15` (one per flow day, never re-written); links count = 15 wrote + 87 read. Then: retract one manual flow day → sync → `driver.deletes.length === 1`; remote-delete one BBT → sync → that biomarker is retracted and 83 live remain. Use fast-check for one property: for any permutation of the three sync calls within a cycle, the final live event set is the same.
- [x] **Step 6: Run** `pnpm -s vitest run packages/health-adapter` — PASS; then `pnpm -s test` once (full, 632+ tests) and `pnpm -s typecheck`.
- [x] **Step 7: Docs.** DECISIONS: `D-057 (2026-10-09) Health-adapter core rules (P4-1)`: record the 48 h hash window, "manual wins" as the only conflict rule, that a deleted manual event asks, that `skin_temp` is read-only and stored with source `wrist`, that conflicts keep the loser as a retracted imported event; rejected alternatives (latest-writer-wins for manual; silent retract). `docs/regulatory/requirements.md`: add REQ lines for echo prevention, conflicts, deletions pointing at `sync.test.ts`. `risk-register.md`: "imported duplicate shifts a cycle start" mitigated by the ±1 day rule and the round-trip test. BACKLOG: tick P4-1. PROGRESS log line.
- [x] **Step 8: Commit** `git add packages/health-adapter docs/DECISIONS.md docs/BACKLOG.md docs/PROGRESS.md docs/regulatory/requirements.md docs/regulatory/risk-register.md && git commit -m "P4-1 health-adapter sync core, fake driver, round-trip test (D-057)"`.

### Task 3: app-side LinkStore, EventSink and driver selection (P4-1 part 3)

Wait for `sanguine-ec`'s "simulator free" message before this task (it edits `apps/mobile/src`).

**Files:**
- Create: `apps/mobile/src/data/healthLinks.ts`, `apps/mobile/src/data/healthSink.ts`, `apps/mobile/src/services/health/index.ts`
- Modify: `apps/mobile/src/data/migrations/` add `003_health_link_written_at.ts` (`ALTER TABLE health_link ADD COLUMN written_at TEXT`), register it where `002_post_pregnancy.ts` is registered (`grep -rn 002_post_pregnancy apps/mobile/src/data`), update `migrate.test.ts` expectations; `apps/mobile/src/data/wipe.ts` already clears `health_link` (verify `health_sync` too, add if missing); `apps/mobile/src/data/prefs.ts` add `healthTypes: HealthType[]` (default `[]`) and `healthSince: ISODate | null`.
- Test: `apps/mobile/src/data/healthLinks.test.ts`, `healthSink.test.ts` (both on `openTestDb()` from `testDb.ts`, pattern in `ledger.test.ts`).

**Interfaces:**
- Produces `sqliteLinks(db): LinkStore`, `storeSink(store, db): EventSink` (maps `EventRow` → `SinkEvent`: `retracted` = another live row has `retracts = id`; uses `store.append`/`store.retract` with `provenance 'imported'`), `getHealthDriver(): PlatformDriver | null` (iOS: Task 5's driver when the native module loads, else `null`; Android: Task 7's; Expo Go / jest: `null`), `runHealthSync(db, store, types, o: { now, deviceZone, since }): Promise<SyncReport[]>` which loops `syncType` and merges reports; `FakeDriver` is exported for the DEV seed screen.

- [x] **Step 1: Failing tests.** `healthLinks.test.ts`: put/byExternalId/byEventId/remove/anchor round trips on a real `health_link` row (needs an `event` row first: FK); `wroteHashesSince` filters by `written_at`. `healthSink.test.ts`: `events()` marks retracted rows; `append` validates through `validateEvent` (an invalid payload throws); `retract` writes a `retract` event with `provenance 'imported'`.
- [x] **Step 2: Run** the two files — FAIL.
- [x] **Step 3: Implement** (each file under 60 lines).
- [x] **Step 4: Run** — PASS. `pnpm -s test`, `pnpm -s typecheck`, `pnpm lint`.
- [x] **Step 5: Commit** `git add apps/mobile/src/data/healthLinks.ts apps/mobile/src/data/healthLinks.test.ts apps/mobile/src/data/healthSink.ts apps/mobile/src/data/healthSink.test.ts apps/mobile/src/data/migrations apps/mobile/src/data/migrate.test.ts apps/mobile/src/data/prefs.ts apps/mobile/src/data/wipe.ts apps/mobile/src/services/health && git commit -m "P4-1 app LinkStore, EventSink and health driver selection"`.

### Task 4: Health settings and permission UX (P4-4)

**Files:**
- Modify: `apps/mobile/src/app/settings/health.tsx` (replace the placeholder), `copy/en-AU.json` (`settings.health.*`; coordinate with `sanguine-a4`, which has uncommitted hunks in this file: stage only your lines with `git add -p` or the temp-index method in memory `side-by-side-sessions`), `apps/mobile/app.json` (`ios.infoPlist.NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription` naming each type, §6.6)
- Create: `apps/mobile/src/features/health/HealthTypeRow.tsx`, `apps/mobile/src/features/health/healthModel.ts` (pure: row list, direction label, teen-mode filter), `apps/mobile/.maestro/health.yaml`
- Test: `apps/mobile/src/features/health/healthModel.test.ts`, `apps/mobile/src/features/health/HealthTypeRow.test.tsx` (RNTL pattern in `apps/mobile/src/**/*.test.tsx`), `copy` forbidden-word test runs automatically.

- [x] **Step 1: Copy.** Per §7.5, one block per type: `settings.health.types.period_flow.title` "Period flow", `.direction` "Read and write", `.body` "Sanguine will import periods you logged in Apple Health and write the ones you log here, so both stay in step." (Android: "Health Connect"; use `{{platform}}`), `settings.health.shared` "Anything written to {{platform}} is governed by its privacy rules and is visible to other apps you have allowed.", `settings.health.types.skin_temp.body` "Nightly wrist temperature is read to estimate ovulation after the fact and is never written back." (hidden in teen mode: no fertility wording there, so teen mode shows "is read to improve cycle estimates"), `settings.health.since` "Import from" with options 30 days / 1 year / 2 years (default 2 years, §7.2), `settings.health.unavailable` stays for Expo Go, `settings.health.syncNow`, `settings.health.lastSync` "Last sync {{when}}", `settings.health.ask.deletedRemote` "{{platform}} deleted an entry you logged yourself on {{day}}. Remove it here too?", `settings.health.openSettings` "Open Health settings" (deep link `x-apple-health://` on iOS; Health Connect permission intent on Android via driver).
- [x] **Step 2: Failing model test:** rows = `HEALTH_TYPES` minus `sex` unless the tracking pref enables sexual activity (§8.1 "off by default"); `skin_temp` row says read-only; teen mode swaps the two fertility bodies; `enabledTypes(prefs)`.
- [x] **Step 3: Screen.** Rows with a `Switch` (`accessibilityLabel` = title + direction), on toggle: call `driver.requestPermission?.(type)` if the driver exposes it (add `requestPermission?(types: HealthType[]): Promise<void>` to `PlatformDriver` as optional in Task 1's types — do it now, one line), save prefs, run `runHealthSync` for that type with `since` from the pref; show `lastSync`; render `report.asks` as a confirm dialog that retracts on yes. `testID`s: `health-row-<type>`, `health-sync-now`, `health-since`. Empty-read hint per §7.3 "Partial permissions": when a read returns nothing, show `settings.health.emptyHint` "Nothing came back. If you expected data, check Sanguine's access in Health." with the deep link.
- [x] **Step 4: Maestro** `health.yaml`: open Settings → Health, assert each row visible, toggle period flow (fake driver on the simulator until Task 5), tap sync now, assert `lastSync`. Run with `apps/mobile/.maestro/run.sh ios health.yaml` after `sanguine-ec` releases the simulator; screenshots to `docs/screenshots/P4-4-devclient/`. Also run `fontscale` variant per `runbook.md`.
- [x] **Step 5:** `pnpm -s test`, typecheck, lint; tick P4-4; PROGRESS; commit by explicit path (not `copy/en-AU.json` hunks that are not yours).

### Task 5: iOS HealthKit driver (P4-2) and wrist temperature read (P4-5)

**Files:**
- Modify: `apps/mobile/package.json` (add `@kingstinct/react-native-healthkit`, `react-native-nitro-modules`; check the current versions with `pnpm view <pkg> version`), `apps/mobile/app.json` plugins (`["@kingstinct/react-native-healthkit", { "NSHealthShareUsageDescription": …, "NSHealthUpdateUsageDescription": …, "background": true }]`), `docs/regulatory/soup.md` (`pnpm soup`)
- Create: `apps/mobile/src/services/health/healthkit.ts`, `apps/mobile/src/services/health/background.ts`, `apps/mobile/src/app/dev/health-seed.tsx` (DEV only; route guarded by `__DEV__`)
- Test: `apps/mobile/src/services/health/healthkit.test.ts` (map native sample shapes → `HealthRecord` with hand-written sample objects; no native module in vitest, so the mapping functions are exported separately from the driver class)

- [x] **Step 1: VERIFY items** (§7.1, §7.2) against the library's current README and Apple docs with `web_lookup` (agy-bridge): `HKCategoryValueMenstrualFlow` values and `HKMetadataKeyMenstrualCycleStart`; third-party write for `contraceptive`/`pregnancy`/`lactation` (Phase 5, record only); background-delivery frequency per type; whether `appleSleepingWristTemperature` is readable by third parties (it is, read-only) and its unit. Record outcomes in DECISIONS (next free id) with the doc URLs.
- [x] **Step 2: Mapping tests** (pure): HK `menstrualFlow` category value 1..4 → unspecified/light/medium/heavy (unspecified → `medium`, record this choice), `metadata.HKMenstrualCycleStart` → `cycleStart`; `basalBodyTemperature` quantity in °C (`HKUnit.degreeCelsius`, convert if °F); `appleSleepingWristTemperature` → `skin_temp` with `start`/`end` of the sample; `ovulationTestResult` 1..4 → negative/positive/indeterminate/high (estrogen surge → `high`); `cervicalMucusQuality` 1..5 → dry/sticky/creamy/watery/eggwhite; `sexualActivity` metadata `HKSexualActivityProtectionUsed` → `protected` (absent → treat as `protected: false`? No: absent means unknown; §7.1 has no unknown, so skip the record and count it in `failed` with `error: 'protection unknown'` — record in DECISIONS); `sourceRevision.source.bundleIdentifier` → `source`; `metadata['com.sanguine.eventId']` → `clientRecordId`; `metadata.HKTimeZone` → `zone`.
- [x] **Step 3: Driver.** `read`: `queryQuantitySamplesWithAnchor` / `queryCategorySamplesWithAnchor` with `anchor`, `from: since`, returns `{records, deleted: deletedSamples.map(uuid), anchor: newAnchor}`; `write`: `saveCategorySample` / `saveQuantitySample` with metadata `{ 'com.sanguine.eventId': clientRecordId, HKTimeZone: zone, ...(cycleStart ? { HKMenstrualCycleStart: true } : {}) }`, returns the new UUID; `delete`: `deleteSamples` by UUID; `requestPermission(types)`: `requestAuthorization` with the read/write sets; `ownSource` = `app.sanguine.mobile`. `background.ts`: `enableBackgroundDelivery(type, 'immediate' | 'hourly')` for enabled types at app start and `subscribeToChanges` → `runHealthSync`; plus sync on foreground (`AppState` change) with a 60 s debounce.
- [x] **Step 4: Native rebuild** (coordinate: tell peers before, simulator must be free): `cd apps/mobile && npx expo prebuild --platform ios --clean` is NOT needed; use the runbook's dev-client build command (`grep -n "run:ios\|xcodebuild" docs/agents/runbook.md`). Disk is tight: delete `apps/mobile/ios/build` after installing the app on the simulator.
- [x] **Step 5: Seed screen** `dev/health-seed.tsx`: buttons "Seed 3 cycles into Health" (writes flow samples under a different metadata key so they look foreign; HealthKit on the simulator attributes them to our bundle, so the driver's `ownSource` echo check would drop them: add a DEV-only `treatAsForeign` flag to the driver that ignores the source check for samples carrying metadata `com.sanguine.seed = true`), "Delete seeded", "Run sync", and a report dump.
- [x] **Step 6: Maestro** extend `health.yaml` (or `health-seed.yaml`, DEV route): seed → sync → Calendar shows imported chip on seeded days → Settings → sync again → Insights cycle count unchanged (zero duplicates) → delete seeded → sync → chips gone. Screenshots `docs/screenshots/P4-2-devclient/`.
- [x] **Step 7:** `pnpm soup`; `requirements.md` and `risk-register.md` lines for HealthKit; tests, typecheck, lint; tick P4-2 and P4-5 (wrist temperature arrives through the same read path; Insights already charts `skin_temp` via `project.ts`, verify with the seed screen writing one `appleSleepingWristTemperature` sample — if the simulator refuses to write that read-only type, say so in DECISIONS and PROGRESS "Needs human" (real Apple Watch check)); PROGRESS; commit.

### Task 6: Android Health Connect driver, code only (P4-3)

Owner rule: no emulator. Write the driver against the library's typed API, unit-test the pure mapping, typecheck, and record in DECISIONS and BACKLOG P3-14 that the runtime check is pending.

**Files:**
- Modify: `apps/mobile/package.json` (`react-native-health-connect` ^4.1.3, `expo-build-properties` if absent for `minSdkVersion 26`), `apps/mobile/app.json` (plugin entry; `android.permissions` for each `READ_/WRITE_` health permission plus `READ_HEALTH_DATA_IN_BACKGROUND`, `READ_HEALTH_DATA_HISTORY`), `docs/regulatory/soup.md`
- Create: `apps/mobile/src/services/health/healthConnect.ts`, extend `background.ts` with `expo-background-task` (check it is installed; else `expo-task-manager`) hourly task on Android
- Test: `apps/mobile/src/services/health/healthConnect.test.ts` (mapping only)

- [x] **Step 1: VERIFY** changes-token expiry (§7.2) with `web_lookup`; record in DECISIONS.
- [x] **Step 2: Mapping tests:** `MenstruationFlowRecord.flow` 1..3 → light/medium/heavy (0 unknown → `medium`), `IntermenstrualBleedingRecord`, `BasalBodyTemperatureRecord.temperature.inCelsius`, `SkinTemperatureRecord` deltas → absolute = `baseline + delta` when `baseline` present else skip the record (§7.3 "deltas stored as deltas" conflicts with the engine's absolute `valueC`: keep the record out and report it; record in DECISIONS as the conservative choice), `OvulationTestRecord.result` → negative/positive/high/inconclusive→indeterminate, `CervicalMucusRecord.appearance` → quality (sensation ignored), `SexualActivityRecord.protectionUsed` 0 unknown → skip, `metadata.dataOrigin.packageName` → `source`, `metadata.clientRecordId` → `clientRecordId`, `startZoneOffset` → zone (as `±HH:MM`, so `recordDay` must accept an offset string as well as an IANA name: add that to Task 1's `recordDay` now with a test).
- [x] **Step 3: Driver:** `read` = `getChanges({ changesToken })` when an anchor exists else `readRecords(type, { timeRangeFilter: { startTime: since } })` + `getChangesToken`; on token-expired error → re-read last 30 days and new token; `write` = `insertRecords` with `metadata: { clientRecordId, clientRecordVersion: lamport }` (upsert; so a correction may call `write` without `delete`: add `supportsUpsert: true` on the driver and let `sync.ts` skip the delete when set, with a unit test in Task 2's file); `delete` = `deleteRecordsByUuids`; `requestPermission` = `requestPermission([...])`; `ownSource` = Android package name from `app.json`.
- [x] **Step 4:** `pnpm soup`, tests, typecheck, lint; BACKLOG: tick P4-3 as "code complete, runtime check in P3-14" (add the check to the P3-14 line); DECISIONS entry; commit.

### Task 7: Cloud store interface, local fake and restore E2E (P3-7 part 1)

**Files:**
- Create: `apps/mobile/src/services/cloud/index.ts` (`CloudStore` interface + `getCloudStore()`), `local.ts` (fake: a folder under `Paths.document/cloud-fake`, DEV and simulator only), `schedule.ts`
- Modify: `apps/mobile/src/app/settings/backup.tsx` (a "Keep a copy in iCloud Drive / Google Drive" switch, "Upload now", "Restore from cloud" in restore mode, last-upload line), `copy/en-AU.json`, `apps/mobile/src/data/prefs.ts` (`cloudBackup: boolean`, `cloudLastUploadAt`)
- Test: `apps/mobile/src/services/cloud/schedule.test.ts` (pure scheduler), `apps/mobile/.maestro/cloud-backup.yaml`

**Interfaces:**
```ts
export interface CloudStore { name: 'icloud' | 'drive' | 'local'; available(): Promise<boolean>; put(name: string, bytes: Uint8Array): Promise<void>; get(name: string): Promise<Uint8Array | null>; list(): Promise<Array<{ name: string; modifiedAt: string; size: number }>>; remove(name: string): Promise<void> }
export const BACKUP_NAME = 'sanguine-backup.sgb'; // one versioned file (§6.3); the previous one is renamed `.1` before each upload
export function shouldUpload(s: { changedAt: string | null; lastUploadAt: string | null; now: string; onWifi: boolean; enabled: boolean }): boolean; // enabled && changed since last upload && onWifi && (now - lastUploadAt) >= 1 h
export async function uploadIfDue(db, store, cloud, passphraseSecretProvider, now): Promise<'uploaded' | 'skipped' | 'offline' | 'failed'>; // never throws
```
- [x] **Step 1: Failing scheduler tests:** rate limit (second change within an hour → false), offline (`onWifi false` → false), disabled, no change since upload, first upload with no `lastUploadAt` → true. Wi-Fi detection: `expo-network` `getNetworkStateAsync().type === 'WIFI'` (add `expo-network`, an Expo SDK package).
- [x] **Step 2:** Implement `schedule.ts`; PASS.
- [x] **Step 3: Passphrase.** The upload must seal without asking for the passphrase each time: store the *file key input* conservatively — keep the passphrase out of storage; instead store the Argon2 output (32 bytes) in Secure Store under `backup.kdfOut` when the user enables cloud backup (they type the passphrase once), and reseal each upload with a fresh salt? No: the Argon2 output depends on the salt. Decision (record as D-0xx, conservative): the cloud file reuses one salt per device, generated when cloud backup is enabled and stored with the KDF output in Secure Store; `sealBackup` gets an optional `{ salt, k0 }` to skip the KDF (`packages/crypto/src/backup.ts`: add `precomputed?: { salt: Uint8Array; k0: Uint8Array }` to `SealOptions`, test that a file sealed with `precomputed` opens with the passphrase). Turning cloud backup off, deleting all data (`wipe.ts`) or changing the passphrase deletes `backup.kdfOut` and the salt. Rejected: storing the passphrase (plaintext secret at rest); asking every hour (nobody would enable it).
- [x] **Step 4: Screen and local store.** `getCloudStore()` returns `local` when `__DEV__` and no real store is available (Tasks 8 and 9 add them). Hook `uploadIfDue` into the app's change path: find where `refresh()` runs after a write in `apps/mobile/src/state/app.ts` and call `void uploadIfDue(...)` with the device clock; also on foreground. Restore from cloud: `cloud.list()` → pick latest → `restoreBackup`.
- [x] **Step 5: Maestro** `cloud-backup.yaml` on the dev client (local store): enable cloud backup with passphrase → log a period → "Upload now" → Settings > Privacy > Delete all data → onboarding → Backup > Restore from cloud (passphrase + recovery code shown earlier; the flow copies the words from `recovery-words` text via Maestro `copyTextFrom`) → Calendar shows the period. This is the "restore E2E" of P3-7 on one simulator (the plan said two simulators; one simulator with a wipe in between proves the same thing; record in DECISIONS). Screenshots `docs/screenshots/P3-7-devclient/`.
- [x] **Step 6:** `pnpm soup`, tests, typecheck, lint, commit `P3-7 cloud backup: store interface, scheduler, local fake, restore E2E`.

### Task 8: iCloud Drive store (P3-7 part 2, iOS)

**Files:**
- Modify: `apps/mobile/package.json` (`react-native-cloud-store`), `apps/mobile/app.json` (`ios.entitlements`: `com.apple.developer.icloud-container-identifiers: ["iCloud.app.sanguine.mobile"]`, `com.apple.developer.icloud-services: ["CloudDocuments"]`, `com.apple.developer.ubiquity-container-identifiers`), `docs/regulatory/soup.md`
- Create: `apps/mobile/src/services/cloud/icloud.ts`

- [x] **Step 1:** Confirm with `web_lookup` that `react-native-cloud-store` supports Expo SDK 57 / RN 0.82 and iCloud Documents (`writeFile`, `readFile`, `stat`, `isICloudAvailable`); if it does not, fall back to a 40-line Expo Module (`npx create-expo-module --local`) wrapping `FileManager.default.url(forUbiquityContainerIdentifier:)` + `Data.write`; record the choice.
- [x] **Step 2:** Implement `icloud.ts` (`available()` = `isICloudAvailable()`, files under `Documents/` in the container so they show in Files > iCloud Drive > Sanguine, which is what "the user's own iCloud Drive app folder" means).
- [x] **Step 3: Rebuild** the dev client. The simulator has no iCloud account: `available()` is false there, so `getCloudStore()` falls back to `local` and the Maestro flow from Task 7 still passes. **Needs owner:** an Apple Developer team with the iCloud container `iCloud.app.sanguine.mobile` enabled on the app id, and a signed-in device to verify. Add to PROGRESS "Needs human" and DECISIONS.
- [x] **Step 4:** tests, typecheck, lint, `pnpm soup`, commit.

### Task 9: Google Drive appDataFolder store (P3-7 part 3, Android)

**Files:**
- Modify: `apps/mobile/package.json` (`expo-auth-session`, `expo-web-browser` if absent; both Expo SDK packages), `apps/mobile/app.json` (`scheme` already `sanguine`), `docs/regulatory/soup.md`
- Create: `apps/mobile/src/services/cloud/drive.ts`
- Test: `apps/mobile/src/services/cloud/drive.test.ts` (request builders only: multipart upload body for `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart` with `parents: ['appDataFolder']`, list query `spaces=appDataFolder`, download `alt=media`; a fake `fetch` records calls)

- [x] **Step 1:** Tests for the three request builders and for token refresh (refresh when `expiresAt - now < 60 s`).
- [x] **Step 2:** Implement with `AuthRequest` (scope `https://www.googleapis.com/auth/drive.appdata`, PKCE, `useProxy: false`), tokens in Secure Store under `drive.tokens`. `OAUTH_CLIENT_ID` is one constant read from `app.json` `extra.googleDriveClientId`; empty → `available()` false. **Needs owner:** a Google Cloud project with the Drive API enabled and an Android OAuth client id for the package name + signing SHA-1. Record in PROGRESS and DECISIONS.
- [x] **Step 3: Network gate test** `tools/ci/network.test.ts`: every `fetch(` / `XMLHttpRequest` / `WebSocket` in `apps/mobile/src` and `packages` must be under `apps/mobile/src/services/cloud/`; fails otherwise (CLAUDE.md non-negotiable).
- [x] **Step 4:** tests, typecheck, lint, soup, commit. Not runnable on the simulator; the Maestro cloud flow stays on the local store.

### Task 10: Argon2 back to 64 MiB × 3 with native libsodium (P3-7 part 4, D-034 follow-up)

**Files:**
- Modify: `apps/mobile/package.json` (`react-native-libsodium`), `packages/crypto/src/backup.ts` (`SealOptions.kdf` already exists; add an injectable `argon2: (pass: Uint8Array, salt: Uint8Array, p: KdfParams) => Promise<Uint8Array>` defaulting to `@noble/hashes` `argon2idAsync`), `apps/mobile/src/data/backup.ts` (`BACKUP_KDF` back to `DEFAULT_KDF` when the native function is present; else keep 19 MiB × 2), `docs/regulatory/soup.md`, `docs/DECISIONS.md` (correction entry to D-034)
- Create: `apps/mobile/src/services/argon2.ts` (`nativeArgon2 | null`: `crypto_pwhash` with `crypto_pwhash_ALG_ARGON2ID13`, `opslimit = iterations`, `memlimit = memKiB * 1024`)
- Test: `packages/crypto/src/backup.test.ts` add `a file sealed with the injected KDF opens with the default KDF when both compute the same function` (inject a wrapper around noble that records it was called) and `old header (19 MiB × 2) still opens` (existing fixture bytes: seal once with those params, assert `readHeader` and `openBackup`).

- [x] **Step 1:** Tests, FAIL, implement, PASS.
- [x] **Step 2:** Rebuild the dev client; measure on the simulator: the backup screen logs `[backup] sealed … in … ms` (`backup.tsx:40`); record both numbers (noble vs libsodium) in the D-034 correction. If libsodium at 64 MiB × 3 is still over 5 s on the simulator, keep 19 MiB × 2 and say so (the owner decides; the parameters are in the header either way).
- [x] **Step 3:** Rerun `apps/mobile/.maestro/run.sh ios` for the backup flow (find its name in `.maestro/`), tests, typecheck, lint, soup; tick P3-7; `docs/regulatory/requirements.md` KDF line; commit.

### Task 11: Native icon and splash assets (P3-8)

**Files:**
- Modify: `apps/mobile/app.json` (`ios.icon` → `./assets/icon/Sanguine.icon` if Expo 57 accepts an Icon Composer bundle: `web_lookup` "expo ios.icon Icon Composer .icon SDK 54"; `android.adaptiveIcon.{foregroundImage,backgroundColor,monochromeImage}`; `splash` per platform), `tools/brand/build.ts` (emit the layers), `docs/brand.html` (note)
- Create: `apps/mobile/assets/icon/Sanguine.icon/icon.json` + layer PNGs (Icon Composer's bundle is a folder with `icon.json` listing groups/layers; author it by hand from the existing emblem PNG in `docs/brand-v2/`), `apps/mobile/assets/icon/adaptive-foreground.png` (emblem on transparent, 108 dp safe zone = inner 66 %), `adaptive-background.png` (blush `#F5E8E2`), `adaptive-monochrome.png`
- Test: `tools/brand/icons.test.ts`: every referenced asset exists, foreground PNG is 1024², the adaptive foreground has transparent corners (sample pixel 0,0 alpha 0) using the existing `@resvg/resvg-js`/png reader in `tools/brand`.

- [x] **Step 1:** Research the `.icon` format support in Expo 57 and Icon Composer's `icon.json` schema (`web_lookup`); if `.icon` is not consumed by Expo 57's prebuild, ship the 1024² flat icon (already there) and record "Icon Composer layers pending SDK 58" in DECISIONS; still do the Android adaptive icon.
- [x] **Step 2:** Generate assets with `tools/brand/build.ts` (recolour only, never redraw: CLAUDE.md Brand). Tests PASS.
- [x] **Step 3:** Rebuild, then `xcrun simctl io 1C4C0CE9-4A7A-441F-8FCA-5EDBD373D757 screenshot docs/screenshots/P3-8-devclient/ios-home.png` after pressing Home (`xcrun simctl … launch` the springboard: Maestro `pressKey: Home`); also light/dark/tinted appearance (`xcrun simctl ui <udid> appearance dark`). The discreet alternate icons (D-048) must still switch: rerun the discretion Maestro flow.
- [x] **Step 4:** Tick P3-8; **Needs human** stays: the client's original emblem/logotype files (D-049). Commit.

### Task 12: Flo and Clue importers (Phase 5, §8.10)

**Files:** Create `apps/mobile/src/data/importFlo.ts`, `importClue.ts` (+ `.test.ts` each), modify `apps/mobile/src/services/exportImport.ts` and `settings/privacy.tsx` only after `sanguine-a4` commits P3-13 (they hold uncommitted hunks there; wait for their message or `git status` clean on those paths).

- [x] **Step 1: VERIFY (§8.10)** with `web_lookup`: current Clue export (JSON: measurements `period`, `bbt`, `ovulation_test`, `mucus`, `sex`…) and Flo export (zip of JSON) formats. Write what was found, with URLs, in DECISIONS. If a field encoding is not documented, do what D-056 did: map only what is documented, report the rest, never guess. Tests use synthetic files built from the documented shape only.
- [ ] **Step 2: Failing tests** per importer: parses the documented sample; maps to `DailyRow` (reuse `importDailyRows`); a second import adds nothing; unknown fields are reported; malformed file throws `ImportError`.
- [ ] **Step 3:** Implement; wire into the Settings > Privacy import picker next to Natural Cycles (choose parser by extension and content sniffing, as `importNaturalCycles.ts` does). Update PLAN §8.10 wording only where it is now untrue.
- [ ] **Step 4:** tests, typecheck, lint, commit; BACKLOG: add and tick `P5-1`.

### Task 13: Teen-mode polish (Phase 5)

**Files:** audit `apps/mobile/src/features/**` and `copy/*.json`; create `apps/mobile/src/features/teen/teenAudit.test.ts`.

- [x] **Step 1: Failing audit test.** For a teen profile (age 13-17 on today's date): Today shows no fertility estimate card, no ovulation chart rows in Insights, no sexual-activity row in the logging sheet or Health types (Task 4's `healthModel` already filters; test it), no tagline on the splash (D-045), notifications use the default neutral text regardless of the descriptive pref (§11 Children's Code row), life-state options show no fertility wording, health-sync rows use the teen bodies. Use the existing view-model tests' fixtures (`todayModel.test.ts`, `describe.test.ts`) to build each surface's model for a teen and an adult.
- [x] **Step 2:** Fix every failure at its source (one constant `TEEN_HIDES` is not needed; call `isTeenOn(profile, today)`). Unlock in Settings > Tracking exists per §8: verify with a test, not by reading.
- [x] **Step 3:** Maestro `onboarding-agegate.yaml` plus a new `teen.yaml` (teen profile via the seed route: Today has no estimate card; Settings > Tracking shows the unlock). Run on iOS when the simulator is free. Screenshots `docs/screenshots/P5-2-devclient/`.
- [x] **Step 5:** commit; BACKLOG `P5-2`.

### Task 14: Privacy manifest, store config and release pipeline (Phase 5, §6.6)

**Files:** Modify `apps/mobile/app.json` (`ios.privacyManifests`: `NSPrivacyTracking false`, empty tracking domains, `NSPrivacyCollectedDataTypes []` (nothing leaves the device), `NSPrivacyAccessedAPITypes` for the required-reason APIs the dependencies use: UserDefaults `CA92.1`, FileTimestamp `C617.1`, SystemBootTime `35F9.1`, DiskSpace `E174.1`: check each against the generated `ios/` manifests and the libraries' own `PrivacyInfo.xcprivacy` with `grep -r NSPrivacyAccessedAPIType apps/mobile/ios/Pods`), `ios.config.usesNonExemptEncryption: false`? No: the backup uses XChaCha20, which is non-exempt-eligible only through the standard exemption; set `ITSAppUsesNonExemptEncryption` to `false` only if that is right: record the reasoning and mark "owner to confirm export-compliance answers" in PROGRESS).
Create `apps/mobile/eas.json` (profiles `development` (dev client, internal), `preview` (internal), `production` (`autoIncrement`); submit profiles with placeholders `ascAppId`, `serviceAccountKeyPath` documented as owner-supplied), `.github/workflows/release.yml` (on tag `v*`: install, typecheck, lint, test, `eas build --non-interactive --profile production --platform all` and `eas submit` gated by `workflow_dispatch` inputs and the `EXPO_TOKEN` secret, which is owner-supplied), `.github/workflows/maestro-nightly.yml` (documented, `if: false` until a macOS runner is chosen: owner decision), `docs/store/listing-en-AU.md` (title, subtitle, first paragraph = the fixed §2.3 wording verbatim, keywords with no forbidden words, age-rating answers for sexual-health content, Data safety / App Privacy answers "no data collected", Health usage strings, screenshots list pointing to `docs/screenshots/`), `docs/store/review-notes.md` (what a reviewer needs: no account, no server, how to reach Health settings).
Test: `tools/ci/store.test.ts`: `app.json` has `NSPrivacyTracking false` and no collected data types; `eas.json` has the three profiles; `listing-en-AU.md` contains the §2.3 first-paragraph sentence verbatim and none of the §8.7 forbidden words (import the list the copy test uses); OTA guard: `app.json` has `updates.enabled` false or `runtimeVersion.policy` `appVersion` (so engine parameter changes can only ship as builds; §6.6).

- [x] Steps: failing test, implement, pass, `pnpm -s test`, commit; BACKLOG `P5-3`. Owner-only (PROGRESS "Needs human"): App Store Connect and Play Console accounts, signing credentials, `EXPO_TOKEN`, export-compliance confirmation, Play health declaration submission, store screenshots upload.

### Task 15: In-app policies, consent record and open-sourcing files (Phase 5)

**Files:** Create `apps/mobile/src/app/settings/legal.tsx` (renders `docs/privacy-policy.md` and `consumer-health-data-policy.md` text bundled as copy: add `copy/policy.en-AU.json` generated by `tools/ci/policy.ts` from the two docs so the app never fetches them; the test fails if the JSON is stale), `LICENSE` (AGPL-3.0 text) at the root, `packages/engine/LICENSE` exists (MIT), `CONTRIBUTING.md`, `SECURITY.md`, `TRADEMARK.md` (name and logo policy per §6.7), `README.md` update (build, test, run, privacy claims with links to the tests that enforce them).
- [x] The root `LICENSE` is a licence decision the plan already makes (§6.7: AGPL-3.0 at launch). Add the file, but record in DECISIONS that publishing the repository and the trademark check on the six taglines remain owner actions; do not push or change visibility.
- [x] Consent record (§2.5): onboarding already has "I understand what Sanguine stores and where." (copy line 96); store its acceptance as a `setting` row `consent.v1 = { at, version }` with a test, and show it in Settings > Privacy > "Your consent" with a withdraw action that opens Delete all data. Test first in `apps/mobile/src/data/consent.test.ts`.
- [x] Tests, typecheck, lint, commit; BACKLOG `P5-4`.

### Task 16: Localisation infrastructure and en-GB, en-US (Phase 6, §6.4)

**Files:** Modify `apps/mobile/src/i18n/index.ts`, create `copy/en-GB.json`, `copy/en-US.json` as sparse override files (only keys whose wording differs: "colour" is not used in copy, so mostly date words, "period" stays; produce the list with a script `tools/ci/locale-diff.ts`), `apps/mobile/src/i18n/locale.ts` (`pickLocale(deviceLocales)`, `usesFahrenheit(locale)`, `firstWeekday(deviceLocale)` from `expo-localization` `getCalendars()`), `apps/mobile/src/features/logging/MoreSection.tsx` and `insights.tsx` temperature display through one `formatTemp(celsius, unit)`; temperatures are stored °C always (§7.3).
Test: `apps/mobile/src/i18n/locale.test.ts` (en-US → °F, en-AU/en-GB → °C; unknown locale → en-AU; weekday from calendar), `formatTemp.test.ts` (36.5 °C → "97.7 °F"; entry parsing of °F back to 36.5 °C within 0.05), key-parity test: every override key exists in `en-AU.json`; fallback test: a missing key resolves to en-AU. Snapshot test of the Today model and the Calendar header for each locale ("locale snapshot tests", §10).
- [x] The Natural Cycles importer's °F handling (D-056) already converts; reuse its converter, do not duplicate.
- [x] Settings > Appearance gets a "Language" row listing only the shipped locales and "Device setting". Maestro: switch to en-US, enter a temperature in °F, see °F in Insights. Screenshots `docs/screenshots/P6-1-devclient/`.
- [x] Commit; BACKLOG `P6-1`.

### Task 17: de, fr, es, pt-BR scaffolding without machine translation (Phase 6)

PLAN §6.4: professional translators with a clinician check; machine translation is not used for any sentence the regulatory wording table covers. No translator exists here, so this task builds everything except the translations and does not fabricate them.
- [x] `tools/ci/extract-strings.ts` writes `docs/i18n/strings-for-translation.csv` (key, en-AU text, context note, `regulatory` yes/no from a list of key prefixes `legal.*`, `flags.*`, `prediction.*`, `home.footer`), and `tools/ci/import-translations.ts` validates a returned CSV (all keys present, `{placeholders}` identical to source, no forbidden words translated-in, length within 150 % of source) and writes `copy/<locale>.json`. Tests with a tiny synthetic CSV.
- [x] i18n `resources` load a locale file only if it exists and passes the validator test at build; locales list in Settings > Language is derived from files present (so nothing half-translated can ship).
- [x] `docs/i18n/README.md` for the translator brief (tone: Clue register, women-addressed D-050, no "ladies"; regulatory rows are not to be paraphrased; the clinician check list). PROGRESS "Needs human": translators and clinician check for de, fr, es, pt-BR. BACKLOG `P6-2` (infrastructure done; translations open).

### Task 18: GDPR consent and US state policy (Phase 6, §2.5)

- [x] For locales whose region is EU/EEA/UK (`getLocales()[0].regionCode` in a constant `EXPLICIT_CONSENT_REGIONS`), onboarding shows an explicit-consent step (Art. 9) before any data entry: separate checkbox "I agree that Sanguine stores my health information on this phone." with the plain statement of purpose; refusing leaves the app unusable and says why; the record is the Task 15 consent row with `basis: 'art9-explicit'`. Elsewhere the existing single-line consent applies. Test-first on a pure `consentRequirement(region)` function and an RNTL test of the step.
- [x] `docs/dpia.md` update: the controller identity stays TBD (human); add the representative requirement and the Task 18 mechanism. `docs/consumer-health-data-policy.md`: add the Washington MHMDA / Nevada SB 370 / Connecticut rights text (access, deletion, withdraw consent: all served by Export and Delete all data; no sale, no sharing, no geofencing). Regenerate `copy/policy.en-AU.json`. Needs human: legal review, GDPR representative appointment (PLAN §10 exit criterion).
- [x] Tests, typecheck, lint, commit; BACKLOG `P6-3`.

### Task 19: Close-out

- [x] Update `docs/agents/handoff.md`: in flight = none; next steps = P3-14 Android pass (now including P4-3 runtime check and the Android cloud/Drive flow), P3-5b, Phase 5 owner items; the Needs-human list gains: Apple iCloud container + device check, Google OAuth client id, Apple Watch wrist-temperature check, Play health declaration text (`docs/regulatory/play-health-declaration.md`: write the draft now from §6.6 and §7.6, one page).
- [x] `pnpm -s test`, `pnpm -s typecheck`, `pnpm lint` green; `git status` shows only the peers' files; message `sanguine-ec` and `sanguine-a4` that the simulator is free and which decision ids were taken.

## Blocked by owner decision (not planned here)

- **P3-14** full Android check: needs the emulator (forbidden until the owner schedules it). Everything Android in this plan is code-only and listed in the P3-14 line.
- **P3-5b** Android widget: waits on expo-widgets' Android renderer (D-047).
- **Phase 5/6 owner-only items** (listed in PROGRESS "Needs human" by Tasks 14, 15, 17, 18): store accounts and signing, `EXPO_TOKEN`, export-compliance answers, Play/Apple health declarations, legal review of policies, GDPR representative, translators and clinician check, publishing the repository, trademark check on taglines, real-device checks. Phase 7 (regulated tier) is an optional funded decision, not part of this plan.
