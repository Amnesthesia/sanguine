// Day/month/year stepping for the DateField. Pure; clamps to [min, max] and keeps the day inside the month.
import { addDays } from '@sanguine/engine';

export type Unit = 'day' | 'month' | 'year';

const daysIn = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** `size` multiplies the step for a year (the date-of-birth selector jumps ten years at a time). */
export function stepDate(iso: string, unit: Unit, delta: 1 | -1, min: string, max: string, size = 1): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  let out: string;
  if (unit === 'day') out = addDays(iso, delta);
  else {
    let ny = y;
    let nm = m;
    if (unit === 'year') ny += delta * size;
    else { nm += delta; if (nm > 12) { nm = 1; ny++; } if (nm < 1) { nm = 12; ny--; } }
    out = `${pad(ny, 4)}-${pad(nm)}-${pad(Math.min(d, daysIn(ny, nm)))}`;
  }
  return out < min ? min : out > max ? max : out;
}
