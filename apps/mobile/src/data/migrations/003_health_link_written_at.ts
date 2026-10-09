// P4-1 (D-057): a health link records when it was written (our write time, or the platform's modification time for a read link),
// which orders conflicts between imports and bounds the 48 h echo check.
export const sql = `
ALTER TABLE health_link ADD COLUMN written_at TEXT NOT NULL DEFAULT '';
`;
