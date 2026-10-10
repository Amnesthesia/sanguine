// Moon phases on the calendar (D-089): a decoration for users whose recent cycles run close to a lunar month. Nothing here feeds the
// engine (CLAUDE.md: only period dates and biomarkers change a prediction). Pure.
// Principal phase instants from Meeus, Astronomical Algorithms, ch. 49, without the planetary terms (each < 1 min); error well under an
// hour, so the local day is right except within minutes of midnight.
import type { CycleRecord, ISODate } from '@sanguine/engine';

export type MoonPhase = 'new' | 'first' | 'full' | 'last';
const PHASES: MoonPhase[] = ['new', 'first', 'full', 'last'];
const SYNODIC = 29.530588861;
const rad = (d: number) => (d * Math.PI) / 180;

/** Instant (ms since epoch, UTC) of the phase `k` lunations after the new moon of 6 Jan 2000; k ends in .0, .25, .5 or .75. */
export function phaseInstant(k: number): number {
  const T = k / 1236.85;
  const jde = 2451550.09766 + SYNODIC * k + 0.00015437 * T ** 2 - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
  const E = 1 - 0.002516 * T - 0.0000074 * T ** 2;
  const M = rad(2.5534 + 29.1053567 * k - 0.0000014 * T ** 2 - 0.00000011 * T ** 3);
  const Mp = rad(201.5643 + 385.81693528 * k + 0.0107582 * T ** 2 + 0.00001238 * T ** 3 - 0.000000058 * T ** 4);
  const F = rad(160.7108 + 390.67050284 * k - 0.0016118 * T ** 2 - 0.00000227 * T ** 3 + 0.000000011 * T ** 4);
  const O = rad(124.7746 - 1.56375588 * k + 0.0020672 * T ** 2 + 0.00000215 * T ** 3);
  const { sin, cos } = Math;
  const frac = Math.round((k - Math.floor(k)) * 4) % 4;
  let c: number;
  if (frac === 0 || frac === 2) {
    const full = frac === 2;
    c = (full ? -0.40614 : -0.4072) * sin(Mp) + (full ? 0.17302 : 0.17241) * E * sin(M) + (full ? 0.01614 : 0.01608) * sin(2 * Mp)
      + (full ? 0.01043 : 0.01039) * sin(2 * F) + (full ? 0.00734 : 0.00739) * E * sin(Mp - M) + (full ? -0.00515 : -0.00514) * E * sin(Mp + M)
      + (full ? 0.00209 : 0.00208) * E * E * sin(2 * M) - 0.00111 * sin(Mp - 2 * F) - 0.00057 * sin(Mp + 2 * F) + 0.00056 * E * sin(2 * Mp + M)
      - 0.00042 * sin(3 * Mp) + 0.00042 * E * sin(M + 2 * F) + 0.00038 * E * sin(M - 2 * F) - 0.00024 * E * sin(2 * Mp - M) - 0.00017 * sin(O);
  } else {
    c = -0.62801 * sin(Mp) + 0.17172 * E * sin(M) - 0.01183 * E * sin(Mp + M) + 0.00862 * sin(2 * Mp) + 0.00804 * sin(2 * F)
      + 0.00454 * E * sin(Mp - M) + 0.00204 * E * E * sin(2 * M) - 0.0018 * sin(Mp - 2 * F) - 0.0007 * sin(Mp + 2 * F) - 0.0004 * sin(3 * Mp)
      - 0.00034 * E * sin(2 * Mp - M) + 0.00032 * E * sin(M + 2 * F) + 0.00032 * E * sin(M - 2 * F) - 0.00028 * E * E * sin(Mp + 2 * M)
      + 0.00027 * E * sin(2 * Mp + M) - 0.00017 * sin(O);
    const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp) - 0.00002 * cos(Mp - M) + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F);
    c += frac === 1 ? W : -W;
  }
  return (jde + c - 2440587.5) * 86_400_000;
}

/** The principal phases whose local day falls in [from, to]. `localDay` turns an instant into the user's calendar day. */
export function moonPhaseDays(from: ISODate, to: ISODate, localDay: (ms: number) => ISODate): Map<ISODate, MoonPhase> {
  const out = new Map<ISODate, MoonPhase>();
  const lunations = (iso: ISODate) => (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(2000, 0, 6)) / 86_400_000 / SYNODIC;
  for (let q = Math.floor(lunations(from) * 4) - 4; q <= Math.ceil(lunations(to) * 4) + 4; q++) {
    const day = localDay(phaseInstant(q / 4));
    if (day >= from && day <= to) out.set(day, PHASES[((q % 4) + 4) % 4] as MoonPhase);
  }
  return out;
}

/** Last N typical cycles all within this many days of a lunar month (29.5), and their mean within half that: "very regular and lunar". */
export const LUNAR_CYCLES = 6;
export const LUNAR_MIN = 28;
export const LUNAR_MAX = 31;
export function lunarAligned(cycles: CycleRecord[]): boolean {
  const recent = cycles.filter((c) => c.quality === 'valid' && c.length !== undefined).sort((a, b) => (a.start < b.start ? -1 : 1)).slice(-LUNAR_CYCLES);
  if (recent.length < LUNAR_CYCLES) return false;
  const lengths = recent.map((c) => c.length as number);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  return lengths.every((l) => l >= LUNAR_MIN && l <= LUNAR_MAX) && Math.abs(mean - SYNODIC) <= 1;
}

/** Southern-hemisphere regions see the waxing moon lit on the left; the glyph follows the device region (no location is read). */
const SOUTH = new Set(['AU', 'NZ', 'ZA', 'AR', 'CL', 'UY', 'PY', 'BR', 'BO', 'PE', 'LS', 'SZ', 'NA', 'BW', 'ZW', 'MZ', 'MG', 'MU', 'FJ', 'PG', 'NC', 'WS', 'TO']);
export const southernRegion = (region: string | null | undefined): boolean => Boolean(region && SOUTH.has(region.toUpperCase()));
