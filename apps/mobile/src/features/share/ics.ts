// Calendar export for someone else (P8-2, roadmap R2-3, owner-approved in D-077, rules in D-079): the predicted period as an
// all-day range event, optionally the fertile range, as an iCalendar file the user sends through the share sheet. Pure.
import { addDays, type Interval, type Prediction } from '@sanguine/engine';

/** Days at or above this probability of being in the fertile window make the exported range (the §8.3 card threshold). */
export const ICS_FERTILE_MIN_P = 0.2;

/** The ranges to export: the 80% next-period interval, and the fertile range only when asked for and at least two days long. */
export function calendarRanges(p: Prediction, o: { fertile: boolean }): { period?: Interval; fertile?: Interval } {
  if (p.suspended || !p.nextPeriod) return {};
  const days = o.fertile ? (p.fertileDays ?? []).filter((d) => d.pInWindow >= ICS_FERTILE_MIN_P).map((d) => d.date).sort() : [];
  const lo = days[0];
  const hi = days[days.length - 1];
  // never a single highlighted day (CLAUDE.md): a one-day range is left out
  return { period: p.nextPeriod.i80, ...(lo && hi && lo !== hi ? { fertile: { lo, hi } } : {}) };
}

const date = (d: string) => d.replaceAll('-', '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** RFC 5545 §3.1: lines longer than 75 octets continue on the next line after CRLF and a space, never inside a character. */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with the space
    if (size + n > limit) { out.push(cur); cur = ''; size = 0; }
    cur += ch;
    size += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function event(kind: 'period' | 'fertile', r: Interval, title: string, o: { installId: string; sequence: number; now: string }): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:sanguine-${kind}-${o.installId}@sanguine.invalid`, // stable per install, so a resend replaces the event where UID is honoured
    `DTSTAMP:${o.now.replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
    `SEQUENCE:${o.sequence}`,
    `DTSTART;VALUE=DATE:${date(r.lo)}`,
    `DTEND;VALUE=DATE:${date(addDays(r.hi, 1))}`, // DTEND of an all-day event is exclusive
    `SUMMARY:${icsText(title)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ];
}

export function buildIcs(p: { period: Interval; fertile?: Interval; title: string; fertileTitle: string; installId: string; sequence: number; now: string }): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sanguine//Calendar export//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ...event('period', p.period, p.title, p),
    ...(p.fertile ? event('fertile', p.fertile, p.fertileTitle, p) : []),
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
