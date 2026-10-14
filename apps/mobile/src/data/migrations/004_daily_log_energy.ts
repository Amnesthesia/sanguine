// P8-19 (D-108): the user's own energy rating, 1-5, per day; null when not logged. Validated at the event boundary, so no CHECK.
export const sql = `
ALTER TABLE daily_log ADD COLUMN energy INTEGER;
`;
