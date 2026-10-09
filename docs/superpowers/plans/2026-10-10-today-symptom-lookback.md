# Today symptom look-back note — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One quiet card on Today that tells the user which symptoms *she logged* around this cycle day in her own past cycles. For example: "In 3 of your last 4 cycles you logged cramps around this day."

**Architecture:** A pure view-model `symptomNote(cycles, logs, dayOfCycle)` in `apps/mobile/src/features/today/symptomNote.ts`. It reads only closed valid cycles and the user's daily logs, and it never touches `packages/engine`. Today renders the lines in one `Card` under the headline when the new `symptomNote` preference is on and the Today state is `predicted` or `inProgress`. The card wording reports the past and never forecasts.

**Tech Stack:** TypeScript, React Native (Expo SDK 57, Expo Go), i18next, vitest, Maestro (iOS simulator only).

**Spec:** Owner approval in conversation on 2026-10-10. The owner chose look-back wording ("In your last 4 cycles you logged cramps…") and rejected "You may feel…". This change amends C-10 (PLAN.md §11.1 line 998; DECISIONS.md line 45) from "per-user patterns in Insights only" to "per-user patterns in Insights, and one look-back note on Today".

## Global Constraints

- `packages/engine` is not changed. `predict` never reads symptoms (ER-03, RK-06 stay true by construction).
- The copy reports the past. Do not use "may feel", "will", "expect", "likely", "predict" or "forecast" in the note strings.
- All copy goes in `copy/en-AU.json` and passes the forbidden-word test (`copy/copy.test.ts`). Do not use "should", "normal", "risk", "diagnosis" or "safe".
- Expo Go only. Add no new dependency.
- Use the conservative defaults below. Each one sits behind one constant at the top of `symptomNote.ts`:
  - `LOOKBACK = 6` closed cycles.
  - `MIN_CYCLES = 3`.
  - `MIN_HITS = 3`.
  - `MIN_SHARE = 0.5`.
  - `WINDOW = 1` (cycle day ±1).
  - `MAX_LINES = 2`.
  - `NOTE_SYMPTOMS` allow-list of physical, non-intimate codes only.
- Excluded from `NOTE_SYMPTOMS`, and this is a reviewed decision:
  - All mood and emotion codes.
  - `low_libido` and `high_libido`.
  - `diarrhoea` and `constipation`.
  - `midcycle_spotting` and `mid_cycle_pain` (fertility-adjacent, and kept away from teen mode).
  - `hot_flushes` and `night_sweats` (the P8-4 perimenopause view covers them).
- Teen mode needs no extra gate, because the allow-list holds no fertility-adjacent code. A test pins this.
- Accessibility: the card has `accessibilityRole="summary"` and a `testID`. Check it at 150% font scale.
- Testing order follows CLAUDE.md "Working unattended": related vitest plus type-check per task, the Today Maestro flow on iOS only, then the full suite, lint and soup once before the final commit.
- Commit messages reference **P8-11** and the decision id claimed in Task 0.

## Review Focus

1. **Late or very long current cycle** (today is past every past cycle's length). Expect no note, because past cycles never reached this day. Pinned in Task 1 ("no hits beyond the cycle's own length").
2. **Gaps in logging**: a past cycle with no logs at all counts as a non-hit, not as an excluded cycle. "3 of your last 4" must never overstate. Pinned in Task 1 ("unlogged cycle counts in the denominator").
3. **Excluded or suspect cycles** (`suspect_skip`, `user_excluded`, life-state cycles) and the open current cycle. Never count them. Pinned in Task 1.
4. **Suspended prediction** (pregnant, hormonal contraception) or state `late`/`empty`. Expect no card. Pinned in Task 2 with the `noteDay` helper test.
5. **Excluded symptom codes logged every cycle** (mood_low, libido). Never show them. Pinned in Task 1, and on device in Task 3 (scenario logs `mood_low` in every cycle, and the flow asserts it is absent).

---

## Task 0: Coordinate with peer sessions

A peer session holds uncommitted edits to these files (P8-3, P8-4, P8-5):

- `apps/mobile/src/app/(tabs)/today.tsx`
- `copy/en-AU.json`
- `apps/mobile/src/features/dev/scenarios.ts`
- `apps/mobile/src/features/teen/teenAudit.test.ts`
- `docs/i18n/strings-for-translation.csv`

That peer has claimed D-081.

- [ ] **Step 1:** Run `git reset -q && git status --short` and `ListAgents`.
- [ ] **Step 2:** Message the peer. Claim the next free decision id (expected D-087) and backlog id P8-11. Ask the peer to commit P8-3/4/5, or hand over ownership of `today.tsx`, `en-AU.json` and `scenarios.ts`. Wait for the commit. Do not edit these files while the peer has them dirty.
- [ ] **Step 3:** Task 1 touches only new files, so it can start before the peer commits.

---

## Task 1: `symptomNote` view-model

**Files:**
- Create: `apps/mobile/src/features/today/symptomNote.ts`
- Test: `apps/mobile/src/features/today/symptomNote.test.ts`

**Interfaces:**
- Consumes: `CycleRecord`, `DailyLog`, `addDays`, `ISODate` from `@sanguine/engine`.
- Produces:
  - `export interface NoteLine { code: string; hits: number; cycles: number }`
  - `export function symptomNote(cycles: CycleRecord[], logs: DailyLog[], dayOfCycle: number | undefined): NoteLine[]`
  - `export const NOTE_SYMPTOMS: ReadonlySet<string>`

- [ ] **Step 1: Write the failing tests**

```ts
import { addDays, type CycleRecord, type DailyLog, type ISODate } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import symptomCatalog from '../../../../../copy/symptoms.json';
import { NOTE_SYMPTOMS, symptomNote } from './symptomNote';

// closed cycles oldest first, each `len` days, starting from `first`
function cycles(first: ISODate, lens: number[], quality: CycleRecord['quality'] = 'valid'): CycleRecord[] {
  let s = first;
  return lens.map((len, i) => {
    const c = { id: `c${i}`, start: s, nextStart: addDays(s, len), length: len, quality } as CycleRecord;
    s = addDays(s, len);
    return c;
  });
}
const log = (date: ISODate, ...codes: string[]): DailyLog => ({ date, symptoms: codes.map((code) => ({ code, intensity: 2 as const })) }) as DailyLog;
const at = (c: CycleRecord, day: number) => addDays(c.start, day - 1);

describe('symptomNote', () => {
  const cs = cycles('2026-05-01', [28, 28, 28, 28]);

  it('reports a symptom logged around this cycle day in 3 of the last 4 cycles', () => {
    const logs = [log(at(cs[0]!, 2), 'cramps'), log(at(cs[1]!, 1), 'cramps'), log(at(cs[2]!, 3), 'cramps')];
    expect(symptomNote(cs, logs, 2)).toEqual([{ code: 'cramps', hits: 3, cycles: 4 }]);
  });

  it('counts a cycle once even when the symptom is logged on every day of the window', () => {
    const logs = [1, 2, 3].flatMap((d) => cs.slice(0, 3).map((c) => log(at(c, d), 'cramps')));
    expect(symptomNote(cs, logs, 2)).toEqual([{ code: 'cramps', hits: 3, cycles: 4 }]);
  });

  it('unlogged cycle counts in the denominator', () => {
    const six = cycles('2026-01-01', [28, 28, 28, 28, 28, 28]);
    const logs = six.slice(0, 3).map((c) => log(at(c, 10), 'headache'));
    expect(symptomNote(six, logs, 10)).toEqual([{ code: 'headache', hits: 3, cycles: 6 }]);
  });

  it('is empty below 3 hits, below half the cycles, or with fewer than 3 closed cycles', () => {
    expect(symptomNote(cs, cs.slice(0, 2).map((c) => log(at(c, 5), 'acne')), 5)).toEqual([]);
    const seven = cycles('2026-01-01', [28, 28, 28, 28, 28, 28, 28]); // looks back at 6 only
    expect(symptomNote(seven, seven.slice(-6, -3).map((c) => log(at(c, 5), 'acne')), 5)).toEqual([{ code: 'acne', hits: 3, cycles: 6 }]);
    expect(symptomNote(seven, seven.slice(-6, -4).map((c) => log(at(c, 5), 'acne')), 5)).toEqual([]);
    const two = cycles('2026-05-01', [28, 28]);
    expect(symptomNote(two, two.map((c) => log(at(c, 2), 'cramps')), 2)).toEqual([]);
  });

  it('only looks at the last 6 closed cycles', () => {
    const eight = cycles('2025-11-01', [28, 28, 28, 28, 28, 28, 28, 28]);
    const logs = eight.slice(0, 3).map((c) => log(at(c, 4), 'fatigue')); // the oldest three only
    expect(symptomNote(eight, logs, 4)).toEqual([]);
  });

  it('no hits beyond the cycle\'s own length (a late cycle shows nothing)', () => {
    const logs = cs.map((c) => log(addDays(c.nextStart as ISODate, 1), 'bloating')); // day 2 of the *next* cycle
    expect(symptomNote(cs, logs, 30)).toEqual([]);
  });

  it('never counts suspect, excluded or open cycles', () => {
    const bad = [...cycles('2026-01-01', [28, 28, 28], 'suspect_skip'), { id: 'open', start: '2026-03-26', quality: 'valid' } as CycleRecord];
    const logs = bad.map((c) => log(at(c, 2), 'cramps'));
    expect(symptomNote(bad, logs, 2)).toEqual([]);
  });

  it('never shows a code outside the allow-list, however often it is logged', () => {
    const logs = cs.map((c) => log(at(c, 2), 'mood_low', 'low_libido', 'diarrhoea', 'midcycle_spotting', 'mid_cycle_pain'));
    expect(symptomNote(cs, logs, 2)).toEqual([]);
  });

  it('shows at most 2 lines, most frequent first, ties by code', () => {
    const logs = cs.map((c, i) => log(at(c, 2), 'headache', 'cramps', 'acne', ...(i < 3 ? [] : ['fatigue'])));
    expect(symptomNote(cs, logs, 2).map((l) => l.code)).toEqual(['acne', 'cramps']);
  });

  it('is empty without a day of cycle', () => {
    expect(symptomNote(cs, cs.map((c) => log(at(c, 2), 'cramps')), undefined)).toEqual([]);
  });

  it('allow-list holds only catalogued, non-fertility codes (teen mode needs no extra gate)', () => {
    const known = new Set(symptomCatalog.symptoms.map((s) => s.code));
    for (const c of NOTE_SYMPTOMS) expect(known.has(c)).toBe(true);
    for (const c of ['midcycle_spotting', 'mid_cycle_pain', 'low_libido', 'high_libido']) expect(NOTE_SYMPTOMS.has(c)).toBe(false);
  });
});
```

Before running, check that the relative import path for `copy/symptoms.json` matches how `apps/mobile/src/data/prefs.ts` imports `symptomCatalog`, and use the same specifier.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run apps/mobile/src/features/today/symptomNote.test.ts`
Expected: FAIL, "Cannot find module './symptomNote'".

- [ ] **Step 3: Implement**

```ts
// Look-back note on Today (P8-11, D-087, amends C-10): which of the user's own symptoms she logged around this cycle day in her
// past cycles. Reads closed valid cycles and daily logs only; never feeds the engine and never forecasts.
import { addDays, type CycleRecord, type DailyLog, type ISODate } from '@sanguine/engine';

/** Physical, non-intimate codes only (D-087): no mood, libido, bowel, bleeding or mid-cycle codes on a screen others may glance at. */
export const NOTE_SYMPTOMS: ReadonlySet<string> = new Set([
  'cramps', 'headache', 'bloating', 'breast_tenderness', 'acne', 'fatigue', 'back_pain', 'joint_pain', 'pelvic_pain',
  'nausea', 'dizziness', 'insomnia', 'food_cravings', 'appetite_increase', 'oily_skin', 'puffiness', 'smell_sensitivity',
]);
const LOOKBACK = 6; // closed cycles looked at
const MIN_CYCLES = 3;
const MIN_HITS = 3;
const MIN_SHARE = 0.5;
const WINDOW = 1; // cycle day ±1
const MAX_LINES = 2;

export interface NoteLine { code: string; hits: number; cycles: number }

// ponytail: aligned by cycle day from the start; luteal symptoms in irregular cycles drift. Upgrade path: align closed cycles by
// days before nextStart when today sits inside the next-period interval.
export function symptomNote(cycles: CycleRecord[], logs: DailyLog[], dayOfCycle: number | undefined): NoteLine[] {
  if (dayOfCycle === undefined) return [];
  const past = cycles
    .filter((c) => c.quality === 'valid' && c.length !== undefined && c.nextStart !== undefined)
    .sort((a, b) => (a.start < b.start ? -1 : 1))
    .slice(-LOOKBACK);
  if (past.length < MIN_CYCLES) return [];
  const byDay = new Map<ISODate, string[]>();
  for (const l of logs) {
    const codes = (l.symptoms ?? []).map((s) => s.code).filter((c) => NOTE_SYMPTOMS.has(c));
    if (codes.length) byDay.set(l.date, [...(byDay.get(l.date) ?? []), ...codes]);
  }
  const hits = new Map<string, number>();
  for (const c of past) {
    const seen = new Set<string>();
    for (let d = Math.max(1, dayOfCycle - WINDOW); d <= Math.min(c.length as number, dayOfCycle + WINDOW); d++)
      for (const code of byDay.get(addDays(c.start, d - 1)) ?? []) seen.add(code);
    for (const code of seen) hits.set(code, (hits.get(code) ?? 0) + 1);
  }
  return [...hits]
    .filter(([, h]) => h >= MIN_HITS && h / past.length >= MIN_SHARE)
    .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1))
    .slice(0, MAX_LINES)
    .map(([code, h]) => ({ code, hits: h, cycles: past.length }));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run apps/mobile/src/features/today/symptomNote.test.ts && pnpm typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

Commit your own paths only, using a temp index if the peer is still dirty.

```bash
git add apps/mobile/src/features/today/symptomNote.ts apps/mobile/src/features/today/symptomNote.test.ts
git commit -m "P8-11 symptomNote view-model: look-back symptom lines from the user's own closed cycles (D-087)"
```

---

## Task 2: Preference, Tracking switch, copy, Today card

Start this task only after Task 0 Step 2 settles who owns `today.tsx` and `en-AU.json`.

**Files:**
- Modify: `apps/mobile/src/data/prefs.ts`. Add `symptomNote: boolean` to `Prefs`, after `showOvulationEstimate`, and `symptomNote: true` to `DEFAULT_PREFS`. `loadPrefs` already spreads saved prefs over `DEFAULT_PREFS`, so existing users get the default.
- Modify: `apps/mobile/src/app/settings/tracking.tsx`. Add a switch in the second `Group`.
- Modify: `apps/mobile/src/features/today/symptomNote.ts`. Add `noteDay`.
- Modify: `apps/mobile/src/features/today/symptomNote.test.ts`. Add `noteDay` tests.
- Modify: `apps/mobile/src/app/(tabs)/today.tsx`. Render the card.
- Modify: `copy/en-AU.json`. Add the `today.symptomNote` and `settings.tracking.symptomNote*` keys.
- Modify: `docs/i18n/strings-for-translation.csv` through `pnpm i18n:extract`.

**Interfaces:**
- Consumes: `symptomNote`, `NoteLine` (Task 1), and `TodayModel['state']` and `TodayModel['dayOfCycle']` from `todayModel.ts`.
- Produces: `export function noteDay(on: boolean, state: TodayModel['state'], dayOfCycle: number | undefined): number | undefined`

- [ ] **Step 1: Write the failing test** (append to `symptomNote.test.ts`)

```ts
import { noteDay } from './symptomNote';

describe('noteDay', () => {
  it('passes the day through only when the preference is on and Today is predicted or in progress', () => {
    expect(noteDay(true, 'predicted', 11)).toBe(11);
    expect(noteDay(true, 'inProgress', 2)).toBe(2);
    for (const s of ['empty', 'suspended', 'late'] as const) expect(noteDay(true, s, 11)).toBeUndefined();
    expect(noteDay(false, 'predicted', 11)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run apps/mobile/src/features/today/symptomNote.test.ts`
Expected: FAIL, "noteDay is not a function".

- [ ] **Step 3: Implement**

Add to `symptomNote.ts`:

```ts
import type { TodayModel } from './todayModel';

/** The note shows only on an ordinary Today: not empty, suspended (pregnant, hormonal) or late, and only if the user leaves it on. */
export const noteDay = (on: boolean, state: TodayModel['state'], dayOfCycle: number | undefined): number | undefined =>
  on && (state === 'predicted' || state === 'inProgress') ? dayOfCycle : undefined;
```

Add to `copy/en-AU.json`. Put this under `today`:

```json
"symptomNote": {
  "line": "In {hits} of your last {cycles} cycles you logged {name} around this day.",
  "caption": "From your own logs. It does not change any estimate."
}
```

Put this under `settings.tracking`:

```json
"symptomNote": "Show what you logged around this day",
"symptomNoteDesc": "On Today, a note of symptoms you logged around the same day in past cycles."
```

In `today.tsx`, import `{ noteDay, symptomNote }` from `@/features/today/symptomNote`. After `model`, add:

```tsx
const note = useMemo(
  () => symptomNote(history?.cycles ?? [], history?.logs ?? [], noteDay(prefs.symptomNote, model.state, model.dayOfCycle)),
  [history, prefs.symptomNote, model.state, model.dayOfCycle],
);
```

Render the card between the pregnancy card and `EstimateCard`:

```tsx
{note.length ? (
  <Card testID="symptom-note" accessibilityRole="summary">
    {/* ponytail: label lower-cased for mid-sentence use; a language where nouns keep capitals needs inline label keys */}
    {note.map((l) => <Text key={l.code} variant="bodySmall" testID={`symptom-note-${l.code}`}>{t('today.symptomNote.line', { hits: l.hits, cycles: l.cycles, name: t(`symptom.${l.code}`).toLocaleLowerCase('en-AU') })}</Text>)}
    <Text variant="caption" color="textSecondary">{t('today.symptomNote.caption')}</Text>
  </Card>
) : null}
```

In `tracking.tsx`, add this as the first row of the second `Group`, above `track-sex`:

```tsx
<SwitchRow testID="track-symptom-note" title={t('settings.tracking.symptomNote')} description={t('settings.tracking.symptomNoteDesc')} value={prefs.symptomNote} onChange={(v) => void updatePrefs({ symptomNote: v })} />
```

Then run `pnpm i18n:extract`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run apps/mobile/src/features/today/symptomNote.test.ts copy/copy.test.ts apps/mobile/src/data && pnpm typecheck`
Expected: all pass. The forbidden-word test covers the new strings.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/data/prefs.ts apps/mobile/src/app/settings/tracking.tsx apps/mobile/src/features/today/symptomNote.ts apps/mobile/src/features/today/symptomNote.test.ts "apps/mobile/src/app/(tabs)/today.tsx" copy/en-AU.json docs/i18n/strings-for-translation.csv
git commit -m "P8-11 Today look-back symptom note and Tracking switch (D-087)"
```

---

## Task 3: Dev scenario, Maestro, screenshots

**Files:**
- Modify: `apps/mobile/src/features/dev/scenarios.ts`. Add the `lookback` scenario.
- Modify: `apps/mobile/src/features/dev/scenarios.test.ts`, if it enumerates `SCENARIOS`. Add `lookback` there.
- Modify: `apps/mobile/.maestro/today.yaml`. Add a `lookback` block, and assert the note is absent in `typical`.
- Create: `docs/screenshots/P8-11/`

- [ ] **Step 1: Add the scenario**

Add `'lookback'` to `ScenarioName` and `SCENARIOS`. Before the `typical` fallthrough, add:

```ts
if (name === 'lookback') {
  // P8-11: day 2 today; cramps around day 2 in 3 of 4 past cycles; mood_low every cycle (excluded code, must not show); headache once
  const starts = startsFrom(addDays(today, -1), [28, 29, 27, 28]);
  const past = starts.slice(0, -1);
  return { profile, events: [
    ...past.flatMap((s) => period(s, 4)), ...period(starts.at(-1) as ISODate, 2),
    ...past.slice(0, 3).map((s): NewEvent => ({ kind: 'symptom', payload: { day: addDays(s, 1), code: 'cramps', intensity: 2 } })),
    ...past.map((s): NewEvent => ({ kind: 'symptom', payload: { day: addDays(s, 1), code: 'mood_low', intensity: 2 } })),
    { kind: 'symptom', payload: { day: addDays(past[0] as ISODate, 1), code: 'headache', intensity: 1 } },
  ] };
}
```

- [ ] **Step 2: Extend `today.yaml`**

In the existing `typical` block, after the `estimate-card` assertion, add:

```yaml
- assertNotVisible:
    id: symptom-note
```

Append:

```yaml
# look-back symptom note (P8-11)
- runFlow:
    file: _open.yaml
    env:
      LINK: ${LINKBASE}dev/seed?scenario=lookback
- extendedWaitUntil:
    visible:
      id: screen-today
    timeout: 90000
- assertVisible:
    id: symptom-note
- assertVisible: "In 3 of your last 4 cycles you logged cramps around this day."
- assertVisible: "From your own logs. It does not change any estimate."
- assertNotVisible: ".*mood low.*"
- assertNotVisible: ".*headache.*"
- waitForAnimationToEnd
- takeScreenshot: lookback
```

- [ ] **Step 3: Run**

Run `npx vitest run apps/mobile/src/features/dev && pnpm typecheck`, then `.maestro/run.sh ios today.yaml`. Use the iOS simulator only. Check first that no peer session is using the simulator or Metro.
Expected: the flow passes.

- [ ] **Step 4: Screenshots and font scale**

Copy the `lookback` capture to `docs/screenshots/P8-11/today-lookback.png`. Run `.maestro/fontscale.sh`, or set 150% by hand. Confirm the card text wraps without clipping and save `today-lookback-150.png`. Take one capture in dark mode as well.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/dev/scenarios.ts apps/mobile/src/features/dev/scenarios.test.ts apps/mobile/.maestro/today.yaml docs/screenshots/P8-11
git commit -m "P8-11 lookback dev scenario, Today flow assertions and screenshots"
```

---

## Task 4: Decision record, plan amendment, regulatory, backlog; full gates

**Files:**
- Modify: `docs/DECISIONS.md`. Add a D-087 entry and amend the C-10 row on line 45.
- Modify: `docs/PLAN.md`. Amend the C-10 row on line 998, the §9.7 Today row on line 736 and the §9.8 Today states row on line 874.
- Modify: `docs/regulatory/risk-register.md`. Add RK-23.
- Modify: `docs/BACKLOG.md`. Add P8-11, ticked, after P8-10.

- [ ] **Step 1: Write the docs**

Add this to `DECISIONS.md`:

> - D-087 (2026-10-10) Today look-back symptom note (P8-11), amends C-10. The owner approved one card on Today that reports the user's own past logs: "In 3 of your last 4 cycles you logged cramps around this day." The forecast wording "You may feel…" was rejected: there is no population evidence (PLAN §3, row 137), and a forecast would be a prediction surface without a range or a confidence grade. The engine is unchanged and ER-03 still holds.
>
> The conservative defaults sit in `apps/mobile/src/features/today/symptomNote.ts`:
> - 6 closed valid cycles looked back.
> - At least 3 cycles, at least 3 hits and at least 50% of the cycles.
> - Cycle day ±1.
> - At most 2 lines.
> - An allow-list of physical, non-intimate codes.
>
> Excluded: mood and emotion codes, libido codes, bowel codes, mid-cycle spotting and mid-cycle pain (fertility-adjacent, and kept away from teen mode), and vasomotor codes (the P8-4 view covers them).
>
> The note shows only in the `predicted` and `inProgress` states, never while a prediction is suspended or late. Settings > Tracking options has a switch for it, on by default. An unlogged past cycle counts against the share.
>
> Rejected alternatives:
> - All symptom codes: discretion on a screen others may glance at.
> - Off by default: the owner asked for the feature, and the content is the user's own physical logs.
> - Phase-aligned matching: today's phase is uncertain whenever ovulation is only a range.

Amend the C-10 rows in both files to read "Zero in predictions; per-user patterns in Insights, and one look-back note on Today (D-087)".

In the PLAN §9.7 Today row, add "; a look-back symptom note when the user's own past cycles show one (D-087)".

Add this risk row:

`| RK-23 | The Today symptom note is read as a forecast or a medical finding | Pattern shown on the main screen | S1 | Past-tense wording only ("you logged"); caption "It does not change any estimate"; thresholds and allow-list in symptomNote.ts; switch in Tracking options; hidden while suspended or late | symptomNote.test.ts; copy forbidden-word test; today.yaml lookback block | open→mitigated P8-11 |`

Match the column count of the existing rows. Read the header before writing the row.

Add this line to BACKLOG:

`- [x] P8-11 Today look-back symptom note: own logs only, past tense, allow-listed physical codes, switchable (D-087; amends C-10).`

- [ ] **Step 2: Full gates, once**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm soup`
Expected: all green. If the deny-list or allow-list job is a separate script under `tools/ci/`, run that as well.

- [ ] **Step 3: Adversarial review**

Before committing, run `mcp__agy-bridge__adversarial_review` on the P8-11 diff. Verify each finding against the cited lines, and fix all of them now. Do not defer any.

- [ ] **Step 4: Commit**

```bash
git add docs/DECISIONS.md docs/PLAN.md docs/regulatory/risk-register.md docs/BACKLOG.md
git commit -m "P8-11 D-087 Today look-back symptom note: decision record, C-10 amendment, RK-23"
```
