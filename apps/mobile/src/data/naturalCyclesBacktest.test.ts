// P8-12 (D-091): backtest on a real Natural Cycles export. The file is personal health data and stays out of the
// repository (.gitignore), so this suite runs only where it exists: NC_XLSX=<path>, or NaturalCycles-daily-entries.xlsx at the
// repository root. It asserts aggregates only and prints no dates. BACKTEST_REPORT=1 prints the tables.
//
// Protocol: import the whole export through the real pipeline, then cut the history off at each cycle (on the day of the
// last logged period, and 7, 14 and 21 days into the cycle) and forecast the next period from what was known then.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { addDays, analyzeCycles, diffDays, predict, type EngineSettings, type History, type ISODate } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { CHALLENGERS, type DateForecast, type DateModel, tally, type Tally } from '../../../../tools/backtest/src/challengers';
import type { Clock } from './ids';
import { importDailyRows } from './importDaily';
import { readNaturalCycles } from './importNaturalCycles';
import { migrate } from './migrate';
import { EventStore } from './store';
import { openTestDb } from './testDb';

const FILE = process.env.NC_XLSX ?? fileURLToPath(new URL('../../../../NaturalCycles-daily-entries.xlsx', import.meta.url));
const OFFSETS = [0, 7, 14, 21];
const MIN_HISTORY = 3;

let n = 0;
const clock: Clock = { nowMs: () => 1_700_000_000_000 + n++, iso: () => '2026-10-10T08:00:00+10:00', tz: () => 'Australia/Sydney', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) };

/** What was known on `today`: entries up to it, life states that had started (an end after today is not known yet). */
function asOf(h: History, s: EngineSettings, today: ISODate): [History, EngineSettings] {
  const upTo = <T extends { date: ISODate }>(xs: T[]) => xs.filter((x) => x.date <= today);
  const cycles = h.cycles.filter((c) => c.start <= today).map((c) => (c.end && c.end > today ? { ...c, end: today } : c));
  const lifeStates = s.lifeStates.filter((l) => (l.kind === 'postpartum' ? l.delivered : 'since' in l ? l.since : '9999') <= today)
    .map((l) => (l.until && l.until > today ? (({ until: _u, ...rest }) => rest)(l) : l)) as EngineSettings['lifeStates'];
  const known = (xs?: ISODate[]) => xs?.filter((d) => d <= today);
  return [{
    ...h, cycles, temperatures: upTo(h.temperatures), lh: upTo(h.lh), mucus: upTo(h.mucus), cervix: upTo(h.cervix), logs: upTo(h.logs),
    excluded: known(h.excluded), confirmedLong: known(h.confirmedLong),
  }, { ...s, lifeStates }];
}

/** Losses as the user would have marked them by `today`: pregnant from the start of the cycle with a positive test once that
 *  test was taken, and the loss (postpartum, D-053) from the first bleed after it once that bleed happened. */
function markLosses(h: History, s: EngineSettings, positives: ISODate[], lossBleeds: ISODate[], today: ISODate): EngineSettings {
  const states: EngineSettings['lifeStates'] = [];
  const seen = new Set<ISODate>();
  for (const p of positives.filter((d) => d <= today)) {
    const since = h.cycles.map((c) => c.start).filter((d) => d <= p).at(-1);
    const loss = lossBleeds.find((d) => d >= p && d <= today);
    if (!since || (loss && seen.has(loss)) || states.some((x) => x.kind === 'pregnant' && x.since === since)) continue;
    if (!loss) { states.push({ kind: 'pregnant', since }); continue; }
    seen.add(loss);
    states.push({ kind: 'pregnant', since, until: loss }, { kind: 'postpartum', delivered: loss, breastfeeding: false });
  }
  return { ...s, lifeStates: states };
}

const lastLength: DateModel = (h, _s, today) => {
  const st = h.cycles.map((c) => c.start).filter((d) => d <= today).sort();
  const last = diffDays(st.at(-1) as string, st.at(-2) as string);
  const at = (d: number) => addDays(st.at(-1) as string, d);
  return { point: at(last), i80: { lo: at(last - 2), hi: at(last + 2) }, i95: { lo: at(last - 4), hi: at(last + 4) } };
};
const mean3: DateModel = (h, _s, today) => {
  const st = h.cycles.map((c) => c.start).filter((d) => d <= today).sort();
  const lens = st.slice(-4).slice(1).map((d, i) => diffDays(d, st.slice(-4)[i] as string));
  const m = Math.round(lens.reduce((a, b) => a + b, 0) / lens.length);
  const at = (d: number) => addDays(st.at(-1) as string, d);
  return { point: at(m), i80: { lo: at(m - 2), hi: at(m + 2) }, i95: { lo: at(m - 4), hi: at(m + 4) } };
};
const MODELS: Record<string, DateModel> = { ...CHALLENGERS, lastLength, mean3 };

interface Arm { byOffset: Record<number, Record<string, { all: Tally; regular: Tally }>>; suspended: number; ovulationMae: number; ovulationN: number }

function backtest(h: History, settingsOn: (today: ISODate) => EngineSettings, end: ISODate): Arm {
  const full = analyzeCycles(h, settingsOn(end)).map((c) => c.record);
  const starts = full.map((c) => c.start);
  const byOffset: Arm['byOffset'] = {};
  let suspended = 0;
  let ovErr = 0, ovN = 0;
  for (const off of OFFSETS) {
    const rows: Record<string, { all: Array<{ f: DateForecast; actual: ISODate }>; regular: Array<{ f: DateForecast; actual: ISODate }> }> =
      Object.fromEntries(Object.keys(MODELS).map((m) => [m, { all: [], regular: [] }]));
    for (let k = MIN_HISTORY + 1; k < starts.length; k++) {
      const today = addDays(starts[k - 1] as ISODate, off);
      const actual = starts[k] as ISODate;
      if (today >= actual) continue;
      const [hh, ss] = asOf(h, settingsOn(today), today);
      const p = predict(hh, ss, today);
      if (p.suspended) { suspended++; continue; }
      const regular = full[k - 1]?.quality === 'valid';
      for (const [name, m] of Object.entries(MODELS)) {
        const f = m(hh, ss, today);
        if (!f) continue;
        rows[name]?.all.push({ f, actual });
        if (regular) rows[name]?.regular.push({ f, actual });
      }
      // the calendar ovulation forecast against the ovulation the whole cycle's tests and temperatures show afterwards
      const retro = full[k - 1]?.ovulation;
      if (off === 0 && p.ovulation && retro && retro.basis !== 'calendar') { ovErr += Math.abs(diffDays(p.ovulation.point, retro.point)); ovN++; }
    }
    byOffset[off] = Object.fromEntries(Object.entries(rows).map(([m, r]) => [m, { all: tally(r.all), regular: tally(r.regular) }]));
  }
  return { byOffset, suspended, ovulationMae: ovN ? ovErr / ovN : 0, ovulationN: ovN };
}

const table = (a: Arm) => Object.entries(a.byOffset).flatMap(([off, ms]) => Object.entries(ms).map(([m, t]) => ({
  day: Number(off), model: m, n: t.regular.n, mae: +t.regular.mae.toFixed(2), medAe: t.regular.medianAe, cov80: +t.regular.cov80.toFixed(2),
  cov95: +t.regular.cov95.toFixed(2), w80: +t.regular.width80.toFixed(1), allN: t.all.n, allMae: +t.all.mae.toFixed(2),
})));

/** An export through the real pipeline, with what the backtest needs from it. */
async function load(bytes: Uint8Array) {
  const parsed = readNaturalCycles(bytes);
  if (!parsed) throw new Error('not a Natural Cycles export');
  const db = openTestDb();
  await migrate(db);
  const store = new EventStore(db, clock);
  const opts = { sourceApp: 'natural_cycles', today: '2026-10-10', clock };
  const first = await importDailyRows(db, store, parsed.rows, opts);
  const again = await importDailyRows(db, store, parsed.rows, opts);
  const { history, settings } = await store.engineInputs();
  const positives = parsed.rows.filter((r) => r.pregTest === 'positive').map((r) => r.day).sort();
  const lossBleeds = parsed.rows.filter((r) => r.flowKind === 'post_pregnancy').map((r) => r.day).sort();
  const end = parsed.rows.map((r) => r.day).sort().at(-1) as ISODate;
  const marked = markLosses(history, settings, positives, lossBleeds, end);
  const raw = backtest(history, () => settings, end);
  const withLoss = backtest(history, (today) => markLosses(history, settings, positives, lossBleeds, today), end);
  return { parsed, first, again, history, settings, positives, lossBleeds, marked, raw, withLoss };
}
const at = (a: Arm, off: number, m: string) => a.byOffset[off]?.[m] as { all: Tally; regular: Tally };

describe('real Natural Cycles export backtest (local only)', async () => {
  // describe.skipIf still runs this body, so the missing file is handled here
  if (!existsSync(FILE)) { it.skip('needs the export (NC_XLSX or NaturalCycles-daily-entries.xlsx at the repository root)', () => {}); return; }
  const { history, settings, positives, lossBleeds, marked, raw, withLoss } = await load(new Uint8Array(readFileSync(FILE)));

  if (process.env.BACKTEST_REPORT) {
    console.log(`\ncycles ${history.cycles.length}, losses marked ${marked.lifeStates.length / 2}; regular targets only (allN/allMae: every target)`);
    console.log('\n=== as imported ==='); console.table(table(raw));
    console.log(`ovulation forecast vs retrospective: MAE ${raw.ovulationMae.toFixed(2)} d over ${raw.ovulationN} cycles`);
    console.log(`\n=== losses marked (suspended forecasts: ${withLoss.suspended}) ===`); console.table(table(withLoss));
  }
  it('has enough history to mean something', () => expect(at(raw, 0, 'engine').regular.n).toBeGreaterThanOrEqual(30));
  it('on regular cycles the engine is at least as accurate as "same as last time" and "mean of the last 3"', () => {
    expect(at(raw, 0, 'engine').regular.mae).toBeLessThanOrEqual(at(raw, 0, 'lastLength').regular.mae);
    expect(at(raw, 0, 'engine').regular.mae).toBeLessThanOrEqual(at(raw, 0, 'mean3').regular.mae + 0.1);
  });
  it('the 80% range holds the real next period at least 75% of the time on regular cycles', () =>
    expect(at(raw, 0, 'engine').regular.cov80).toBeGreaterThanOrEqual(0.75));
  it('forecasts made mid-cycle agree with the one made on the period day (no biomarker moves the period forecast)', () => {
    for (const off of [7, 14, 21]) expect(at(raw, off, 'engine').regular).toEqual(at(raw, 0, 'engine').regular);
  });
  it('losses marked as the user would (from the positive test and the bleed) pause some forecasts and cost little elsewhere', () => {
    if (marked.lifeStates.length === 0) return;
    // cut-offs at days 0-21 come before the tests, so check the day of each positive test directly
    for (const p of positives) {
      const [hh, ss] = asOf(history, markLosses(history, settings, positives, lossBleeds, p), p);
      expect(['pregnant', 'postpartum']).toContain(predict(hh, ss, p).suspended?.reason); // a test before the first period after a loss is still in the postpartum pause
    }
    expect(at(withLoss, 0, 'engine').regular.cov80).toBeGreaterThanOrEqual(0.75);
    // the forecast on the period day cannot know a pregnancy not yet tested for, so marking barely moves the overall error;
    // what it costs on regular cycles is the post-loss warm-up (D-091 finding c)
    expect(Math.abs(at(withLoss, 0, 'engine').all.mae - at(raw, 0, 'engine').all.mae)).toBeLessThan(0.5);
    expect(at(withLoss, 0, 'engine').regular.mae).toBeGreaterThanOrEqual(at(withLoss, 0, 'lossKeep').regular.mae);
  });
  it('the calendar ovulation forecast lands within 3 days of the ovulation the cycle\'s tests and temperatures showed', () => {
    if (raw.ovulationN === 0) return;
    expect(raw.ovulationMae).toBeLessThanOrEqual(3);
  });
});

// Exports generated with an LLM (tools/sample/generate_logs.py) in the Natural Cycles layout, committed: no ground truth beyond
// the file itself, so they check the import and the engine against messy, model-written data rather than a known answer.
const SAMPLES = fileURLToPath(new URL('../../../../tools/sample/', import.meta.url));
const sampleFiles = readdirSync(SAMPLES).filter((f) => f.endsWith('.xlsx')).sort();
// what the importer is expected to report in them: "Had sex" as 1 (protection not stated, D-056) and flags it does not know
const EXPECTED_PROBLEM = /^line \d+: sex "1" not recognised$|^not imported: /;

describe('generated sample exports (tools/sample)', async () => {
  const runs = await Promise.all(sampleFiles.map(async (f) => ({ f, ...(await load(new Uint8Array(readFileSync(SAMPLES + f)))) })));
  if (process.env.BACKTEST_REPORT) for (const r of runs) { console.log(`\n=== ${r.f}: ${r.history.cycles.length} cycles ===`); console.table(table(r.raw).filter((x) => x.day === 0)); }

  it('there are samples, including a pregnancy loss and missed periods', () => {
    expect(sampleFiles.length).toBeGreaterThanOrEqual(3);
    expect(runs.some((r) => r.lossBleeds.length > 0)).toBe(true);
  });
  it.each(sampleFiles)('%s imports with only the expected reports, and a second import adds nothing', (f) => {
    const r = runs.find((x) => x.f === f);
    expect(r?.parsed.problems.filter((p) => !EXPECTED_PROBLEM.test(p))).toEqual([]);
    expect(r?.first.added).toBeGreaterThan(0);
    expect(r?.again.added).toBe(0);
  });
  it.each(sampleFiles)('%s: bleeding after a loss starts no cycle; every forecast is a well-ordered range', (f) => {
    const r = runs.find((x) => x.f === f);
    const starts = new Set(r?.history.cycles.map((c) => c.start));
    for (const d of r?.lossBleeds ?? []) expect(starts.has(d)).toBe(false);
    const p = predict(r?.history as History, r?.settings as EngineSettings, r?.history.cycles.at(-1)?.start as ISODate).nextPeriod;
    expect(p && p.i95.lo <= p.i80.lo && p.i80.lo <= p.point && p.point <= p.i80.hi && p.i80.hi <= p.i95.hi).toBe(true);
  });
  it('a marked loss in a sample pauses the forecast from the positive test', () => {
    for (const r of runs.filter((x) => x.marked.lifeStates.length > 0)) {
      for (const p of r.positives) {
        const [hh, ss] = asOf(r.history, markLosses(r.history, r.settings, r.positives, r.lossBleeds, p), p);
        expect(['pregnant', 'postpartum']).toContain(predict(hh, ss, p).suspended?.reason);
      }
    }
  });
  it('a long gap in a missed-periods sample is set aside, not averaged in', () => {
    for (const r of runs.filter((x) => x.f.includes('missed'))) {
      const q = analyzeCycles(r.history, r.settings).map((c) => c.record);
      expect(q.some((c) => c.quality === 'suspect_skip')).toBe(true);
    }
  });
  // samples from the planned generator carry their true timeline in <name>.truth.json
  const truthOf = (f: string) => {
    const t = SAMPLES + f.replace(/\.xlsx$/, '.truth.json');
    return existsSync(t) ? (JSON.parse(readFileSync(t, 'utf8')) as { periodStarts: ISODate[]; ovulations: Record<ISODate, ISODate>; losses: Array<{ positiveTest: ISODate; bleed: ISODate }>; lengths: number[] }) : undefined;
  };
  const planned = sampleFiles.filter((f) => truthOf(f));
  it('there are planned samples with a true timeline', () => expect(planned.length).toBeGreaterThanOrEqual(4));
  it.each(planned)('%s: imported cycle starts are exactly the planned period starts', (f) => {
    const r = runs.find((x) => x.f === f);
    expect(r?.history.cycles.map((c) => c.start)).toEqual(truthOf(f)?.periodStarts);
  });
  it.each(planned)('%s: ovulation is found in most cycles, and wherever found it is within 2 days of the plan', (f) => {
    const r = runs.find((x) => x.f === f);
    const truth = truthOf(f)?.ovulations ?? {};
    const closed = analyzeCycles(r?.history as History, r?.settings as EngineSettings).map((c) => c.record).filter((c) => c.nextStart && truth[c.start]);
    const found = closed.filter((c) => c.ovulation);
    expect(closed.length).toBeGreaterThan(0);
    // a cycle without LH tests whose temperatures do not pass the three-over-six rule is left undated, never guessed
    expect(found.length / closed.length).toBeGreaterThanOrEqual(0.7);
    for (const c of found) expect(Math.abs(diffDays(c.ovulation?.point as ISODate, truth[c.start] as ISODate)), c.start).toBeLessThanOrEqual(2);
  });
  it.each(planned)('%s: a planned missed period or pregnancy is set aside or paused, never averaged in', (f) => {
    const r = runs.find((x) => x.f === f);
    const t = truthOf(f);
    const q = analyzeCycles(r?.history as History, r?.marked as EngineSettings).map((c) => c.record);
    q.forEach((c, i) => { if ((t?.lengths[i] ?? 0) >= 55) expect(['suspect_skip', 'life_state']).toContain(c.quality); });
  });
  it('pooled over the samples, the engine beats "same as last time" on regular cycles', () => {
    const pool = (m: string) => runs.flatMap((r) => { const t = at(r.raw, 0, m).regular; return t.n ? [{ n: t.n, sum: t.mae * t.n }] : []; });
    const mae = (m: string) => { const p = pool(m); return p.reduce((a, x) => a + x.sum, 0) / p.reduce((a, x) => a + x.n, 0); };
    expect(pool('engine').reduce((a, x) => a + x.n, 0)).toBeGreaterThanOrEqual(10);
    expect(mae('engine')).toBeLessThanOrEqual(mae('lastLength'));
  });
});
