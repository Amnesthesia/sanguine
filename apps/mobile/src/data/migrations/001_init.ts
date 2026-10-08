// PLAN.md §5.2. Event rows are append-only: triggers abort any UPDATE or DELETE, so the rule holds even if app code is wrong.
// Projections (cycle, daily_log, biomarker, life_state) are rebuilt from the log; retract with a 'retract' event.
export const sql = `
CREATE TABLE IF NOT EXISTS schema_migration (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);

CREATE TABLE event (
  id            TEXT PRIMARY KEY,
  lamport       INTEGER NOT NULL,
  device_id     TEXT NOT NULL,
  recorded_at   TEXT NOT NULL,
  effective_day TEXT NOT NULL CHECK (effective_day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  tz            TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (length(kind) > 0),
  payload       TEXT NOT NULL,
  provenance    TEXT NOT NULL CHECK (provenance IN ('manual','imported','sensor')),
  source_app    TEXT,
  external_id   TEXT,
  retracts      TEXT REFERENCES event(id),
  schema_v      INTEGER NOT NULL DEFAULT 1,
  CHECK ((kind = 'retract') = (retracts IS NOT NULL))
);
CREATE INDEX event_day ON event(effective_day);
CREATE INDEX event_ext ON event(external_id);
CREATE INDEX event_retracts ON event(retracts);
CREATE INDEX event_order ON event(lamport, id);

CREATE TRIGGER event_no_update BEFORE UPDATE ON event
BEGIN SELECT RAISE(ABORT, 'event rows are append-only: retract instead of updating'); END;
CREATE TRIGGER event_no_delete BEFORE DELETE ON event
BEGIN SELECT RAISE(ABORT, 'event rows are append-only: retract instead of deleting'); END;

CREATE TABLE cycle (
  id          TEXT PRIMARY KEY,
  start_day   TEXT NOT NULL UNIQUE,
  end_day     TEXT,
  next_start  TEXT,
  length_days INTEGER,
  bleed_days  INTEGER,
  quality     TEXT NOT NULL CHECK (quality IN ('valid','suspect_skip','suspect_short','user_excluded','life_state')),
  ov_day      TEXT, ov_sd REAL, ov_basis TEXT,
  luteal_days INTEGER
);
CREATE TABLE daily_log (
  day           TEXT PRIMARY KEY,
  flow          TEXT CHECK (flow IS NULL OR flow IN ('none','spotting','light','medium','heavy')),
  flow_kind     TEXT CHECK (flow_kind IS NULL OR flow_kind IN ('period','withdrawal_bleed','intermenstrual','on_contraception')),
  symptoms      TEXT NOT NULL DEFAULT '[]',
  sex           TEXT,
  notes_cipher  BLOB,
  updated_event TEXT NOT NULL REFERENCES event(id)
);
CREATE TABLE biomarker (
  id          TEXT PRIMARY KEY,
  day         TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('bbt','skin_temp','lh','mucus','cervix','preg_test','progesterone')),
  value       TEXT NOT NULL,
  measured_at TEXT,
  source      TEXT NOT NULL,
  provenance  TEXT NOT NULL,
  disturbed   INTEGER NOT NULL DEFAULT 0,
  event_id    TEXT NOT NULL REFERENCES event(id)
);
CREATE INDEX biomarker_day ON biomarker(day, type);
CREATE TABLE life_state (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, detail TEXT NOT NULL, from_day TEXT NOT NULL, until_day TEXT,
  event_id TEXT NOT NULL REFERENCES event(id)
);
CREATE TABLE prediction_score (
  cycle_id TEXT PRIMARY KEY, engine_version TEXT, predicted_day TEXT, lo80 TEXT, hi80 TEXT,
  actual_day TEXT, basis TEXT, confidence TEXT, abs_error INTEGER, in80 INTEGER, in95 INTEGER
);
CREATE TABLE setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE health_sync (
  platform     TEXT NOT NULL,
  data_type    TEXT NOT NULL,
  direction    TEXT NOT NULL,
  anchor       TEXT,
  last_sync_at TEXT,
  PRIMARY KEY (platform, data_type)
);
CREATE TABLE health_link (
  event_id     TEXT NOT NULL REFERENCES event(id),
  platform     TEXT NOT NULL,
  external_id  TEXT NOT NULL,
  direction    TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  PRIMARY KEY (platform, external_id)
);
`;
