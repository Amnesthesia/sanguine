# Client review 1: supplementary plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Action the client's five review points so her own Natural Cycles history imports in full, pregnancies and pregnancy losses are handled with the right rules and wording, bleeding is joined into periods correctly, and the plan text matches the shipped engine.

**Architecture:** Projection and engine changes stay behind one constant each (PLAN.md §11.1 style) and are recorded in DECISIONS.md. Importers share one `DailyRow` intermediate so the Natural Cycles parser, the existing CSV parser and the deferred Flo/Clue parsers all feed one writer. Pregnancy loss reuses the existing `postpartum` engine rule (suspended until the first logged period, then a 3-cycle warm-up) and adds only an outcome, copy and a bleeding-kind default; the engine itself does not change.

**Tech Stack:** TypeScript, vitest, better-sqlite3 test DB (`apps/mobile/src/data/testDb.ts`), fflate, expo-document-picker, Maestro.

**Spec:** this file, section "Feedback, verified", plus PLAN.md §4.9, §4.12, §5.4, §8.10, §11.1.

## Global Constraints

- Engine (`packages/engine`) stays pure: no I/O, no `Date.now()`, no randomness. `predict` deterministic.
- Event rows are append-only: never UPDATE or DELETE an `event`; retract instead. Projections are pure functions of the log (D-024).
- No flag names a condition. No contraception feature, no conception mode, no per-day chance figure.
- Forbidden words (copy/copy.test.ts): safe, unsafe, protected, contraception (outside life-state options), birth control, conceive, fertile today, chance of pregnancy, risk, diagnosis, PCOS, endometriosis, perimenopause, abnormal, ladies, girls, feminine, womanhood, should, normal.
- Clinical defaults without review: pick the more conservative option, isolate behind one constant, record in DECISIONS.md with the rejected alternative; update `docs/regulatory/engine-changelog.md`, `requirements.md`, `risk-register.md` when a rule or parameter changes.
- Commit messages reference the backlog item id (new ids below: P3-9 … P3-13).
- Teen mode hides fertility language by default; pregnancy life-state copy must stay out of teen mode as it is today.

## Feedback, verified

| # | Client claim | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Importer reads only period start dates; flow and notes lost; no Natural Cycles importer | **Correct** | `apps/mobile/src/data/exportImport.ts: importPeriodCsv` writes only `period.start`/`period.end`. PLAN.md §8.10 names Flo and Clue (deferred to Phase 5, V-11) and never Natural Cycles. |
| 2 | Pregnancy loss not handled; loss bleeds count as periods; two long pregnancy cycles trigger a "missed log" prompt | **Correct** | `LifeState` has `pregnant` (suspends) and `postpartum` (delivered) but no loss outcome. `project.ts` counts any `period`-kind flow day as a period day regardless of life state. Imported history carries no life states, so a 250-day cycle is `suspect_skip` (`classify.ts:75`, > 90 d) and Insights shows chip "possibly a missed log" plus "Was there a period in between?" (`insightsModel.ts:27`, `copy/en-AU.json:319,324`). The 90-day *health flag* `missed` fires only on the open cycle, so it is not the prompt she means. |
| 3 | Bleeding merged across only a 1-day gap; a 12-day period with missing days splits into short cycles | **Correct** | `project.ts: PERIOD_GAP_DAYS = 2` (one missing day). Two unlogged days inside a bleed start a second run, a second `cycle` row and a `suspect_short` cycle; bleed_days, history rows and the ledger are all wrong. The 7-day merge exists only as a user-confirmed `period.start { merge: true }` for back-filling an earlier day (`actions.ts:42`), never for imported flow days. |
| 4 | Test numbers only hold with λ = 1 but the engine defaults to 0.92 | **Half right: docs wrong, code right** | Shipped default is `RECENCY_LAMBDA = 1` (`params.ts:20`, D-021, V-05: the 0.92 acceptance test failed). Fixtures use λ = 1 (`fixtures.ts:9`) and pass. PLAN.md §4.3 table ("0.92 per cycle"), `types.ts:55` ("default 0.92") and §4.12 (silent on λ) still say or imply 0.92. Fix the documents; add a test that pins fixtures to the shipped default so they cannot drift apart again. |
| 5 | 10 Oct 2026 is a Saturday, mockups say Friday | **Correct** | `date -j -f %Y-%m-%d 2026-10-10 +%A` → Saturday. "Friday 10 October" at `docs/mockups.html:238,259,298` and PLAN.md §9.8 line 910. The calendar grid in the mockup (Monday-first, 10 in column 6) is already right; only the labels are wrong. The app formats weekdays with `Intl`, so no app code is affected. |

Not actioned, with reason: the client's reference to a "2 to 54 days average" bug is not in this repository (no match in docs or code); the splitting rule in #3 is the same class and its fix covers it. A 12-day bleed will still raise the FIGO "prolonged" flag if two consecutive periods exceed 8 days (`flags.ts: PROLONGED_DAYS`); that is the plan's intended behaviour, not a bug.

## Review Focus

1. A Natural Cycles export with a temperature marked excluded/deviating must import as `disturbed`, never as a clean reading (Task 3 test "excluded temperature is disturbed").
2. Importing the same Natural Cycles file twice must add nothing (Task 3 test "second import adds nothing").
3. Bleeding logged inside the post-pregnancy window must not start a cycle, and a `period` logged by explicit choice in that window must (Task 5 tests).
4. Two runs 8 days apart (end to start) must stay two periods; 7 days apart must join (Task 2 tests at the boundary).
5. A user who splits a joined run with "Start a new period instead" and then retracts that choice must get the joined run back (Task 2 test "retracting the split restores the join").

## Backlog entries (add first, Task 0)

```
- [ ] P3-9 Period runs join across gaps up to 7 days unless the user splits them; `period.start { merge: false }` splits. (§5.4, client review 1 #3)
- [ ] P3-10 λ documentation fix: PLAN §4.3/§4.12/§11.1 and types.ts say the shipped default (λ = 1, D-021); fixtures pinned to RECENCY_LAMBDA. (client review 1 #4)
- [ ] P3-11 Mockup weekday labels corrected (10 Oct 2026 is a Saturday). (client review 1 #5)
- [ ] P3-12 Pregnancy outcome (birth / loss) on ending the pregnant state; post-pregnancy bleeding kind; "I was pregnant" action on long cycles; neutral long-cycle wording. (§4.9, client review 1 #2)
- [ ] P3-13 Natural Cycles import ("Daily Entries.csv" inside the export zip): flow, temperature, LH, notes, sex, via a shared DailyRow writer. Blocked on a sample export from the client. (§8.10, client review 1 #1)
```

---

### Task 0: Backlog, decisions scaffold, mockup dates (P3-11)

**Files:**
- Modify: `docs/BACKLOG.md` (Phase 3 list, after P3-8)
- Modify: `docs/mockups.html:238,259,298`
- Modify: `docs/PLAN.md:910`

- [ ] **Step 1: Add the five backlog rows above after the P3-8 line.**

- [ ] **Step 2: Fix the weekday labels.**

```bash
cd /Users/amnesthesia/Work/sanguine
sed -i '' 's/Friday 10 October/Saturday 10 October/g' docs/mockups.html docs/PLAN.md
grep -rn "Friday 10 October" docs/ && echo STILL-WRONG || echo ok
```

- [ ] **Step 3: Check the mockup grid in a browser** (`open docs/mockups.html`): October 2026 row 1 reads 28 29 30 1 2 3 4 (Monday-first), today is 10 in column 6. No change needed; screenshot to `docs/screenshots/P3-11/`.

- [ ] **Step 4: Commit**

```bash
git add docs/BACKLOG.md docs/mockups.html docs/PLAN.md docs/screenshots/P3-11
git commit -m "P3-11 mockup weekday labels: 10 Oct 2026 is a Saturday; backlog rows P3-9..P3-13 from client review 1"
```

---

### Task 1: λ documentation and fixture pin (P3-10)

**Files:**
- Modify: `docs/PLAN.md:252` (§4.3 table row "λ (recency)"), `docs/PLAN.md:203`, §4.12 header (line 374), §11.1 table (after line 984)
- Modify: `packages/engine/src/types.ts:55`
- Test: `packages/engine/src/fixtures.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/engine/src/fixtures.test.ts — add inside the top-level describe
import { RECENCY_LAMBDA } from './params';
it('fixtures are computed with the shipped recency default (D-021)', () => {
  expect(FIXTURE_SETTINGS.recencyLambda).toBe(RECENCY_LAMBDA);
});
```

- [ ] **Step 2: Run it** — `pnpm --filter @sanguine/engine vitest run fixtures` — Expected: PASS already (both are 1). Keep the test: it fails the day someone changes one without the other. Then temporarily set `recencyLambda: 0.92` in `fixtures.ts` and confirm the golden tests and this test FAIL, revert.

- [ ] **Step 3: Fix the documents.** Replace these exact strings:

`docs/PLAN.md:203` → `recencyLambda: number;        // shipped default 1 (D-021); 0.92 was proposed and failed the §4.15 gate`

`docs/PLAN.md:252` row → `| λ (recency) | 1 (D-021). 0.92 was proposed; the §4.15 acceptance backtest gained 4.9% against the 15% required, so the plan's own fallback ships. Perimenopause uses 0.8 (§4.9) | Cycle length drifts about −0.18 d/yr (Bull) and transition onset is marked by abrupt change (STRAW+10) |`

`docs/PLAN.md` §4.12 first paragraph, append: `All fixtures use λ = 1, the shipped default (D-021); the engine test \`fixtures.test.ts\` pins the fixture settings to \`RECENCY_LAMBDA\`.`

`docs/PLAN.md` §11.1 table, add row: `| Recency weighting | λ = 1 (0.92 failed the §4.15 gate, D-021); λ = 0.8 inside the perimenopause state | Shipping 0.92 on the plan's say-so | \`engine/params.ts: RECENCY_LAMBDA\` |`

`packages/engine/src/types.ts:55` → `recencyLambda: number; // shipped default RECENCY_LAMBDA = 1 (D-021)`

- [ ] **Step 4: Grep for leftovers** — `grep -n "0\.92" docs/PLAN.md packages/engine/src/*.ts` — every remaining hit must describe 0.92 as rejected or as a test input (`predict.test.ts:37`, `properties.test.ts:14` are fine).

- [ ] **Step 5: Commit**

```bash
git add docs/PLAN.md packages/engine/src/types.ts packages/engine/src/fixtures.test.ts
git commit -m "P3-10 λ: plan and type comments state the shipped default (λ = 1, D-021); fixtures pinned to RECENCY_LAMBDA"
```

---

### Task 2: Period runs join across up to 7 days; explicit split (P3-9)

**Files:**
- Modify: `apps/mobile/src/data/project.ts:26-27,117-123`
- Modify: `apps/mobile/src/features/logging/actions.ts:28-51`
- Modify: `apps/mobile/src/features/logging/LogSheet.tsx:60-80`
- Modify: `copy/en-AU.json` (`day.mergePrompt`, `day.merge` → replace; add `day.joinsPeriod`, `day.splitPeriod`)
- Test: `apps/mobile/src/data/store.test.ts:68-81,247-256`, `apps/mobile/src/features/logging/actions.test.ts`
- Docs: `docs/PLAN.md` §5.4 bullets 1–2, `docs/DECISIONS.md` (D-051), `docs/regulatory/requirements.md`, `risk-register.md`

**Interfaces:**
- Produces: projection rule `PERIOD_JOIN_DAYS = 7` (exported from `project.ts`, replaces `PERIOD_GAP_DAYS` and `MERGE_WINDOW_DAYS`); event `period.start { day, merge: false }` = "this day begins a new period even though the previous run ended ≤ 7 days ago"; `period.start { day, merge: true }` keeps its old meaning (join) and is now redundant but still accepted; `periodContext()` returns `{ startsNew: boolean; joinsStart?: ISODate }` (field `mergeWith` removed).

- [ ] **Step 1: Write the failing projection tests** (replace the two tests at `store.test.ts:69-77` and add three):

```ts
it('period days up to 7 days apart are one period', async () => {
  await periodsOf(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-12']);
  expect(await cycles()).toMatchObject([{ start_day: '2026-10-01', end_day: '2026-10-12', bleed_days: 12, next_start: null }]);
});
it('an 8-day gap starts a new cycle', async () => {
  await periodsOf(['2026-09-03', '2026-09-04', '2026-09-12']);
  expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-03', '2026-09-12']);
});
it('a period.start with merge:false splits a run inside the join window', async () => {
  await periodsOf(['2026-09-03', '2026-09-04', '2026-09-10']);
  await store.append({ kind: 'period.start', payload: { day: '2026-09-10', merge: false } });
  expect(await cycles()).toMatchObject([{ start_day: '2026-09-03', end_day: '2026-09-04', next_start: '2026-09-10', length_days: 7 }, { start_day: '2026-09-10' }]);
});
it('retracting the split restores the join', async () => {
  await periodsOf(['2026-09-03', '2026-09-10']);
  const split = await store.append({ kind: 'period.start', payload: { day: '2026-09-10', merge: false } });
  await store.append({ kind: 'retract', payload: {}, retracts: split.id });
  expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-03']);
});
it('a bare period.start inside the join window joins (back-filling an earlier day)', async () => {
  await store.append(flow('2026-09-25'));
  await store.append({ kind: 'period.start', payload: { day: '2026-09-20' } });
  expect(await cycles()).toMatchObject([{ start_day: '2026-09-20', end_day: '2026-09-25' }]);
});
```

Keep the existing tests "with a confirmed merge …" (still joins) and "a merge flag does not join starts more than 7 days apart" (still true). `store.append` returns the inserted `EventRow` (`store.ts:49`), so `split.id` is available.

- [ ] **Step 2: Run** `pnpm --filter @sanguine/mobile vitest run store` — Expected: the first and third new tests FAIL (second run splits at a 3-day gap today).

- [ ] **Step 3: Implement in `project.ts`**

```ts
// replace lines 26-27
/** §5.4 (D-051): period days ≤ 7 days apart are one period. A cycle shorter than MIN_VALID_LENGTH (15 d) is never valid, so joining can
 *  only remove rows the engine would discard; a user who knows better splits with period.start { merge: false }. */
export const PERIOD_JOIN_DAYS = 7;
/** Explicit "no flow" days inside the gap: one is tolerated (a user clearing a mistaken day), two or more mean the user said the bleeding stopped. */
export const PERIOD_JOIN_NONE_MAX = 1;
// in the event loop, replace the period.start case
case 'period.start': periodStarts.add(e.effective_day); if (p.merge === false) splitStarts.add(e.effective_day); break;
// declare next to mergeStarts (delete mergeStarts): const splitStarts = new Set<ISODate>();
// replace the run loop
const noneDays = new Set(dailyLog.filter((r) => r.flow === 'none').map((r) => r.day));
const explicitNones = (from: ISODate, to: ISODate): number => { let n = 0; for (let d = addDays(from, 1); d < to; d = addDays(d, 1)) if (noneDays.has(d)) n++; return n; };
for (const d of sortedDays) {
  const last = runs.at(-1);
  if (last && !splitStarts.has(d) && diffDays(d, last.end) <= PERIOD_JOIN_DAYS && explicitNones(last.end, d) <= PERIOD_JOIN_NONE_MAX) last.end = d;
  else runs.push({ start: d, end: d });
}
```

(`addDays` comes from `@sanguine/engine` next to `diffDays`.) Add two projection tests before Step 4:

```ts
it('one explicit no-flow day inside the gap still joins; two split', async () => {
  await periodsOf(['2026-09-01', '2026-09-02']);
  await store.append({ kind: 'flow', payload: { day: '2026-09-04', level: 'none', flow_kind: 'period' } });
  await store.append(flow('2026-09-06'));
  expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-01']);
  await store.append({ kind: 'flow', payload: { day: '2026-09-05', level: 'none', flow_kind: 'period' } });
  expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-01', '2026-09-06']);
});
```

Note: `merge: true` no longer needs special handling: a bare start within 7 days before an existing run joins because the *later* day is ≤ 7 days after it. Remove `MERGE_WINDOW_DAYS` and fix the one importer: `grep -rn MERGE_WINDOW_DAYS apps/mobile/src`.

- [ ] **Step 4: Run** `pnpm --filter @sanguine/mobile vitest run store` — Expected: PASS, including the two retained merge tests.

- [ ] **Step 5: Logging context and sheet.** In `actions.ts` replace `periodContext`'s tail:

```ts
/** The previous period ended within PERIOD_JOIN_DAYS before this day: logging flow joins it unless the user splits. */
const prev = [...cycles].reverse().find((c) => (c.end_day ?? c.start_day) < day && diffDays(day, c.end_day ?? c.start_day) <= PERIOD_JOIN_DAYS);
return prev ? { startsNew: false, joinsStart: prev.start_day } : { startsNew: true };
```

and in `setFlow` replace the `o.merge` line with:

```ts
if (o.split && kind === 'period' && level !== 'none' && level !== 'spotting') events.unshift({ kind: 'period.start', payload: { day, merge: false } } as never);
```

(`o.split?: boolean` replaces `o.merge`). Clearing a day must also remove a split or back-filled start on it, or a bleed-less one-day period survives (`project.ts:85` counts every active `period.start` as a period day): at the top of `setFlow`, `if (level === 'none') for (const e of (await dayEvents(store, day)).filter((e) => e.kind === 'period.start')) await store.retract(e.id);`. Test in `actions.test.ts`:

```ts
it('clearing the flow on a split day retracts the split', async () => {
  await periodsOf(['2026-09-01']);
  await setFlow(store, '2026-09-05', 'medium', { split: true });
  await setFlow(store, '2026-09-05', 'none');
  expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-01']);
});
``` In `LogSheet.tsx` delete the `Alert.alert(tr('day.mergePrompt') …)` branch; when `ctx.joinsStart` is set and kind is `period`, render under the flow tiles: Caption `tr('day.joinsPeriod', { date: formatDay(ctx.joinsStart) })` and a text `Button testID="split-period" label={tr('day.splitPeriod')}` that calls `setFlow(store, day, level, { kind, split: true })`. Copy:

```json
"joinsPeriod": "Counted as part of the period that started on {{date}}.",
"splitPeriod": "Start a new period instead"
```

Remove `mergePrompt`/`merge` keys and grep `tr('day.merge` for leftovers.

- [ ] **Step 6: Actions test** (`actions.test.ts`, add):

```ts
it('flow 5 days after the last bleed day joins; split writes period.start merge:false', async () => {
  await periodsOf(['2026-09-01', '2026-09-03']);
  expect(await periodContext(db, '2026-09-08')).toEqual({ startsNew: false, joinsStart: '2026-09-01' });
  expect(await periodContext(db, '2026-09-11')).toEqual({ startsNew: true });
  await setFlow(store, '2026-09-08', 'medium', { split: true });
  expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-09-01', '2026-09-08']);
});
```

Run `pnpm --filter @sanguine/mobile vitest run actions` — Expected: PASS. Then `pnpm -r typecheck && pnpm -r lint`.

- [ ] **Step 7: Maestro.** Update `apps/mobile/.maestro/logging.yaml` (or the flow that exercised the merge alert): log medium flow on day 1, light on day 6, assert one history row in Insights with "6 bleed days"; tap `split-period` on day 6, assert two rows. Run on the iOS simulator through the dev client; screenshots to `docs/screenshots/P3-9/`.

- [ ] **Step 8: Docs.** PLAN.md §5.4 bullet 1 → "`cycle.start_day` is the earliest day of a run of `period` flow days; days up to 7 apart belong to one run (D-051); a run shorter than one day of `light` or more is spotting, not a period." Bullet 2 → "A `period.start` with `merge: false` on a day inside that window begins a new period; the logging sheet offers it as 'Start a new period instead'." DECISIONS.md D-051: rule, rationale (MIN_VALID_LENGTH = 15 makes joining lossless for the fit; client's 12-day periods with unlogged days split into `suspect_short` fragments), rejected: raising the gap to 3 days (still splits a 12-day bleed with a 3-day hole), provenance-dependent joining (projection must not depend on provenance). `requirements.md` and `risk-register.md`: update the period-detection requirement and the "fragmented period" risk row.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/data apps/mobile/src/features/logging copy/en-AU.json apps/mobile/.maestro docs
git commit -m "P3-9 period runs join across up to 7 days; period.start merge:false splits; sheet offers 'Start a new period instead' (D-051)"
```

---

### Task 3: Pregnancy outcome, post-pregnancy bleeding, long-cycle actions (P3-12)

**Files:**
- Modify: `apps/mobile/src/data/events.ts:6` (FLOW_KINDS add `'post_pregnancy'`), `:73-75` (life_state.end outcome)
- Modify: `apps/mobile/src/features/settings/lifeState.ts` (add `endPregnancy`, `addPastPregnancy`)
- Modify: `apps/mobile/src/app/settings/lifestate.tsx` (outcome picker when the open state is `pregnant`; label for `after: 'loss'`)
- Modify: `apps/mobile/src/features/logging/actions.ts` (post-pregnancy bleeding default), `LogSheet.tsx:107` (bleed-kind chips gain the post-pregnancy option)
- Modify: `apps/mobile/src/features/insights/insightsModel.ts:16-28`, `apps/mobile/src/app/(tabs)/insights.tsx:62-66`
- Modify: `copy/en-AU.json`
- Test: `apps/mobile/src/features/settings/lifeState.test.ts` (create if absent), `actions.test.ts`, `insightsModel.test.ts`, `copy/copy.test.ts` runs unchanged
- Docs: PLAN.md §4.9 (new row), §11.1 (new row), DECISIONS.md D-052, `docs/regulatory/requirements.md`, `risk-register.md`, `engine-changelog.md` (entry: "no engine change; postpartum rule reused for pregnancy loss")

**Interfaces:**
- Produces: `POST_PREGNANCY_BLEED_DAYS = { birth: 42, loss: 14 }` in `actions.ts`; event `life_state.end { kind: 'pregnant', day, outcome: 'birth' | 'loss' }`; event `life_state.set { kind: 'postpartum', detail: { breastfeeding: boolean; after: 'birth' | 'loss' }, day }`; `endPregnancy(store, db, { day, outcome, breastfeeding? })`; `addPastPregnancy(store, { from, until, outcome })`; `periodContext()` gains `afterPregnancy?: 'birth' | 'loss'`; `LifeStateRow.detail.after`.
- Consumes: Task 2's `periodContext` shape.

- [ ] **Step 1: Event validation test** (`apps/mobile/src/data/events.test.ts`, add):

```ts
it('life_state.end for pregnant carries an outcome; other kinds must not', () => {
  expect(() => validateEvent({ kind: 'life_state.end', payload: { kind: 'pregnant', day: '2026-03-01', outcome: 'loss' } })).not.toThrow();
  expect(() => validateEvent({ kind: 'life_state.end', payload: { kind: 'pregnant', day: '2026-03-01' } })).not.toThrow(); // older logs and exports have no outcome
  expect(() => validateEvent({ kind: 'life_state.end', payload: { kind: 'pregnant', day: '2026-03-01', outcome: 'other' } })).toThrow(/outcome/);
  expect(() => validateEvent({ kind: 'life_state.end', payload: { kind: 'perimenopause', day: '2026-03-01', outcome: 'loss' } })).toThrow(/outcome/);
  expect(() => validateEvent({ kind: 'flow', payload: { day: '2026-03-02', level: 'medium', flow_kind: 'post_pregnancy' } })).not.toThrow();
});
```

- [ ] **Step 2: Run** `pnpm --filter @sanguine/mobile vitest run events` — Expected: FAIL (`post_pregnancy` not in FLOW_KINDS; outcome not checked).

- [ ] **Step 3: Implement in `events.ts`**

```ts
export const FLOW_KINDS = ['period', 'withdrawal_bleed', 'intermenstrual', 'on_contraception', 'post_pregnancy'] as const;
export const PREGNANCY_OUTCOMES = ['birth', 'loss'] as const;
// life_state.end case:
if (!oneOf(LIFE_STATE_KINDS, p.kind)) fail(e.kind, 'kind');
if (p.outcome !== undefined && (p.kind !== 'pregnant' || !oneOf(PREGNANCY_OUTCOMES, p.outcome))) fail(e.kind, 'outcome'); // optional: an export from before this change still imports
return day();
```

No migration: `001_init.ts` checks `flow` levels only (line 45), not `flow_kind`, so a `post_pregnancy` row is accepted as is.

- [ ] **Step 4: Run** `pnpm --filter @sanguine/mobile vitest run events` — Expected: PASS.

- [ ] **Step 5: Life-state helpers test** (`apps/mobile/src/features/settings/lifeState.test.ts`):

```ts
it('ending a pregnancy with a loss sets a postpartum state marked after:loss, not breastfeeding', async () => {
  await store.append({ kind: 'life_state.set', payload: { kind: 'pregnant', detail: {}, day: '2026-01-10' } });
  await endPregnancy(store, db, { day: '2026-03-01', outcome: 'loss' });
  const rows = await lifeStateHistory(db);
  expect(rows).toMatchObject([
    { kind: 'pregnant', from_day: '2026-01-10', until_day: '2026-03-01' },
    { kind: 'postpartum', from_day: '2026-03-01', until_day: null, detail: { breastfeeding: false, after: 'loss' } },
  ]);
});
it('a past pregnancy covers its cycle so it is life_state, not suspect_skip', async () => {
  await periodsOf(['2025-06-01', '2026-03-15']);
  await addPastPregnancy(store, { from: '2025-06-01', until: '2026-03-10', outcome: 'loss', resumed: '2026-03-15' });
  expect((await cycles()).map((c) => c.quality)).toEqual(['life_state', 'valid']);
  expect((await lifeStateHistory(db)).map((r) => [r.kind, r.until_day])).toEqual([['pregnant', '2026-03-10'], ['postpartum', '2026-03-15']]);
});
```

- [ ] **Step 6: Implement in `lifeState.ts`**

```ts
export async function endPregnancy(store: EventStore, db: Database, o: { day: ISODate; outcome: 'birth' | 'loss'; breastfeeding?: boolean }): Promise<void> {
  const open = (await lifeStateHistory(db)).filter((r) => r.until_day === null && r.kind === 'pregnant');
  if (open.length === 0) return;
  await store.appendMany([
    { kind: 'life_state.end', payload: { kind: 'pregnant', day: o.day, outcome: o.outcome } },
    { kind: 'life_state.set', payload: { kind: 'postpartum', detail: { breastfeeding: o.outcome === 'birth' && Boolean(o.breastfeeding), after: o.outcome }, day: o.day } },
  ]);
}
/** A pregnancy in the past (imported history): pregnant from..until, then the postpartum state, ended at `resumed` (the next logged period start) when known. */
export async function addPastPregnancy(store: EventStore, o: { from: ISODate; until: ISODate; outcome: 'birth' | 'loss'; resumed?: ISODate }): Promise<void> {
  await store.appendMany([
    { kind: 'life_state.set', payload: { kind: 'pregnant', detail: {}, day: o.from } },
    { kind: 'life_state.end', payload: { kind: 'pregnant', day: o.until, outcome: o.outcome } },
    { kind: 'life_state.set', payload: { kind: 'postpartum', detail: { breastfeeding: false, after: o.outcome }, day: o.until } },
    ...(o.resumed ? [{ kind: 'life_state.end', payload: { kind: 'postpartum', day: o.resumed } }] : []),
  ]);
}
```

In `changeLifeState`, when the open state is `pregnant` and the new choice is anything but `pregnant`, the screen must route through `endPregnancy` first (the outcome picker, Step 9), so `changeLifeState` ends only non-pregnant states: `open.filter((r) => r.kind !== 'pregnant')`. Check `project.ts: lifeStateOf` passes `after` through? It does not need to: the engine reads only `breastfeeding`. Keep `detail` JSON intact in the row (it already is).

- [ ] **Step 7: Run** `pnpm --filter @sanguine/mobile vitest run lifeState` — Expected: PASS. Check `classify.ts: overlapsSuspendingState` includes `pregnant` (SUSPENDING at `classify.ts:12`: yes).

- [ ] **Step 8: Post-pregnancy bleeding default** (`actions.test.ts`):

```ts
it('bleeding within 14 days after a loss defaults to post_pregnancy and does not start a cycle', async () => {
  await addPastPregnancy(store, { from: '2026-01-10', until: '2026-03-01', outcome: 'loss' });
  expect((await periodContext(db, '2026-03-05')).afterPregnancy).toBe('loss');
  expect((await periodContext(db, '2026-03-16')).afterPregnancy).toBeUndefined();
  await setFlow(store, '2026-03-05', 'heavy');           // default kind from context
  expect(await cycles()).toEqual([]);
  await setFlow(store, '2026-03-05', 'heavy', { kind: 'period' }); // explicit choice wins
  expect((await cycles()).map((c) => c.start_day)).toEqual(['2026-03-05']);
});
```

Implement in `actions.ts`:

```ts
/** §11.1 (D-052): bleeding this soon after a pregnancy is not a period unless the user says so. Birth: lochia up to 6 weeks; loss: 2 weeks. */
export const POST_PREGNANCY_BLEED_DAYS = { birth: 42, loss: 14 } as const;
// in periodContext, before the join check:
const pp = (await lifeStateHistory(db)).filter((r) => r.kind === 'postpartum' && r.from_day <= day).at(-1); // rows with detail already parsed
const after = pp?.detail.after as 'birth' | 'loss' | undefined;
const afterPregnancy = pp && after && diffDays(day, pp.from_day) <= POST_PREGNANCY_BLEED_DAYS[after] ? after : undefined;
// setFlow: default kind
const kind = o.kind ?? ((await periodContext(db, day)).afterPregnancy ? 'post_pregnancy' : 'period');
```

(`setFlow` currently takes `store` only; add `db` as the first parameter, update its callers: `grep -rn "setFlow(" apps/mobile/src`. `lifeStateHistory` and its `LifeStateRow` (parsed `detail`) move from `features/settings/lifeState.ts` to `apps/mobile/src/data/lifeStates.ts` so logging does not import from settings; `lifeState.ts` re-exports them.) Run `pnpm --filter @sanguine/mobile vitest run actions` — Expected: PASS.

- [ ] **Step 9: Screens and copy.**

`LogSheet.tsx`: when `ctx.afterPregnancy` is set, show the "Bleeding" header variant (the same branch hormonal-contraception users get) with chips `[{ value: 'post_pregnancy', label: tr('log.afterPregnancyBleed') }, { value: 'period', label: tr('log.periodBleed') }]`, `post_pregnancy` preselected; `BleedKind` type widens to include both.

`settings/lifestate.tsx`: when the current state is `pregnant` and the user picks another option (or taps a new row "Pregnancy ended"), show a two-option picker `tr('lifeState.outcome.birth')` / `tr('lifeState.outcome.loss')` with a date field, then `endPregnancy`; `birth` then asks the existing breastfeeding question. History rows whose detail has `after: 'loss'` display `tr('lifeState.options.afterLoss')`.

`insightsModel.ts`: rename `offerMissedLog` → `offerLongCycleReview` (same condition); `insights.tsx`: third button `testID="was-pregnant"` label `tr('insights.wasPregnant')` → `router.push({ pathname: '/settings/lifestate', params: { pastPregnancyFrom: r.startISO, pastPregnancyUntil: r.nextStartISO ?? today, resumed: r.nextStartISO } })`; the lifestate screen reads those params, shows the outcome picker (and lets the user move the end date earlier than the next period) and calls `addPastPregnancy` with `resumed` = the next cycle start. Add `nextStartISO` to the history row (from `cycle.next_start`).

Copy (`copy/en-AU.json`):

```json
"insights": { "quality": { "suspect_skip": "unusually long" }, "longCyclePrompt": "This cycle was unusually long.", "missedLogPrompt": "Was there a period in between?", "wasPregnant": "I was pregnant", "confirmLong": "No, this cycle was this long" },
"lifeState": { "options": { "afterLoss": "After a pregnancy loss" }, "ended": "Pregnancy ended", "outcome": { "birth": "I gave birth", "loss": "Pregnancy loss" } },
"log": { "afterPregnancyBleed": "Bleeding after pregnancy", "periodBleed": "My period" }
```

Run `pnpm vitest run copy` — Expected: PASS (none of these words are on the forbidden list; "normal"/"abnormal" avoided on purpose).

- [ ] **Step 10: Teen mode.** Today teen mode does not hide life-state options; onboarding only adds the `teen-note` caption (`OnboardingFlow.tsx:101`) and `settings/lifestate.tsx` has no teen branch. Keep that behaviour: the outcome picker and the past-pregnancy screen use the same copy for every age and no fertility wording. Nothing to add; note it in D-052 so the question is not reopened.

- [ ] **Step 11: Maestro.** New flow `apps/mobile/.maestro/pregnancy.yaml`: set state Pregnant from 10 Jan; Settings → Pregnancy ended → Pregnancy loss, 1 Mar; log heavy flow on 5 Mar, assert the sheet header reads "Bleeding" and Insights has no cycle starting 5 Mar; log medium flow on 2 Apr, assert a history row "2 Apr". Second scenario: import a CSV with starts 1 Jun 2025 and 15 Mar 2026, open Insights, assert chip "unusually long" and button "I was pregnant", tap it, pick Pregnancy loss, assert the chip disappears and the row reads "paused" (`quality` life_state label). Run on iOS and Android dev clients; screenshots to `docs/screenshots/P3-12/`.

- [ ] **Step 12: Docs.** PLAN.md §4.9 new row: `| Pregnancy loss | As postpartum, not breastfeeding: suspended until the first logged period, then the post-contraception warm-up; bleeding within 14 days of the loss is logged as post-pregnancy bleeding, not a period | Return of ovulation after early loss is within weeks; the first bleed is not menses (VERIFY: no retrieved timing figure; conservative default D-052) |`. §11.1 new row: `| Post-pregnancy bleeding window | 42 d after birth, 14 d after loss: bleeding defaults to post_pregnancy, user can override to period | Treating any bleed as a period: counts lochia or loss bleeding as menses | \`features/logging/actions.ts: POST_PREGNANCY_BLEED_DAYS\` |`. §9.8 Insights prompt: replace "possibly a missed log" with "unusually long" and add the third action. DECISIONS.md D-052 with the rejected alternatives: a new engine `LifeState` kind (would change the engine for no new rule), a flag naming miscarriage (forbidden by design), asking "was this a missed log?" first (insensitive when it was a pregnancy; the neutral chip plus three equal actions replaces it). `engine-changelog.md`: "no engine rule change; postpartum rule now also applied after pregnancy loss by the app layer". `requirements.md`: new requirement rows for the outcome event and the bleeding default; `risk-register.md`: new hazard "loss bleeding counted as a period" with this mitigation.

- [ ] **Step 13: Commit**

```bash
git add apps/mobile/src copy docs apps/mobile/.maestro
git commit -m "P3-12 pregnancy outcome (birth/loss), post-pregnancy bleeding kind, 'I was pregnant' on long cycles, neutral long-cycle wording (D-052)"
```

---

### Task 4: Shared daily-row importer (P3-13 part 1, unblocked)

**Files:**
- Create: `apps/mobile/src/data/importDaily.ts`
- Test: `apps/mobile/src/data/importDaily.test.ts`
- Modify: `apps/mobile/src/data/exportImport.ts` (importPeriodCsv unchanged; add re-export of the new types for the service)

**Interfaces:**
- Produces:

```ts
export interface DailyRow {
  day: ISODate;
  flow?: 'spotting' | 'light' | 'medium' | 'heavy';
  flowKind?: FlowKind;                 // default 'period'
  tempC?: number; tempTime?: string;   // 'HH:MM'
  tempExcluded?: boolean;              // source app marked the reading deviating → disturbed
  lh?: 'positive' | 'negative';
  mucus?: 'dry' | 'sticky' | 'creamy' | 'eggwhite' | 'watery';
  sexProtected?: boolean;
  note?: string;
}
export async function importDailyRows(db: Database, store: EventStore, rows: DailyRow[], o: { sourceApp: string; today: ISODate; noteKey?: Uint8Array; clock: Clock }): Promise<{ added: number; skipped: number; notesDropped: number }>;
```

Rules: one `import.batch` audit event first; every event `provenance: 'imported'`, `source_app`, `external_id: `${sourceApp}:${day}:${kind}`` for flow, sex and note and `${sourceApp}:${day}:biomarker:${type}` for biomarkers (a day with a temperature and an LH test must import both) so a second import of the same file is skipped by `external_id` (query existing `external_id`s once, skip matches; count as `skipped`); temperatures → `biomarker { type: 'bbt', value: { valueC }, measured_at: day + 'T' + tempTime, source: 'oral', disturbed: tempExcluded }`; LH → `biomarker { type: 'lh', value: { result } }`; mucus → `biomarker { type: 'mucus', value: { quality }, source: 'app' }` and LH `source: 'strip'`, matching `actions.ts:85-86`; notes sealed with `sealNote(noteKey, …)` exactly as `actions.ts: saveNote`; the key comes from `getNoteKey()` in `services/secrets.ts` (the same call `MoreSection.tsx:147` makes), so the service always passes it; `noteKey` stays optional in the function signature only so the unit test can exercise the `notesDropped` path. Check `BIOMARKER_TYPES` and the value shapes in `events.ts` and `project.ts:140-160` before writing; use the same keys the logging actions use.

- [ ] **Step 1: Write the failing tests**

```ts
it('writes flow, temperature, LH and note events with imported provenance and stable external ids', async () => {
  const r = await importDailyRows(db, store, [
    { day: '2026-09-01', flow: 'medium', tempC: 36.3, tempTime: '06:40', note: 'cramps bad' },
    { day: '2026-09-02', flow: 'heavy', tempC: 36.9, tempExcluded: true },
    { day: '2026-09-14', lh: 'positive' },
  ], { sourceApp: 'natural_cycles', today: '2026-10-10', noteKey: KEY, clock });
  expect(r).toEqual({ added: 6, skipped: 0, notesDropped: 0 });
  const events = await store.events();
  expect(events.every((e) => e.kind === 'import.batch' || (e.provenance === 'imported' && e.source_app === 'natural_cycles' && e.external_id))).toBe(true);
  expect(await cycles()).toMatchObject([{ start_day: '2026-09-01', end_day: '2026-09-02', bleed_days: 2 }]);
  const bio = await db.all('SELECT day, type, disturbed FROM biomarker ORDER BY day');
  expect(bio).toMatchObject([{ day: '2026-09-01', type: 'bbt', disturbed: 0 }, { day: '2026-09-02', type: 'bbt', disturbed: 1 }, { day: '2026-09-14', type: 'lh', disturbed: 0 }]);
});
it('a temperature and an LH test on the same day both import', async () => {
  const r = await importDailyRows(db, store, [{ day: '2026-09-14', tempC: 36.5, lh: 'positive' }], { sourceApp: 'x', today: '2026-10-10', clock });
  expect(r.added).toBe(2);
});
it('second import adds nothing', async () => {
  const rows = [{ day: '2026-09-01', flow: 'medium' as const }];
  await importDailyRows(db, store, rows, { sourceApp: 'x', today: '2026-10-10', clock });
  expect(await importDailyRows(db, store, rows, { sourceApp: 'x', today: '2026-10-10', clock })).toEqual({ added: 0, skipped: 1, notesDropped: 0 });
});
it('notes are dropped and counted when no note key is given', async () => {
  const r = await importDailyRows(db, store, [{ day: '2026-09-01', note: 'x' }], { sourceApp: 'x', today: '2026-10-10', clock });
  expect(r).toEqual({ added: 0, skipped: 0, notesDropped: 1 });
});
it('excluded temperature is disturbed (never a clean reading)', async () => { /* covered by the first test's bio[1]; keep as a named assertion */ });
```

- [ ] **Step 2: Run** `pnpm --filter @sanguine/mobile vitest run importDaily` — Expected: FAIL (module missing).

- [ ] **Step 3: Implement `importDaily.ts`** per the interface above; `NewEvent` already carries optional `provenance`, `source_app` and `external_id` (`events.ts:20-25`) and `store.ts:30` writes them, so no store change is needed.

- [ ] **Step 4: Run** `pnpm --filter @sanguine/mobile vitest run importDaily store` — Expected: PASS. `pnpm -r typecheck && pnpm -r lint`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/data/importDaily.ts apps/mobile/src/data/importDaily.test.ts apps/mobile/src/data/store.ts
git commit -m "P3-13 shared DailyRow importer: flow, temperature, LH, mucus, sex, notes with imported provenance and idempotent external ids"
```

---

### Task 5: Natural Cycles parser and picker (P3-13 part 2, **blocked on a sample export**)

**Blocker:** the Natural Cycles help centre and the Read Your Body import notes are behind a bot wall (HTTP 403 / Cloudflare challenge on 2026-10-09), and the format is not documented anywhere reachable. What is known: the export is a zip from the app's data-download option containing `Daily Entries.csv` (per the search snippet of help.naturalcycles.com article 360006693938). Column names, date format and the encoding of period/flow, temperature exclusion, LH, notes and sex are unknown. **Ask the client for her export zip, or at minimum the header row and ten representative rows (a 12-day period, a temperature marked excluded, an LH positive, a note, a pregnancy).** With her consent the file, dates shifted by a constant offset and notes replaced, becomes the committed fixture `apps/mobile/src/data/fixtures/natural-cycles/Daily Entries.csv`; without consent, write a synthetic fixture with the same header and shapes. Do not start Steps 2–5 before the header is in hand; a parser written against guessed column names is worse than none.

**Files:**
- Create: `apps/mobile/src/data/naturalCycles.ts`, `apps/mobile/src/data/naturalCycles.test.ts`, the fixture above
- Modify: `apps/mobile/src/services/exportImport.ts:25-40` (zip detection), `apps/mobile/src/app/settings/data.tsx` or wherever `pickAndImport` results are rendered (grep `PickedImport`), `copy/en-AU.json` (import result strings)
- Docs: PLAN.md §8.10, DECISIONS.md D-053, `docs/regulatory/soup.md` unchanged (no new dependency), V-11 row extended with Natural Cycles

**Interfaces:**
- Produces: `parseNaturalCycles(csvText: string): { rows: DailyRow[]; problems: string[] }`; `isNaturalCyclesExport(files: Record<string, Uint8Array>): boolean` (true when a key ends with `Daily Entries.csv`); `PickedImport` gains `{ kind: 'natural_cycles'; result: Awaited<ReturnType<typeof importDailyRows>> & { problems: string[] } }`.
- Consumes: Task 4's `DailyRow` and `importDailyRows`.

- [ ] **Step 1: Obtain the sample; record the header verbatim in DECISIONS.md D-053 and in a comment at the top of `naturalCycles.ts` (`NC_COLUMNS`), including the date format and the flow vocabulary.**

- [ ] **Step 2: Write the failing parser test against the fixture**: row count equals fixture rows with any data; the 12-day period yields twelve `flow` rows; the excluded temperature yields `tempExcluded: true`; the LH row yields `lh: 'positive'`; the note row yields the note text; an unknown column is ignored; a malformed date yields one `problems` entry and no row.

- [ ] **Step 3: Implement `parseNaturalCycles`** with `parseCsv` from `./csv`, a `NC_COLUMNS` map `{ date: '<header>', temperature: '<header>', … }`, and `parseDateCell`-style strict date parsing in the export's own format (add a third pattern to `parseDateCell` only if the export uses one not covered). Flow mapping and the excluded-temperature marker come from the real file. Run the test — Expected: PASS.

- [ ] **Step 4: Picker.** In `services/exportImport.ts`, when the picked file is a zip: `const files = unzipSync(bytes); if (isNaturalCyclesExport(files)) return { kind: 'natural_cycles', result: { ...(await importDailyRows(db, store, rows, { sourceApp: 'natural_cycles', today, noteKey, clock: deviceClock })), problems } }; else importBundle(...)`. `noteKey: await getNoteKey()` from `services/secrets.ts`. Result screen copy: `"importNatural": "Imported {{added}} entries from Natural Cycles."`. After any import, if any cycle is longer than 90 days, show `"importLongCycles": "{{count}} cycles are longer than 90 days. Review them in Insights."` with a link to the History tab (Task 3's "I was pregnant" lives there).

- [ ] **Step 5: End-to-end on the simulator.** Push the fixture zip into the simulator's Files app (`xcrun simctl addmedia` does not take zips; use `xcrun simctl openurl` on a `shareddocuments://` path, or drag into Files), run `apps/mobile/.maestro/import-natural-cycles.yaml`: pick the file, assert the result sheet, open Insights, assert the 12-bleed-day row and the long-cycle prompt, tap "I was pregnant", pick Pregnancy loss, assert the chip changes. Screenshots to `docs/screenshots/P3-13/`. Android: same through the emulator's Files.

- [ ] **Step 6: Docs and commit.** PLAN.md §8.10: add "Natural Cycles (`Daily Entries.csv` inside its export zip)" before the Flo/Clue sentence; the generic CSV importer stays for period-start lists. DECISIONS.md D-053: the format as observed, what is imported, what is not (anything the export has that Sanguine has no event for is listed), and the rejected alternative of parsing Natural Cycles' own cycle boundaries (Sanguine recomputes cycles from bleeding days so the join rule of D-051 applies uniformly). `requirements.md`: import requirement row.

```bash
git add apps/mobile/src/data/naturalCycles.ts apps/mobile/src/data/naturalCycles.test.ts apps/mobile/src/data/fixtures apps/mobile/src/services/exportImport.ts apps/mobile/src/app/settings copy docs apps/mobile/.maestro
git commit -m "P3-13 Natural Cycles import: Daily Entries.csv → DailyRow (flow, temperature, LH, notes, sex); long-cycle review after import (D-053)"
```

---

## Order and dependencies

Task 0 → Task 1 (independent, 30 min together) → Task 2 (projection; Task 3 and 4 build on `periodContext`) → Task 3 → Task 4 → Task 5 (blocked until the client's sample arrives; Tasks 0–4 ship without it).

## Reply to the client (for the user to send; plain language, no code)

- Import: agreed. We will import the full Natural Cycles daily file (bleeding and flow, temperatures including the ones NC excluded, ovulation tests, notes, sex), not only period dates. We need one sample export from you to build it against; the header row and ten rows are enough, and the file is not kept unless you say so.
- Pregnancy loss: agreed. Ending a pregnancy will ask "gave birth" or "pregnancy loss"; bleeding in the weeks after is not counted as a period unless you say it is; estimates pause until your first period and then warm up over three cycles. A long cycle will no longer be labelled "possibly a missed log": it will say "unusually long" with three equal choices, one of them "I was pregnant".
- Bleeding gaps: agreed. Bleeding days up to a week apart now count as one period, with a "Start a new period instead" option when that is wrong. Your 12-day and 6-day periods stay whole.
- λ: the shipped engine already uses λ = 1 (the 0.92 weighting failed our own acceptance test in D-021 and was not adopted); the plan text still said 0.92 in two places and is being corrected. The test numbers are consistent with the shipped engine.
- Dates: fixed. 10 Oct 2026 is a Saturday in the mockups and the design prompts.
