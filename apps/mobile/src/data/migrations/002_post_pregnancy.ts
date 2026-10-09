// P3-12 (D-053): daily_log.flow_kind gains 'post_pregnancy'. SQLite cannot alter a CHECK, so the table is recreated and its rows copied.
export const sql = `
CREATE TABLE daily_log_new (
  day           TEXT PRIMARY KEY,
  flow          TEXT CHECK (flow IS NULL OR flow IN ('none','spotting','light','medium','heavy')),
  flow_kind     TEXT CHECK (flow_kind IS NULL OR flow_kind IN ('period','withdrawal_bleed','intermenstrual','on_contraception','post_pregnancy')),
  clots         INTEGER NOT NULL DEFAULT 0,
  symptoms      TEXT NOT NULL DEFAULT '[]',
  sex           TEXT,
  notes_cipher  BLOB,
  updated_event TEXT NOT NULL REFERENCES event(id)
);
INSERT INTO daily_log_new (day, flow, flow_kind, clots, symptoms, sex, notes_cipher, updated_event)
  SELECT day, flow, flow_kind, clots, symptoms, sex, notes_cipher, updated_event FROM daily_log;
DROP TABLE daily_log;
ALTER TABLE daily_log_new RENAME TO daily_log;
`;
