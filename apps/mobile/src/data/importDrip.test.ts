import { strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';
import { parseDrip, readDrip } from './importDrip';

// Header as drip writes it: dotted paths of its CycleDay schema v4 (drip main, db/schemas/4.js, checked 2026-10-10, D-078).
const HEADER = [
  'date', 'temperature.value', 'temperature.exclude', 'temperature.time', 'temperature.note', 'bleeding.value', 'bleeding.exclude',
  'mucus.feeling', 'mucus.texture', 'mucus.value', 'mucus.exclude', 'cervix.opening', 'cervix.firmness', 'cervix.position', 'cervix.exclude',
  'note.value', 'desire.value', 'sex.solo', 'sex.partner', 'sex.condom', 'sex.pill', 'sex.iud', 'sex.patch', 'sex.ring', 'sex.implant',
  'sex.diaphragm', 'sex.none', 'sex.other', 'sex.note', 'pain.cramps', 'pain.ovulationPain', 'pain.headache', 'pain.backache', 'pain.nausea',
  'pain.tenderBreasts', 'pain.migraine', 'pain.other', 'pain.note', 'mood.happy', 'mood.sad', 'mood.stressed', 'mood.balanced', 'mood.fine',
  'mood.anxious', 'mood.energetic', 'mood.fatigue', 'mood.angry', 'mood.other', 'mood.note',
];
const row = (o: Partial<Record<(typeof HEADER)[number], string>>) => HEADER.map((h) => o[h] ?? '');

describe('parseDrip (P8-1, D-078)', () => {
  it('maps bleeding, temperature, mucus, cervix, desire, sex, pain, mood and notes onto DailyRow', () => {
    const { rows, problems } = parseDrip([
      HEADER,
      row({ date: '2026-09-01', 'bleeding.value': '2', 'bleeding.exclude': 'false', 'temperature.value': '36.35', 'temperature.exclude': 'false', 'temperature.time': '06:40', 'pain.cramps': 'true', 'pain.migraine': 'true', 'mood.sad': 'true', 'note.value': 'long day' }),
      row({ date: '2026-09-02', 'bleeding.value': '0', 'bleeding.exclude': 'true' }),
      row({ date: '2026-09-14', 'mucus.feeling': '2', 'mucus.texture': '2', 'mucus.value': '4', 'mucus.exclude': 'false', 'cervix.opening': '2', 'cervix.firmness': '1', 'cervix.position': '2', 'cervix.exclude': 'false', 'desire.value': '2', 'sex.partner': 'true', 'sex.condom': 'true', 'pain.ovulationPain': 'true' }),
      row({ date: '2026-09-15', 'temperature.value': '36.9', 'temperature.exclude': 'true', 'temperature.note': 'fever', 'mucus.feeling': '1', 'mucus.texture': '0', 'mucus.exclude': 'false', 'sex.partner': 'true', 'sex.none': 'true', 'mood.balanced': 'true', 'mood.angry': 'true', 'desire.value': '0' }),
    ]);
    expect(problems).toEqual([]);
    expect(rows).toEqual([
      { day: '2026-09-01', flow: 'medium', tempC: 36.35, tempTime: '06:40', symptoms: ['cramps', 'headache', 'mood_low'], note: 'long day' },
      { day: '2026-09-02', flow: 'spotting', flowKind: 'intermenstrual' },
      { day: '2026-09-14', mucus: 'eggwhite', cervix: { opening: 'open', firmness: 'soft', position: 'high' }, sex: { protected: true }, symptoms: ['mid_cycle_pain', 'high_libido'] },
      { day: '2026-09-15', tempC: 36.9, tempExcluded: true, mucus: 'dry', sex: { protected: false }, symptoms: ['calm', 'irritability', 'low_libido'], note: 'Temperature: fever' },
    ]);
  });
  it('mucus takes the higher of sensation and appearance', () => {
    const one = (feeling: string, texture: string) => parseDrip([HEADER, row({ date: '2026-09-01', 'mucus.feeling': feeling, 'mucus.texture': texture, 'mucus.exclude': 'false' })]).rows[0]?.mucus;
    expect(one('0', '0')).toBe('dry');
    expect(one('2', '0')).toBe('watery');
    expect(one('0', '1')).toBe('creamy');
    expect(one('2', '1')).toBe('watery');
    expect(one('3', '0')).toBe('eggwhite');
    expect(one('', '1')).toBe('creamy');
  });
  it('joins the per-section notes into one labelled note', () => {
    const { rows } = parseDrip([HEADER, row({ date: '2026-09-01', 'note.value': 'a', 'pain.note': 'left side', 'mood.note': 'ok', 'sex.note': 'x', 'pain.other': 'true' })]);
    expect(rows[0]?.note).toBe('a\nPain: left side\nMood: ok\nSex: x');
    expect(rows[0]?.symptoms).toEqual(['other_pain']);
  });
  it('excluded mucus and cervix, solo sex, contraceptives and unmapped moods are reported, never guessed', () => {
    const { rows, problems } = parseDrip([
      HEADER,
      row({ date: '2026-09-01', 'mucus.feeling': '3', 'mucus.texture': '2', 'mucus.exclude': 'true', 'cervix.opening': '0', 'cervix.firmness': '0', 'cervix.position': '0', 'cervix.exclude': 'true', 'bleeding.value': '1', 'bleeding.exclude': 'false' }),
      row({ date: '2026-09-02', 'sex.solo': 'true', 'sex.pill': 'true', 'mood.fine': 'true', 'mood.other': 'true', 'bleeding.value': '1', 'bleeding.exclude': 'false' }),
      row({ date: '2026-09-03', 'cervix.opening': '1', 'bleeding.value': '7' }),
    ]);
    expect(rows).toEqual([{ day: '2026-09-01', flow: 'light' }, { day: '2026-09-02', flow: 'light' }]);
    expect(problems).toEqual([
      'line 4: bleeding "7" not recognised',
      'line 4: cervix needs opening, firmness and position, not imported',
      'not imported: cervix marked excluded ×1, mood fine ×1, mood other ×1, mucus marked excluded ×1, sex solo ×1, sex.pill ×1',
    ]);
  });
  it('an export from an older drip schema with fewer columns still imports', () => {
    const { rows, problems } = parseDrip([['date', 'bleeding.value', 'bleeding.exclude', 'temperature.value', 'temperature.exclude'], ['2026-09-01', '3', 'false', '', ''], ['2026-09-02', '', '', '97.7', 'false']]);
    expect(problems).toEqual([]);
    expect(rows).toEqual([{ day: '2026-09-01', flow: 'heavy' }, { day: '2026-09-02', tempC: 36.5 }]);
  });
  it('a bad date or an implausible temperature is reported', () => {
    const { rows, problems } = parseDrip([HEADER, row({ date: 'yesterday', 'bleeding.value': '1' }), row({ date: '2026-09-02', 'temperature.value': '12' })]);
    expect(rows).toEqual([]);
    expect(problems).toEqual(['line 2: "yesterday" is not a date', 'line 3: temperature "12" is out of range']);
  });
});

describe('readDrip', () => {
  it('reads drip CSV text, with a quoted note holding a comma and a quote (drip quotes and lowercases strings)', () => {
    const text = `${HEADER.join(',')}\n${row({ date: '2026-09-01', 'bleeding.value': '1', 'bleeding.exclude': 'false', 'note.value': '"tired, ""very"""' }).join(',')}`;
    expect(parseCsv(text)[1]?.[HEADER.indexOf('note.value')]).toBe('tired, "very"');
    expect(readDrip(strToU8(text))?.rows).toEqual([{ day: '2026-09-01', flow: 'light', note: 'tired, "very"' }]);
  });
  it('is null for a Natural Cycles CSV and for a CSV of period starts', () => {
    expect(readDrip(strToU8('Date,Menstruation,Data Flag\n2026-09-01,MENSTRUATION,\n'))).toBeNull();
    expect(readDrip(strToU8('start\n2026-09-01\n'))).toBeNull();
    expect(readDrip(new Uint8Array([0x50, 0x4b, 3, 4]))).toBeNull();
  });
});
