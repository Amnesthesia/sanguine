import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';
import { parseNaturalCycles, readNaturalCycles } from './importNaturalCycles';

// Synthetic rows in the layout of a real Natural Cycles "daily entries" export (header verified against a sample, D-056).
const HEADER = ['Date', 'Temperature', 'Menstruation', 'LH test', 'Pregnancy test', 'Had sex', 'Notes', 'Skipped', 'Source', 'Data Flag', 'Menstruation Quantity', 'Cervical Mucus Consistency', 'Cervical Mucus Quantity', 'Sex Type', 'Libido', 'Covid Test'];
const row = (o: Partial<Record<(typeof HEADER)[number], string>>) => HEADER.map((h) => o[h] ?? '');

describe('parseNaturalCycles (P3-13)', () => {
  it('maps flow, temperature, tests, mucus, symptoms and notes onto DailyRow', () => {
    const { rows, problems } = parseNaturalCycles([
      HEADER,
      row({ Date: '2026-09-01', Menstruation: 'MENSTRUATION', 'Menstruation Quantity': 'HEAVY', Temperature: '36.269999999999996', Notes: 'Migraine', 'Data Flag': 'PAIN_CRAMPS,PAIN_HEADACHE' }),
      row({ Date: '2026-09-02', Menstruation: 'SPOTTING' }),
      row({ Date: '2026-09-14', 'LH test': 'YES', 'Cervical Mucus Consistency': 'EGGWHITE', 'Cervical Mucus Quantity': 'HEAVY', Temperature: '36.5' }),
      row({ Date: '2026-09-15', 'LH test': 'NO', 'Pregnancy test': 'NO' }),
    ]);
    expect(problems).toEqual(['not imported: Cervical Mucus Quantity ×1']); // Sanguine records mucus quality only
    expect(rows).toEqual([
      { day: '2026-09-01', flow: 'heavy', tempC: 36.27, note: 'Migraine', symptoms: ['cramps', 'headache'] },
      { day: '2026-09-02', flow: 'spotting' },
      { day: '2026-09-14', tempC: 36.5, lh: 'positive', mucus: 'eggwhite' },
      { day: '2026-09-15', lh: 'negative', pregTest: 'negative' },
    ]);
  });
  it('bleeding after a pregnancy loss is post_pregnancy flow, never a period', () => {
    expect(parseNaturalCycles([HEADER, row({ Date: '2026-09-01', Menstruation: 'MISCARRIAGE_BLEEDING', 'Menstruation Quantity': 'LIGHT' })]).rows)
      .toEqual([{ day: '2026-09-01', flow: 'light', flowKind: 'post_pregnancy' }]);
  });
  it('a period day without a known amount is medium; an unknown amount is reported, the day is kept', () => {
    const { rows, problems } = parseNaturalCycles([HEADER, row({ Date: '2026-09-01', Menstruation: 'MENSTRUATION' }), row({ Date: '2026-09-02', Menstruation: 'MENSTRUATION', 'Menstruation Quantity': 'SUPER' })]);
    expect(rows).toEqual([{ day: '2026-09-01', flow: 'medium' }, { day: '2026-09-02', flow: 'medium' }]);
    expect(problems).toEqual(['line 3: menstruation quantity "SUPER" not recognised, imported as medium']);
  });
  it('a deviation flag or a skipped day marks the temperature disturbed', () => {
    const { rows } = parseNaturalCycles([
      HEADER,
      row({ Date: '2026-09-01', Temperature: '36.9', 'Data Flag': 'DEVIATION_REASON_ALCOHOL,MOOD_TIRED' }),
      row({ Date: '2026-09-02', Temperature: '36.8', Skipped: '1' }),
      row({ Date: '2026-09-03', 'Data Flag': 'DEVIATION_REASON_SICK' }),
    ]);
    expect(rows).toEqual([
      { day: '2026-09-01', tempC: 36.9, tempExcluded: true, symptoms: ['fatigue'] },
      { day: '2026-09-02', tempC: 36.8, tempExcluded: true },
    ]);
  });
  it('Fahrenheit readings convert; implausible readings are left out and reported', () => {
    const { rows, problems } = parseNaturalCycles([HEADER, row({ Date: '2026-09-01', Temperature: '97.7' }), row({ Date: '2026-09-02', Temperature: '3.65' })]);
    expect(rows).toEqual([{ day: '2026-09-01', tempC: 36.5 }]);
    expect(problems).toEqual(['line 3: temperature "3.65" is out of range']);
  });
  it('a temperature from another device (Source set) is left out, because it may be a wearable reading, not BBT', () => {
    const { rows, problems } = parseNaturalCycles([HEADER, row({ Date: '2026-09-01', Temperature: '36.4', Source: 'OURA' })]);
    expect(rows).toEqual([]);
    expect(problems).toEqual(['1 temperature from another device (Source "OURA") not imported']);
  });
  it('reports flags and columns it cannot map instead of guessing', () => {
    const { rows, problems } = parseNaturalCycles([
      HEADER,
      row({ Date: '2026-09-01', 'Data Flag': 'MOOD_HAPPY,MOOD_HAPPY,SKIN_OILY', 'Had sex': 'YES', Libido: 'HIGH' }),
      row({ Date: '2026-09-02', 'Data Flag': 'MOOD_HAPPY', Menstruation: 'SOMETHING_NEW' }),
      row({ Date: 'yesterday' }),
    ]);
    expect(rows).toEqual([]);
    expect(problems).toEqual([
      'line 3: menstruation "SOMETHING_NEW" not recognised',
      'line 4: "yesterday" is not a date',
      'not imported: Had sex ×1, Libido ×1, MOOD_HAPPY ×3, SKIN_OILY ×1',
    ]);
  });
  it('Excel serial dates (1900 and 1904 systems)', () => {
    expect(parseNaturalCycles([HEADER, row({ Date: '44335', Menstruation: 'SPOTTING' })]).rows[0]?.day).toBe('2021-05-19');
    expect(parseNaturalCycles([HEADER, row({ Date: '42873', Menstruation: 'SPOTTING' })], { date1904: true }).rows[0]?.day).toBe('2021-05-19');
  });
});

// Minimal xlsx in the shape Excel writes: shared strings, a numeric date cell, an inline string.
function xlsx(cells: string, strings: string[], date1904 = false): Uint8Array {
  return zipSync({
    'xl/workbook.xml': strToU8(`<workbook><workbookPr${date1904 ? ' date1904="1"' : ''}/><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/sharedStrings.xml': strToU8(`<sst>${strings.map((s) => (s.startsWith('<r>') ? `<si>${s}</si>` : `<si><t>${s}</t></si>`)).join('')}</sst>`),
    'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData>${cells}</sheetData></worksheet>`),
  });
}

describe('readNaturalCycles: picks the export out of xlsx, zip or csv bytes', () => {
  it('reads an xlsx: shared strings, entities, rich text, sparse cells, serial dates', () => {
    const strings = ['Date', 'Temperature', 'Menstruation', 'Notes', 'MENSTRUATION', 'Tom &amp; Jerry', '<r><t>Hot</t></r><r><t> day</t></r>', 'Data Flag'];
    const cells = '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>7</v></c></row>'
      + '<row r="2"><c r="A2" s="1"><v>44335</v></c><c r="B2" t="s"/><c r="C2" t="s"><v>4</v></c><c r="D2" t="s"><v>5</v></c></row>'
      + '<row r="3"><c r="A3" s="1"><v>44336</v></c><c r="B3"><v>36.07</v></c><c r="D3" t="s"><v>6</v></c></row>'
      + '<row r="4"><c r="A4" s="1"><v>44337</v></c><c r="D4" t="inlineStr"><is><t>&lt;3 &#x110000;</t></is></c></row><row r="5"/>';
    const bytes = xlsx(cells, strings);
    expect(readNaturalCycles(bytes)).toEqual({
      rows: [
        { day: '2021-05-19', flow: 'medium', note: 'Tom & Jerry' },
        { day: '2021-05-20', tempC: 36.07, note: 'Hot day' },
        { day: '2021-05-21', note: '<3 &#x110000;' },
      ],
      problems: [],
    });
  });
  it('honours the 1904 date system', () => {
    const bytes = xlsx('<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>3</v></c></row><row r="2"><c r="A2"><v>42873</v></c><c r="B2" t="s"><v>2</v></c></row>', ['Date', 'Menstruation', 'SPOTTING', 'LH test'], true);
    expect(readNaturalCycles(bytes)?.rows).toEqual([{ day: '2021-05-19', flow: 'spotting' }]);
  });
  it('reads a CSV, plain or inside a zip as "Daily Entries.csv"', () => {
    const csv = toCsv(HEADER, [row({ Date: '2026-09-01', Menstruation: 'MENSTRUATION', 'Menstruation Quantity': 'LIGHT', Notes: 'a, "quoted" note' })]);
    const want = { rows: [{ day: '2026-09-01', flow: 'light', note: 'a, "quoted" note' }], problems: [] };
    expect(readNaturalCycles(strToU8(csv))).toEqual(want);
    expect(readNaturalCycles(zipSync({ 'export/Daily Entries.csv': strToU8(csv) }))).toEqual(want);
  });
  it('anything else is not a Natural Cycles export', () => {
    expect(readNaturalCycles(strToU8('start,end\n2026-09-01,2026-09-05\n'))).toBeNull();
    expect(readNaturalCycles(strToU8('Date,Menstruation\n2026-09-01,yes\n'))).toBeNull(); // generic period CSV with similar names
    expect(readNaturalCycles(zipSync({ 'events.jsonl': strToU8(''), 'manifest.json': strToU8('{}') }))).toBeNull();
  });
});
