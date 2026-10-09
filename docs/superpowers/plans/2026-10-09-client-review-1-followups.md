# Client review 1: follow-up fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the four issues the whole-branch review of `2026-10-09-client-review-1.md` graded Minor, plus the Android verification that plan left open. Nothing from that review is deferred (owner's rule, 2026-10-09).

**Architecture:** One engine fix (warm-up counting), two projection fixes (answer linkage and `period.end` expansion), one importer fix (in-file duplicates), one verification task. Each fix is isolated behind the code location named in its task and recorded in the decision it amends.

**Tech Stack:** TypeScript, vitest, better-sqlite3 test DB, Maestro on the Android dev client.

**Spec:** `docs/superpowers/plans/2026-10-09-client-review-1.md` (Feedback, verified; Review Focus) and decisions D-052, D-053, D-056.

## Global Constraints

- Engine stays pure. An engine rule change bumps `ENGINE_VERSION`, regenerates `buildInfo.ts` (`pnpm engine-hash`), and adds rows to `docs/regulatory/engine-changelog.md` and `requirements.md`.
- Event rows are append-only; projections stay pure functions of the log, independent of input order for commuting events.
- The more conservative option wins where a clinical question arises (CLAUDE.md, "Decisions that have no external reviewer").
- Another Claude session may share the checkout: commit only your own paths and hunks, then check `git diff HEAD -- <your files>` is empty.
- Commit messages reference the backlog item id (P3-9, P3-12, P3-13).

## Review Focus

1. Answering the join prompt twice for the same pair of days (first "A new period", later "Same period") must apply the latest answer (Task 2 test "latest answer wins").
2. Clearing the day that triggered a join prompt must remove the answer it wrote on another day (Task 2 test "clearing the asking day retracts its answer").
3. A CSV start/end pair followed by typed bleeding within a week must give one period with no orphan period day (Task 3 test "typed day after an imported end joins").
4. A past pregnancy marked from Insights must keep the warm-up running for three ordinary cycles (Task 1 test "life_state cycle does not count").
5. A file with two rows for one day must import each field once and report the duplicate as a duplicate, not as already imported (Task 4 test).

---

### Task 1: Warm-up and suspension ignore paused cycles (engine, P3-12)

**Problem:** `packages/engine/src/lifestate.ts:46-47` counts every cycle starting on or after `delivered` (and `stopped`), including a `life_state` cycle. `addPastPregnancy` sets `delivered` on the bleed that ended the pregnancy, and that cycle overlaps the pregnancy, so it is `life_state`. That cycle ends the postpartum suspension and counts as a warm-up cycle, so the warm-up ends after two ordinary cycles instead of three. A period that starts on the day hormonal contraception stops has the same effect on the post-contraception warm-up.

**Fix:** A paused cycle is not a period for these rules. In both `postpartum` and `post_contraception`, filter `c.quality !== 'life_state'` before `some(...)` and the `done` count. This is more conservative, because it means a longer warm-up.

**Files:**
- Modify: `packages/engine/src/lifestate.ts:46-53`, `packages/engine/src/params.ts` (`ENGINE_VERSION` 0.1.9 → 0.1.10; check the current value first), `packages/engine/src/buildInfo.ts` (regenerate)
- Test: `packages/engine/src/lifestate.test.ts`
- Docs: `docs/regulatory/engine-changelog.md`, `docs/regulatory/requirements.md` (ER-44 wording), `docs/DECISIONS.md` (append a dated note to D-053)

- [ ] **Step 1: Failing tests** (`lifestate.test.ts`). Use the file's `gate`/`settings` helpers. If `gate` builds cycles from lengths without a quality, build records directly:

```ts
describe('paused cycles are not periods for warm-up (D-053 follow-up)', () => {
  const rec = (start: string, length: number | undefined, quality: CycleRecord['quality'] = 'valid'): CycleRecord =>
    ({ id: start, start, quality, ...(length ? { length, nextStart: addDays(start, length) } : {}) });
  const s = (st: LifeState & { until?: string }): EngineSettings => ({ lifeStates: [st], recencyLambda: 1, window: 12 });
  it('a life_state cycle starting on the delivery day neither ends suspension nor counts toward the three', () => {
    const pp = s({ kind: 'postpartum', delivered: '2026-01-10', breastfeeding: false });
    expect(evaluateLifeStates([rec('2026-01-10', 30, 'life_state')], pp, '2026-02-20').suspended?.reason).toBe('postpartum');
    const after = [rec('2026-01-10', 30, 'life_state'), rec('2026-02-09', 28), rec('2026-03-09', 29), rec('2026-04-07', undefined)];
    expect(evaluateLifeStates(after, pp, '2026-04-20').confidenceCap).toBe('low'); // 2 ordinary closed cycles: still warming up
    const three = [...after.slice(0, 3), rec('2026-04-07', 28), rec('2026-05-05', undefined)];
    expect(evaluateLifeStates(three, pp, '2026-05-10').confidenceCap).toBeUndefined();
  });
  it('the same holds after stopping contraception', () => {
    const pc = s({ kind: 'post_contraception', stopped: '2026-01-10', method: 'combined_pill' });
    const cyc = [rec('2026-01-10', 30, 'life_state'), rec('2026-02-09', 28), rec('2026-03-09', 29), rec('2026-04-07', undefined)];
    expect(evaluateLifeStates(cyc, pc, '2026-04-20').confidenceCap).toBe('low');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run packages/engine/src/lifestate.test.ts`. Expected: both FAIL. Suspension ends early, and the cap is already lifted after two ordinary cycles.
- [ ] **Step 3: Implement.** In `lifestate.ts`, inside `evaluateLifeStates`, add `const periods = cycles.filter((c) => c.quality !== 'life_state');` above the loop. Use `periods` in place of `cycles` in the `postpartum` and `post_contraception` cases only. The breastfeeding biomarker check keeps using `cycles`, because ovulation evidence from any cycle counts.
- [ ] **Step 4: Run** `npx vitest run packages/engine`. Expected: all PASS, and fixtures A–I unchanged.
- [ ] **Step 5: Version and docs.** Bump `ENGINE_VERSION`. Run `pnpm engine-hash`. Add a changelog row: "0.1.10 | 2026-10-09 | Warm-up and postpartum suspension ignore `life_state` cycles | D-053 follow-up, whole-branch review | lifestate.test.ts; fixtures A–I unchanged". Update the ER-44 test column with `lifestate.test.ts (paused cycles)`. Append to D-053: "Follow-up (2026-10-09): a paused cycle neither ends the postpartum suspension nor counts toward the three warm-up cycles (engine 0.1.10)."
- [ ] **Step 6: Commit** with the message `P3-12 engine 0.1.10: warm-up and postpartum suspension ignore paused cycles (D-053)`.

---

### Task 2: Join answers are linked to the day that asked and the latest answer wins (P3-9)

**Problem:**
1. When a day before a period is logged and answered, the answer is written on the period's start day. Clearing the day that asked leaves that answer behind, and it can later apply to different data.
2. The projection checks `splitStarts` before `joinStarts`, so a later "Same period" on a day that already holds a "A new period" answer is ignored.

**Fix:**
- `period.start { merge }` gains an optional `asked_on: ISODate`, the day whose logging produced the question. `validateEvent` requires `asked_on` to be a day when present, and only alongside a boolean `merge`.
- The projection applies merge answers in log order. A later answer for a day replaces the earlier one: `merge: false` adds to `splitStarts` and deletes from `joinStarts`, and `merge: true` does the reverse.
- `setFlow(..., 'none')` retracts period.start answers whose day is the cleared day, or whose `asked_on` is the cleared day.
- The sheet passes `asked_on: day` with `splitAt`/`mergeAt`.

**Files:**
- Modify: `apps/mobile/src/data/events.ts` (`period.start` validation), `apps/mobile/src/data/project.ts` (merge-flag loop), `apps/mobile/src/features/logging/actions.ts` (`setFlow` writes `asked_on`; clear retracts by day or `asked_on`)
- Test: `apps/mobile/src/data/store.test.ts`, `apps/mobile/src/features/logging/actions.test.ts`, `apps/mobile/src/data/events.test.ts`
- Docs: D-052 (append a dated follow-up sentence), PLAN §5.4 bullet 2 ("the answer carries the asking day; clearing that day retracts it; the latest answer for a day wins")

- [ ] **Step 1: Failing tests.**

```ts
// store.test.ts, in 'cycles from flow (§5.4)'
it('the latest answer for a day wins', async () => {
  await periodsOf(['2026-09-03', '2026-09-10']);
  await store.append({ kind: 'period.start', payload: { day: '2026-09-10', merge: false } });
  await store.append({ kind: 'period.start', payload: { day: '2026-09-10', merge: true } });
  expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-03']);
  await store.append({ kind: 'period.start', payload: { day: '2026-09-10', merge: false } });
  expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-03', '2026-09-10']);
});
// actions.test.ts
it('clearing the asking day retracts the answer it wrote on the later period', async () => {
  await setFlow(store, '2026-10-10', 'medium');
  await setFlow(store, '2026-10-05', 'medium', { splitAt: '2026-10-10', askedOn: '2026-10-05' });
  expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-10-05', '2026-10-10']);
  await setFlow(store, '2026-10-05', 'none');
  await setFlow(store, '2026-10-07', 'light'); // imported-style write, no prompt: must join, the old split is gone
  expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-10-07']);
});
// events.test.ts
it('period.start asked_on must be a day and needs a merge answer', () => {
  expect(() => validateEvent({ kind: 'period.start', payload: { day: '2026-10-10', merge: false, asked_on: '2026-10-05' } })).not.toThrow();
  expect(() => validateEvent({ kind: 'period.start', payload: { day: '2026-10-10', merge: false, asked_on: 'x' } })).toThrow(/asked_on/);
  expect(() => validateEvent({ kind: 'period.start', payload: { day: '2026-10-10', asked_on: '2026-10-05' } })).toThrow(/asked_on/);
});
```

- [ ] **Step 2: Run** `npx vitest run apps/mobile/src/data/store.test.ts apps/mobile/src/features/logging/actions.test.ts apps/mobile/src/data/events.test.ts`. Expected: the three new tests FAIL.
- [ ] **Step 3: Implement.**
  - `events.ts`, `period.start` case: `if (p.asked_on !== undefined && (!isDay(p.asked_on) || typeof p.merge !== 'boolean')) fail(e.kind, 'asked_on');`.
  - `project.ts`, `period.start` case: `if (p.merge === false) { splitStarts.add(d); joinStarts.delete(d); } else if (p.merge === true) { joinStarts.add(d); splitStarts.delete(d); }`. The loop already runs in log order (`activeEvents` sorts by lamport).
  - `actions.ts`: the `setFlow` options gain `askedOn?: ISODate`, added to the payload as `asked_on`. On clear, retract each active `period.start` with a boolean `merge` whose `effective_day === day` or whose `asked_on === day`. Find these with `activeEvents(await store.events())`, because `dayEvents` only covers one day.
  - `LogSheet.tsx`: pass `askedOn: day` in both answers.
- [ ] **Step 4: Run** the same tests, then `npx vitest run apps/mobile/src`. Expected: PASS.
- [ ] **Step 5: Docs, typecheck and lint, then commit** with the message `P3-9 join answers carry the asking day and the latest answer wins (D-052)`.

---

### Task 3: An imported `period.end` fills its period instead of cutting joined days (P3-9, P3-13)

**Problem:** `project.ts` treats `period.end` as an override applied after the runs are built. That causes two bugs:
1. A typed period day joined after an imported end gets cut off and belongs to no cycle.
2. For a start/end pair, the join gap is measured from the start, because the days in between are not period days. The same bleeding therefore joins when typed but not when imported.

`period.end` is written only by the CSV importer, and later by Health sync.

**Fix:** Expand each `period.end` into period days before the runs are built. For each end `e`, take the latest period day `p ≤ e`. If `diffDays(e, p) < MIN_VALID_LENGTH`, add every day from `p` to `e` to `periodDays`. Then delete the override step. With this rule an end can extend a period but never shorten one. The old shortening case never existed, because the importer rejects an end before its start. A user who wants a shorter period clears the flow days.

**Files:**
- Modify: `apps/mobile/src/data/project.ts` (period days and override block)
- Test: `apps/mobile/src/data/store.test.ts`, `apps/mobile/src/data/exportImport.test.ts` (CSV start/end path)
- Docs: D-052 (append), PLAN §5.4 bullet 1 ("a `period.end` marks every day from the period's last day to it as a period day")

- [ ] **Step 1: Failing tests.**

```ts
// store.test.ts
it('typed day after an imported end joins and is not orphaned', async () => {
  await store.append({ kind: 'period.start', payload: { day: '2026-10-01' } });
  await store.append({ kind: 'period.end', payload: { day: '2026-10-05' } });
  await store.append(flow('2026-10-08'));
  expect(await cycles()).toMatchObject([{ start_day: '2026-10-01', end_day: '2026-10-08', bleed_days: 8 }]);
});
it('an imported start/end pair measures the join gap from its end, like typed days', async () => {
  await store.append({ kind: 'period.start', payload: { day: '2026-10-01' } });
  await store.append({ kind: 'period.end', payload: { day: '2026-10-05' } });
  await store.append(flow('2026-10-10')); // 5 days after the end, 9 after the start
  expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-10-01']);
});
it('an end 15 or more days after the last period day is ignored, not stretched', async () => {
  await store.append({ kind: 'period.start', payload: { day: '2026-10-01' } });
  await store.append({ kind: 'period.end', payload: { day: '2026-10-20' } });
  expect(await cycles()).toMatchObject([{ start_day: '2026-10-01', end_day: '2026-10-01' }]);
});
```

Keep the existing test "period.start alone creates a cycle; period.end overrides the last day" (start 1, flow 2, end 6 gives end 6 and 6 bleed days); it must still pass.

- [ ] **Step 2: Run** `npx vitest run apps/mobile/src/data/store.test.ts`. Expected: the first two FAIL. The third may already pass, because the current override sets end 20; if so, it fails on `end_day`.
- [ ] **Step 3: Implement** in `project.ts`, after `periodDays` is built and before sorting:

```ts
// D-052 follow-up: an end marks the days up to it as bleeding, so joins measure from the real last day and nothing is cut afterwards
for (const e of periodEnds) {
  const p = [...periodDays].filter((d) => d <= e).sort().at(-1);
  if (p && diffDays(e, p) < MIN_VALID_LENGTH) for (let d = addDays(p, 1); d <= e; d = addDays(d, 1)) periodDays.add(d);
}
```

Then delete the `runs.forEach(... override ...)` block.
- [ ] **Step 4: Run** `npx vitest run apps/mobile/src/data`. Expected: PASS, including the CSV import tests.
- [ ] **Step 5: Docs, then commit** with the message `P3-9 an imported period end fills its period instead of cutting joined days (D-052)`.

---

### Task 4: In-file duplicates are reported as duplicates (P3-13)

**Problem:** `importDaily.ts` counts a second row for the same day and field in one file as `skipped`, which means "already imported". The import result then misreports the file.

**Fix:** `DailyImportResult` gains `duplicates: number`, counting the same day and field repeated inside this file. The first occurrence is kept, which is deterministic and matches the file's order. `skipped` counts only fields that an earlier import already wrote.

**Files:**
- Modify: `apps/mobile/src/data/importDaily.ts`
- Test: `apps/mobile/src/data/importDaily.test.ts` (update the existing `toEqual` results to include `duplicates: 0`)
- Docs: D-056 (append the duplicate rule, and that a retracted imported entry does not return on re-import because its `external_id` stays in the log)

- [ ] **Step 1: Failing test.**

```ts
it('two rows for one day import each field once and report the repeat as a duplicate', async () => {
  const r = await importDailyRows(db, store, [{ day: '2026-09-01', flow: 'medium' }, { day: '2026-09-01', flow: 'heavy', tempC: 36.4 }], opts());
  expect(r).toEqual({ added: 2, skipped: 0, duplicates: 1, notesDropped: 0 });
  expect(await db.all('SELECT flow FROM daily_log')).toEqual([{ flow: 'medium' }]);
});
it('a retracted imported entry does not come back on re-import', async () => {
  const rows = [{ day: '2026-09-01', flow: 'medium' as const }];
  await importDailyRows(db, store, rows, opts());
  const e = (await store.events()).find((x) => x.kind === 'flow');
  await store.retract(e?.id as string);
  expect((await importDailyRows(db, store, rows, opts())).added).toBe(0);
});
```

- [ ] **Step 2: Run.** Expected: the first FAILS (no `duplicates` field). The second passes already; it pins the documented behaviour.
- [ ] **Step 3: Implement.** Track `seenInFile = new Set<string>()` next to `known`. In `add`, if `seenInFile.has(id)`, do `duplicates++` and return. If `known.has(id)`, do `skipped++` and return. Otherwise add `id` to both sets. Rows are already sorted by day with a stable sort, so file order is kept within a day.
- [ ] **Step 4: Run** `npx vitest run apps/mobile/src/data/importDaily.test.ts`. Expected: PASS.
- [ ] **Step 5: Docs, then commit** with the message `P3-13 importer reports in-file duplicates separately from earlier imports (D-056)`.

---

### Task 5: Android verification of the P3-9 and P3-12 flows

The first plan verified iOS only, because the Android emulator was busy.

- [ ] **Step 1:** Ask the peer session (SendMessage) for the Android emulator. Do not boot a second emulator; swap is nearly full.
- [ ] **Step 2:** `cd apps/mobile && ITEM=P3-9 CLIENT=dev METRO_PORT=8090 .maestro/run.sh android logging.yaml`, then `ITEM=P3-12 ... android insights.yaml settings.yaml`. Expected: all pass. On Android, `_close-sheet.yaml` uses the back key, so check the join-answer steps, which no longer close the sheet. Screenshots go to `docs/screenshots/P3-9-devclient/` and `P3-12-devclient/`.
- [ ] **Step 3:** Rerun `ios logging.yaml insights.yaml settings.yaml` on the iOS dev client to cover Tasks 2–3. Fix any failure at its cause, then commit the flows and screenshots.

## Order

Tasks 1–4 are independent. Run them in order 1, 2, 3, 4, then Task 5 once a device is free. Run the full suite (`npx vitest run`), typecheck (`pnpm -r --if-present typecheck`) and lint (`npx biome check apps/mobile/src packages`) after each task.
