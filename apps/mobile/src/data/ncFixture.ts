// Test-only (P8-12, D-091): a fake Natural Cycles "daily entries" export written from a synthetic user's true timeline
// (tools/backtest/src/events.ts), as the table and as xlsx bytes in the layout the real export uses (D-056).
import { strToU8, zipSync } from 'fflate';
import { addDays, diffDays, type ISODate } from '@sanguine/engine';
import type { Timeline } from '../../../../tools/backtest/src/events';
import type { Rng } from '../../../../tools/backtest/src/rng';

export const NC_HEADER = ['Date', 'Temperature', 'Menstruation', 'LH test', 'Pregnancy test', 'Had sex', 'Notes', 'Skipped', 'Source', 'Data Flag',
  'Menstruation Quantity', 'Cervical Mucus Consistency', 'Cervical Mucus Quantity', 'Sex Type', 'Libido', 'Covid Test'] as const;
type Col = (typeof NC_HEADER)[number];

const BLEED = ['HEAVY', 'HEAVY', 'MEDIUM', 'LIGHT', 'LIGHT'];
const LOW_C = 36.3;
const HIGH_C = 36.7; // a 0.4 °C rise after ovulation, inside the 0.3-0.5 °C textbook range

/** One row per day with an entry, oldest first; days with nothing logged are left out, as the app does. */
export function ncTable(t: Timeline, rng: Rng): string[][] {
  const rows = new Map<ISODate, Partial<Record<Col, string>>>();
  const set = (d: ISODate, o: Partial<Record<Col, string>>) => rows.set(d, { ...rows.get(d), ...o });
  // bleeding as logged: five days for each logged start; the second user habit skips days 2 and 4 (one-day gaps stay one period)
  t.observed.forEach((s, i) => {
    const isFragment = !t.starts.includes(s); // a mid-cycle bleed logged as a period
    const days = isFragment ? 2 : 5;
    for (let d = 0; d < days; d++) if (!(i % 2 === 1 && (d === 1 || d === 3))) set(addDays(s, d), { Menstruation: 'MENSTRUATION', 'Menstruation Quantity': BLEED[d] as string });
    if (!isFragment) set(addDays(s, 5), { Menstruation: 'SPOTTING' });
    set(s, { 'Data Flag': 'PAIN_CRAMPS' });
  });
  // physiology from the true timeline
  for (let k = 0; k + 1 < t.starts.length; k++) {
    const s = t.starts[k] as ISODate;
    const next = t.starts[k + 1] as ISODate;
    const ov = t.ovulation.get(s);
    const pregnant = !ov && t.lossBleed !== undefined && t.lossBleed > s && t.lossBleed < next;
    for (let d: ISODate = s; d < next; d = addDays(d, 1)) {
      if (rng.random() < 0.12) continue; // a forgotten morning
      const high = ov ? d > ov : pregnant && d < (t.lossBleed as ISODate);
      const disturbed = rng.random() < 0.03;
      const c = (high ? HIGH_C : LOW_C) + rng.normal(0, 0.06) + (disturbed ? 0.4 : 0);
      set(d, { Temperature: c.toFixed(2), ...(disturbed ? { 'Data Flag': 'DEVIATION_REASON_ALCOHOL' } : {}) });
    }
    if (ov) for (let d = -3; d <= 1; d++) set(addDays(ov, d), { 'LH test': d === -1 ? 'YES' : 'NO' });
    if (pregnant) {
      set(addDays(s, 35), { 'Pregnancy test': 'YES' });
      for (let d = 0; d < 5; d++) set(addDays(t.lossBleed as ISODate, d), { Menstruation: 'MISCARRIAGE_BLEEDING', 'Menstruation Quantity': d < 2 ? 'HEAVY' : 'LIGHT' });
    }
  }
  return [[...NC_HEADER], ...[...rows.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([d, o]) => NC_HEADER.map((h) => (h === 'Date' ? d : (o[h] ?? ''))))];
}

const colName = (i: number) => String.fromCharCode(65 + i);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** The table as an xlsx: dates as Excel serial numbers, temperatures as numbers, everything else inline strings. */
export function ncXlsx(table: string[][]): Uint8Array {
  const serial = (d: string) => diffDays(d, '1899-12-30');
  const xmlRows = table.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
    if (v === '') return '';
    const ref = `${colName(ci)}${ri + 1}`;
    if (ri > 0 && ci === 0) return `<c r="${ref}"><v>${serial(v)}</v></c>`;
    if (ri > 0 && ci === 1) return `<c r="${ref}"><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  return zipSync({
    'xl/workbook.xml': strToU8('<workbook><workbookPr/><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData>${xmlRows}</sheetData></worksheet>`),
  });
}
