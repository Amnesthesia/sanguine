import { describe, expect, it } from 'vitest';
import type { Prediction } from '@sanguine/engine';
import { buildIcs, calendarRanges } from './ics';

const base = { title: 'S', fertileTitle: 'F', installId: 'abc123', sequence: 1, now: '2026-10-10T08:47:00.000Z' };

describe('buildIcs (P8-2, D-079)', () => {
  it('writes the predicted period as one all-day range event with an exclusive end', () => {
    expect(buildIcs({ ...base, period: { lo: '2026-10-25', hi: '2026-11-01' } })).toBe([
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sanguine//Calendar export//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:sanguine-period-abc123@sanguine.invalid', 'DTSTAMP:20261010T084700Z', 'SEQUENCE:1',
      'DTSTART;VALUE=DATE:20261025', 'DTEND;VALUE=DATE:20261102', 'SUMMARY:S', 'TRANSP:TRANSPARENT', 'END:VEVENT',
      'END:VCALENDAR', '',
    ].join('\r\n'));
  });
  it('the fertile range is a second event with its own stable UID', () => {
    const ics = buildIcs({ ...base, period: { lo: '2026-10-25', hi: '2026-11-01' }, fertile: { lo: '2026-10-08', hi: '2026-10-14' } });
    expect(ics).toContain('UID:sanguine-fertile-abc123@sanguine.invalid\r\nDTSTAMP:20261010T084700Z\r\nSEQUENCE:1\r\nDTSTART;VALUE=DATE:20261008\r\nDTEND;VALUE=DATE:20261015\r\nSUMMARY:F');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
  it('a resend keeps the UIDs and raises the sequence, so calendars that honour UID replace the event', () => {
    const a = buildIcs({ ...base, period: { lo: '2026-10-25', hi: '2026-11-01' } });
    const b = buildIcs({ ...base, sequence: 2, period: { lo: '2026-10-27', hi: '2026-11-02' } });
    const uid = (s: string) => /UID:(.*)\r\n/.exec(s)?.[1];
    expect(uid(b)).toBe(uid(a));
    expect(b).toContain('SEQUENCE:2');
  });
  it('escapes text and folds long lines at 75 octets', () => {
    const ics = buildIcs({ ...base, title: `a,b;c\\d\n${'x'.repeat(80)}`, period: { lo: '2026-10-25', hi: '2026-10-25' } });
    const summary = ics.slice(ics.indexOf('SUMMARY:'), ics.indexOf('\r\nTRANSP'));
    expect(summary.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(summary.replace(/\r\n /g, '')).toBe(`SUMMARY:a\\,b\\;c\\\\d\\n${'x'.repeat(80)}`);
  });
  it('folding never splits a multi-byte character', () => {
    const ics = buildIcs({ ...base, title: 'é'.repeat(60), period: { lo: '2026-10-25', hi: '2026-10-25' } });
    const summary = ics.slice(ics.indexOf('SUMMARY:'), ics.indexOf('\r\nTRANSP'));
    expect(summary.replace(/\r\n /g, '')).toBe(`SUMMARY:${'é'.repeat(60)}`);
  });
});

const prediction = (o: Partial<Prediction>): Prediction => ({ engineVersion: 'x', asOf: '2026-10-10', cycleLength: { mean: 28, sd: 2, nu: 5, scale: 2, nCyclesUsed: 5 }, flags: [], cycleQuality: [], ...o });

describe('calendarRanges', () => {
  const next = { point: '2026-10-28', i80: { lo: '2026-10-25', hi: '2026-11-01' }, i95: { lo: '2026-10-23', hi: '2026-11-04' }, confidence: 'medium' as const, daysOfDataUsed: 140 };
  const fertileDays = [{ date: '2026-10-07', pInWindow: 0.1 }, { date: '2026-10-08', pInWindow: 0.3 }, { date: '2026-10-10', pInWindow: 0.8 }, { date: '2026-10-14', pInWindow: 0.2 }, { date: '2026-10-15', pInWindow: 0.05 }];
  it('takes the 80% period range, and the fertile range from the days at 0.2 or above', () => {
    expect(calendarRanges(prediction({ nextPeriod: next, fertileDays }), { fertile: true })).toEqual({ period: { lo: '2026-10-25', hi: '2026-11-01' }, fertile: { lo: '2026-10-08', hi: '2026-10-14' } });
  });
  it('leaves the fertile range out when not asked for (teen mode, or the estimate hidden)', () => {
    expect(calendarRanges(prediction({ nextPeriod: next, fertileDays }), { fertile: false })).toEqual({ period: { lo: '2026-10-25', hi: '2026-11-01' } });
  });
  it('a fertile range of one day is widened to nothing: never a single highlighted day', () => {
    expect(calendarRanges(prediction({ nextPeriod: next, fertileDays: [{ date: '2026-10-10', pInWindow: 0.9 }] }), { fertile: true }).fertile).toBeUndefined();
  });
  it('is empty without a next-period estimate or while prediction is suspended', () => {
    expect(calendarRanges(prediction({}), { fertile: true })).toEqual({});
    expect(calendarRanges(prediction({ nextPeriod: next, suspended: { reason: 'pregnant' } }), { fertile: true })).toEqual({});
  });
});
