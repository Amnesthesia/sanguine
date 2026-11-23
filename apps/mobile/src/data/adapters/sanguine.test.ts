import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { emptyData } from '../format/sanguineData';
import { sanguineAdapter as a } from './sanguine';

const data = { ...emptyData('sanguine'), days: [{ date: '2026-09-01', flow: { level: 'light' as const } }] };

describe('sanguine adapter', () => {
  it('encodes, detects and decodes a plain file', () => {
    const f = a.encode!(data);
    expect(f.name).toBe('sanguine-data.json');
    expect(a.detect(f)).toBe('yes');
    expect(a.decode(f, {})).toEqual({ data, problems: [] });
  });
  it('reads sanguine-data.json inside a zip next to events.jsonl', () => {
    const f = { name: 'export.zip', bytes: zipSync({ 'events.jsonl': strToU8(''), 'sanguine-data.json': a.encode!(data).bytes }) };
    expect(a.detect(f)).toBe('yes');
    expect(a.decode(f, {}).data).toEqual(data);
  });
  it('rejects other files', () => {
    expect(a.detect({ name: 'x.csv', bytes: strToU8('a,b') })).toBe('no');
    expect(a.detect({ name: 'x.json', bytes: strToU8('{"format":"other"}') })).toBe('no');
    expect(a.detect({ name: 'x.zip', bytes: zipSync({ 'events.jsonl': strToU8('') }) })).toBe('no');
  });
});
