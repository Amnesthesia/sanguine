# Say Why a Day Can't Be Placed (P8-43) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place more days in a phase when the ovulation estimate is wide, say on the guidance card why a day still can't be placed, and keep the Insights accuracy count scored by the running engine.

**Architecture:** `phaseOn` (pure, `features/guidance/guidance.ts`) already decides `general`; it gains the narrower placement rule and returns a `reason`. `BodyCard` renders the reason as the card's first sentence from new `guidance.general.reason.*` copy. The score ledger re-scores rows from an older engine version.

**Tech Stack:** TypeScript, React Native (Expo), i18next, vitest, @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-11-25-general-phase-reason-design.md`

## Global Constraints
- Copy addresses women (D-050), en-AU spelling; no word on the PLAN §2.3/§8.7 forbidden list (`copy/copy.test.ts` enforces it).
- No `ovulat|fertil|pregnan` in anything under `guidance.*` except the ovulatory phase (`teenAudit.test.ts` "nothing a teen can reach uses fertility words" enforces it; new keys sit under `guidance.general`).
- No marker or band for an uncertain ovulation estimate (D-098, D-115); no `ovulatory` phase while uncertain.
- The engine (`packages/engine`) is not changed.
- After any `copy/en-AU.json` change run `pnpm -s i18n:extract`.
- Commits: own paths only (`git commit -- <paths>`), message starts `P8-43`, references D-162, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Decision id D-162 and backlog id P8-43 (claimed with peer sessions before writing to `docs/DECISIONS.md`).

## Review Focus
- A wide estimate whose 80% range starts before the bleed ends: bleeding days stay `menstrual` (menstrual check runs first). Test in Task 1.
- A wide range that runs past the premenstrual start: premenstrual wins over `general` (check order). Test in Task 1.
- Fewer than 2 valid closed cycles when the reason is `wide`: `min`/`max` absent, copy falls back to a sentence without numbers. Test in Tasks 1 and 2.
- Teen mode / estimate switched off: reasons render (no fertility words), and placement still yields follicular/luteal, never ovulatory. Test in Task 1 (`showEstimate: false`).
- Paused with no recognised life state (e.g. a gate from data, not settings): unnamed fallback sentence. Test in Task 2.

---

### Task 1: `phaseOn` places days around a wide estimate and returns a reason

**Files:**
- Modify: `apps/mobile/src/features/guidance/guidance.ts` (types near line 21; `phaseOn` lines 75-106)
- Test: `apps/mobile/src/features/guidance/guidance.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type GeneralReason =
    | { kind: 'late'; by: ISODate }
    | { kind: 'wide'; width: number; n?: number; min?: number; max?: number }
    | { kind: 'paused' }
    | { kind: 'setAside'; quality: 'suspect_skip' | 'suspect_short' | 'user_excluded' };
  export interface GuideDay { phase: GuidePhase; expected: boolean; frame?: CycleFrame; reason?: GeneralReason }
  export function pausingStateKey(lifeStates: readonly LifeState[]): string | undefined;
  ```
  `pausingStateKey` returns an i18n key: hormonal contraception with method `hormonal_iud` → `'settings.lifeState.methods.hormonal_iud'`; `perimenopause` → `'settings.lifeState.options.perimenopause'`; `postpartum` with `breastfeeding: true` → `'settings.lifeState.breastfeeding'`; first match in that order; otherwise `undefined`.

- [ ] **Step 1: Write the failing tests** (replace the two existing "uncertain ovulation gives general…" and "no ovulation estimate gives general" tests; add to the late and suspect_skip tests)

```ts
const WIDE = pred({ ovulation: { point: '2026-10-19', i80: { lo: '2026-10-12', hi: '2026-10-26' }, sd: 5.5, confidence: 'low', basis: 'calendar' } });
it('a wide estimate places days before its range as follicular and after it as luteal; inside the range is general with reason wide', () => {
  expect(on('2026-10-11', { prediction: WIDE })?.phase).toBe('follicular');
  expect(on('2026-10-12', { prediction: WIDE })).toMatchObject({ phase: 'general', reason: { kind: 'wide', width: 14, n: 2, min: 28, max: 29 } });
  expect(on('2026-10-26', { prediction: WIDE })?.phase).toBe('premenstrual'); // premenstrual (from 10-27 minus... ) wins: next point 11-01, 5 days before = 10-27
  expect(on('2026-10-25', { prediction: WIDE })?.phase).toBe('general');
  for (const d of ['2026-10-12', '2026-10-19', '2026-10-25']) expect(on(d, { prediction: WIDE })?.phase).not.toBe('ovulatory');
});
it('a wide range never overrides bleeding or premenstrual days', () => {
  const early = pred({ ovulation: { point: '2026-10-16', i80: { lo: '2026-10-05', hi: '2026-10-30' }, sd: 9, confidence: 'low', basis: 'calendar' } });
  expect(on('2026-10-05', { prediction: early })?.phase).toBe('menstrual');
  expect(on('2026-10-28', { prediction: early })?.phase).toBe('premenstrual');
});
it('estimate switched off (teen mode): the same placement, no ovulatory', () =>
  expect(on('2026-10-11', { prediction: WIDE, showEstimate: false })?.phase).toBe('follicular'));
it('wide with fewer than two valid closed cycles carries no min and max', () =>
  expect(on('2026-10-15', { prediction: WIDE, cycles: [rec('2026-10-04', undefined, { end: '2026-10-07' })] })?.reason).toEqual({ kind: 'wide', width: 14 }));
it('no ovulation estimate: general with reason paused', () => {
  const { ovulation: _o, ...rest } = pred();
  expect(on(TODAY, { prediction: rest as Prediction })).toMatchObject({ phase: 'general', reason: { kind: 'paused' } });
});
// in the existing late test:  toMatchObject({ phase: 'general', expected: false, reason: { kind: 'late', by: '2026-11-03' } })
// in the existing suspect_skip test: toMatchObject({ phase: 'general', reason: { kind: 'setAside', quality: 'suspect_skip' } })
it('pausingStateKey names the state that stops the estimate', () => {
  expect(pausingStateKey([{ kind: 'hormonal_contraception', method: 'hormonal_iud', since: '2026-01-01' }])).toBe('settings.lifeState.methods.hormonal_iud');
  expect(pausingStateKey([{ kind: 'perimenopause', since: '2026-01-01' }])).toBe('settings.lifeState.options.perimenopause');
  expect(pausingStateKey([{ kind: 'postpartum', delivered: '2026-01-01', breastfeeding: true }])).toBe('settings.lifeState.breastfeeding');
  expect(pausingStateKey([{ kind: 'postpartum', delivered: '2026-01-01', breastfeeding: false }])).toBeUndefined();
  expect(pausingStateKey([])).toBeUndefined();
});
```
Correct the inline comment in the first test when writing it: next period point is 2026-11-01, so premenstrual starts 2026-10-27; pick the "after range" luteal check accordingly (use a WIDE range ending 2026-10-24 if needed so that 2026-10-25 and 2026-10-26 are `luteal`, and assert `luteal` for a day after `hi` and before 10-27). The test must assert one day of each: follicular (before lo), general (inside), luteal (after hi, before premenstrual), premenstrual.

- [ ] **Step 2: Run** `npx vitest run apps/mobile/src/features/guidance/guidance.test.ts` — expected FAIL (no `reason`, whole cycle general).

- [ ] **Step 3: Implement in `guidance.ts`**
  - Order inside the open-cycle branch stays: late/beyond → expected period day → (new) then: if `!p.ovulation` → `general` + `{ kind: 'paused' }`; compute `nextStart`; premenstrual check; if `ovulationUncertain(p)`: `date < i80.lo` → follicular, `date > i80.hi` → luteal, else `general` + `wide` reason; otherwise the existing ovulatory/follicular/luteal logic.
  - `width` = `diffDays(p.ovulation.i80.hi, p.ovulation.i80.lo)`; `n`/`min`/`max` = count, shortest and longest `length` of `valid` cycles with `nextStart`, last `WINDOW_CYCLES` of them (import `WINDOW_CYCLES` from `@sanguine/engine`); omit all three when fewer than 2.
  - late branch: `{ kind: 'late', by: next.i80.hi }` (only when the result is `general`, i.e. not expected).
  - closed non-valid cycle: `{ kind: 'setAside', quality: cycle.quality }`.
  - `at()` gains an optional reason argument; non-general results never carry one.

- [ ] **Step 4: Run** the same command — expected PASS; also `npx vitest related apps/mobile/src/features/guidance/guidance.ts` (notifications plan, energy model use `phaseOn`) — expected PASS; fix any test that pinned "whole cycle general" only by updating it to the new rule.

- [ ] **Step 5: Commit** `git commit -- apps/mobile/src/features/guidance/guidance.ts apps/mobile/src/features/guidance/guidance.test.ts <any updated callers' tests>` with message `P8-43 Place days around a wide ovulation range and return why a day stays unplaced (D-162)`.

### Task 2: the guidance card says the reason

**Files:**
- Modify: `copy/en-AU.json` (`guidance.general`), `apps/mobile/src/features/guidance/sections/GuidanceSections.tsx` (`BodyCard`, lines 62-77), `docs/i18n/strings-for-translation.csv` (regenerated)
- Test: `apps/mobile/src/features/guidance/sections/sections.test.tsx`

**Interfaces:**
- Consumes: `GuideDay.reason`, `GeneralReason`, `pausingStateKey` (Task 1); `useApp().settings?.lifeStates`; `formatDay` from `@/ui/format`; `t('insights.quality.<quality>')`.
- Produces: `export function generalReasonText(reason: GeneralReason | undefined, t: TFunction, lifeStates: readonly LifeState[]): string | undefined` in `GuidanceSections.tsx` (undefined → keep the generic body).

- [ ] **Step 1: Add copy** under `guidance.general` (exact text):
```json
"reason": {
  "late": "Your period is later than the range Sanguine expected (by {{date}}), so it can't place this day in a phase.",
  "wide": "Over your last {{n}} cycles, lengths have varied from {{min}} to {{max}} days, so the middle of your cycle can only be narrowed to {{width}} days. This day falls inside that stretch, so it isn't placed in a phase.",
  "wideNoRange": "The middle of your cycle can only be narrowed to {{width}} days so far. This day falls inside that stretch, so it isn't placed in a phase.",
  "paused": "While {{state}} is set, Sanguine doesn't estimate the middle of the cycle, so it can't place this day in a phase.",
  "pausedUnnamed": "Sanguine isn't estimating the middle of your cycle right now, so it can't place this day in a phase.",
  "setAside": "This cycle was left out of estimates ({{quality}}), so its days aren't placed in a phase."
},
"anyDay": "These notes hold for any day of the cycle."
```
Check the interpolation syntax the project uses (`{date}` single braces appear in `copy/en-AU.json`; match it exactly). Run `pnpm -s i18n:extract`.

- [ ] **Step 2: Write the failing tests** in `sections.test.tsx`
```ts
it('a general day says why: late, wide (with and without numbers), paused (named and unnamed), set aside', () => {
  const t = i18n.t.bind(i18n);
  expect(generalReasonText({ kind: 'late', by: '2026-11-03' }, t, [])).toContain('later than the range');
  expect(generalReasonText({ kind: 'wide', width: 14, n: 36, min: 24, max: 38 }, t, [])).toContain('Over your last 36 cycles, lengths have varied from 24 to 38 days');
  expect(generalReasonText({ kind: 'wide', width: 14 }, t, [])).toContain('narrowed to 14 days so far');
  expect(generalReasonText({ kind: 'paused' }, t, [{ kind: 'perimenopause', since: '2026-01-01' }])).toContain('While Perimenopause is set');
  expect(generalReasonText({ kind: 'paused' }, t, [])).toContain("isn't estimating");
  expect(generalReasonText({ kind: 'setAside', quality: 'suspect_skip' }, t, [])).toContain('(unusually long)');
  expect(generalReasonText(undefined, t, [])).toBeUndefined();
});
it('the card shows the reason first and the any-day line after; compact shows the reason', () => {
  // render BodyCard with day { phase: 'general', expected: false, reason: { kind: 'wide', width: 14, n: 36, min: 24, max: 38 } }
  // full: text starts with the wide sentence and contains "These notes hold for any day of the cycle."
  // compact: shows the wide sentence's first sentence
});
```
Write the second test concretely using the file's existing render helpers.

- [ ] **Step 3: Run** `npx vitest run apps/mobile/src/features/guidance/sections/sections.test.tsx` — expected FAIL.

- [ ] **Step 4: Implement** `generalReasonText` and use it in `BodyCard`: when `day.phase === 'general'` and the reason text exists, body = `${reasonText} ${t('guidance.general.anyDay')}`; compact shows `firstSentence(reasonText)`. `paused` uses `pausingStateKey(lifeStates)` → `t(key)` as `state`, else `pausedUnnamed`. Lower-case nothing (labels are shown as written).

- [ ] **Step 5: Run** the sections test, `npx vitest run copy apps/mobile/src/features/teen` and `npx vitest related apps/mobile/src/features/guidance/sections/GuidanceSections.tsx` — expected PASS.

- [ ] **Step 6: Commit** the three files plus the test, message `P8-43 The guidance card says why a day isn't placed in a phase (D-162)`.

### Task 3: re-score the accuracy ledger when the engine changes; docs

**Files:**
- Modify: `apps/mobile/src/data/ledger.ts:26-45`, `docs/DECISIONS.md` (D-162), `docs/BACKLOG.md` (P8-43 after P8-42), `docs/regulatory/requirements.md` (ER-62 placement + reasons, ER-63 ledger)
- Test: `apps/mobile/src/data/ledger.test.ts`

**Interfaces:**
- Consumes: `updateLedger(tx, p, engineVersion)` as today.

- [ ] **Step 1: Change the test** "is stable: rebuilding does not rewrite existing rows" into two:
```ts
it('is stable: rebuilding with the same engine does not rewrite existing rows', async () => {
  for (const d of REGULAR) await start(d);
  await db.run("UPDATE prediction_score SET abs_error = 99 WHERE cycle_id = 'cyc-2026-06-01'");
  await store.rebuild();
  expect((await scores())[0]?.abs_error).toBe(99);
});
it('a row scored by an older engine version is re-scored by the running one, still without hindsight', async () => {
  for (const d of REGULAR) await start(d);
  const before = await scores();
  await db.run("UPDATE prediction_score SET engine_version = '0.0.1', abs_error = 99 WHERE cycle_id = 'cyc-2026-06-01'");
  await store.rebuild();
  const row = (await scores())[0];
  expect(row?.engine_version).toBe(ENGINE_VERSION);
  expect(row?.abs_error).toBe(before[0]?.abs_error);
});
```
- [ ] **Step 2: Run** `npx vitest run apps/mobile/src/data/ledger.test.ts` — expected FAIL on the second.
- [ ] **Step 3: Implement**: read `engine_version` with `actual_day` into `existing`; skip a row only when both `actual_day` and `engine_version === engineVersion` match.
- [ ] **Step 4: Run** the ledger test and `npx vitest related apps/mobile/src/data/ledger.ts` — expected PASS.
- [ ] **Step 5: Docs**: D-162 records the placement rule (owner addendum and the rejected alternative: keep whole-cycle general), the reasons and their copy, and the ledger change (rejected: keep "what was shown then", see the handoff note). ER-62/ER-63 rows in `requirements.md` with their tests; P8-43 in `BACKLOG.md`.
- [ ] **Step 6: Commit** ledger, test and docs, message `P8-43 The accuracy count is scored by the running engine; D-162 (D-162)`.

### Verification (after all tasks)
- `npx vitest run`, `pnpm -s typecheck`, `npx biome lint <changed files>`.
- iOS simulator only, with the shared lock (`mkdir /tmp/sanguine-sim.lock`), no Maestro: import a synthetic Sanguine JSON with irregular cycles (lengths 24–38) through Settings → Import, open Today and the day sheet via `simctl openurl` deep links, check a follicular day, a day inside the range (reason sentence), and the luteal side; 150% font scale; screenshots to `docs/screenshots/P8-43/`. Remove the lock and shut the simulator down after.
