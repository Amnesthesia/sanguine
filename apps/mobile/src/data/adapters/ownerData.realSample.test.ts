// Local-only probe of the owner's real data (P8-42, D-161). Skipped unless OWNER_DATA points at a Sanguine data v1 .json or a Clue .zip
// (OWNER_ZIP_PASSWORD for a zip, OWNER_TODAY=YYYY-MM-DD optional). Explains why Today said "Rough estimate" and the hormone chart said "general".
// Prints aggregates only: never a date, note, symptom, temperature or the password.
import { readFileSync } from 'node:fs';
import { addDays, analyzeCycles, diffDays, evaluateLifeStates, type ISODate, predict, WINDOW_CYCLES } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { phaseOn } from '../../features/guidance/guidance';
import { ovulationUncertain } from '../../features/today/fertileShown';
import { importSanguineData } from '../format/importSanguineData';
import { type SanguineData, validateSanguineData } from '../format/sanguineData';
import type { Clock } from '../ids';
import { migrate } from '../migrate';
import { EventStore } from '../store';
import { openTestDb } from '../testDb';
import { clue } from './clue';

const { OWNER_DATA, OWNER_ZIP_PASSWORD, OWNER_TODAY } = process.env;
let n = 0;
const clock: Clock = { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) };
const BLEED_DAYS_IF_UNLOGGED = 5; // mirrors guidance.ts:58 (private); the last line prints the real phaseOn result, so drift shows
const f = (x: number, d = 1): string => x.toFixed(d);
const localToday = (): ISODate => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` as ISODate; };

function load(path: string): { data: SanguineData; problems: unknown[] } {
  const bytes = new Uint8Array(readFileSync(path));
  if (path.toLowerCase().endsWith('.zip')) return clue.decode({ name: 'zip', bytes }, { password: OWNER_ZIP_PASSWORD });
  return validateSanguineData(JSON.parse(Buffer.from(bytes).toString('utf8')));
}

describe.skipIf(!OWNER_DATA)('owner data probe (local only)', () => {
  it('prints why the phase was general', async () => {
    const today = (OWNER_TODAY ?? localToday()) as ISODate;
    const decoded = load(OWNER_DATA as string);
    const db = openTestDb(); await migrate(db);
    const store = new EventStore(db, clock);
    const imp = await importSanguineData(db, store, decoded.data, { sourceApp: 'probe', today, clock, noteKey: new Uint8Array(32).fill(7) });
    const { history, settings } = await store.engineInputs();
    const records = analyzeCycles(history, settings).map((c) => c.record);
    const p = predict(history, settings, today);
    const gate = evaluateLifeStates(records, settings, today);

    // same conditions, same order, as phaseOn() in features/guidance/guidance.ts with showEstimate: true
    const branch = (): string => {
      if (!p || p.suspended) return 'suspended-or-no-prediction';
      let cycle: (typeof records)[number] | undefined;
      for (const c of records) if (c.start <= today && (!cycle || c.start > cycle.start)) cycle = c;
      if (!cycle || cycle.quality === 'life_state') return 'no-cycle-or-life-state';
      const bleedEnd = !cycle.nextStart && p.currentBleed ? p.currentBleed.point : (cycle.end ?? addDays(cycle.start, BLEED_DAYS_IF_UNLOGGED - 1));
      if (today <= bleedEnd) return 'menstrual';
      if (cycle.nextStart) return cycle.quality !== 'valid' ? 'closed-cycle-not-valid' : (phaseOn({ date: today, today, prediction: p, cycles: records, showEstimate: true })?.phase ?? 'undefined');
      const next = p.nextPeriod;
      if (!next) return 'no-next-period';
      if (today > next.i80.hi) return 'past-next-period-80';
      if (!p.ovulation) return 'no-ovulation';
      if (ovulationUncertain(p)) return 'ovulation-uncertain';
      return phaseOn({ date: today, today, prediction: p, cycles: records, showEstimate: true })?.phase ?? 'undefined';
    };

    const q: Record<string, number> = {};
    for (const r of records) q[r.quality] = (q[r.quality] ?? 0) + 1;
    const lens = records.filter((r) => r.quality === 'valid' && r.nextStart && r.length !== undefined).map((r) => r.length as number);
    const mean = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : Number.NaN;
    const sd = lens.length > 1 ? Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / (lens.length - 1)) : Number.NaN;
    const open = [...records].reverse().find((r) => !r.nextStart);

    console.log(`probe: engine WINDOW_CYCLES=${WINDOW_CYCLES}, ${records.length} cycles`);
    console.log(`probe: cycles by quality ${JSON.stringify(q)}`);
    console.log(lens.length
      ? `probe: valid closed cycle lengths n=${lens.length} mean=${f(mean)} sd=${f(sd)} min=${f(Math.min(...lens))} max=${f(Math.max(...lens))}`
      : 'probe: valid closed cycles: 0');
    console.log(`probe: cycleLength nCyclesUsed=${p.cycleLength.nCyclesUsed} mean=${f(p.cycleLength.mean, 2)} sd=${f(p.cycleLength.sd, 2)}`);
    console.log(p.nextPeriod
      ? `probe: next period 80% half-width=${f(diffDays(p.nextPeriod.i80.hi, p.nextPeriod.i80.lo) / 2)} days, confidence=${p.nextPeriod.confidence}, days from today to i80.hi=${diffDays(p.nextPeriod.i80.hi, today)}`
      : 'probe: next period absent');
    console.log(p.ovulation
      ? `probe: ovulation present sd=${f(p.ovulation.sd, 2)} width80=${diffDays(p.ovulation.i80.hi, p.ovulation.i80.lo)} days, confidence=${p.ovulation.confidence}, basis=${p.ovulation.basis}, uncertain=${ovulationUncertain(p)}`
      : 'probe: ovulation absent');
    console.log(`probe: gate calendarEstimate=${gate.calendarEstimate} bleedingOnly=${gate.bleedingOnly} confidenceCap=${gate.confidenceCap} suspended=${gate.suspended?.reason}`);
    console.log(`probe: life state kinds=${JSON.stringify(settings.lifeStates.map((s) => s.kind))} window=${settings.window}`);
    console.log(`probe: days since open cycle start=${open ? diffDays(today, open.start) : 'no open cycle'}`);
    console.log(`probe: import added=${imp.added} problems=${decoded.problems.length}`);
    console.log(`probe: phaseOn branch=${branch()} actual phase=${phaseOn({ date: today, today, prediction: p, cycles: records, showEstimate: true })?.phase}`);
    expect(records.length).toBeGreaterThan(0);
  });
});
