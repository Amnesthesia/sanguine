# Calendar: food and movement summary card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Calendar tab, show a separate card directly below the selected-day card, with a brief summary of the food and movement notes for that day. Tapping the card opens the day screen, which already shows the full notes with reasons, evidence grades and sources. Today the user has to tap the day card to find the notes at all.

**Architecture:** One new presentational component, `GuidanceSummary`, and twelve new short copy strings (`guidance.summary.<phase>.{food,move}` for six phases) plus `guidance.readMore`. `calendar.tsx` already has the selected date, the prediction and the cycle history, so it computes the phase for the selected day with the existing `phaseOn()` and renders the card after the day card and its future-day note. Nothing else changes: the day screen, `GuidanceCard`, `phaseOn` and the engine are not touched.

**Tech Stack:** TypeScript, React Native (Expo SDK 57), i18next, vitest with @testing-library/react, Maestro (iOS simulator only).

**Spec:** The owner's request of 2026-10-14: "You have to click on the day card to see the info. I would prefer these things in a separate card below the day card, with a brief summary that you can click to read more."

## Global Constraints

- Do not change `packages/engine`, `guidance.ts`, `GuidanceCard.tsx`, `today.tsx` or `day/[date].tsx`.
- The card is hidden when `prefs.cycleGuidance` is false (the existing Settings > Tracking switch), and when `phaseOn` returns `undefined` (prediction suspended, before the first logged period, a future day past the forecast, a life-state cycle). Same rules as the day screen, because it uses the same call with the same inputs.
- The summary contains no supplement (supplements are hidden for under-18s, and a summary stays brief). It names no fertility word, because teen mode can reach it. `copy/copy.test.ts` forbidden words apply, and the `guidance` word guard in `guidance.test.ts` (no calorie, weight, fasting, cleanse, restriction, cure) applies to the new strings because it scans the whole `guidance` object.
- Every interactive element has an `accessibilityLabel` and a `testID`. Check the card at 150% font scale later (the owner runs it).
- Add no dependency.
- Testing order follows CLAUDE.md "Working unattended": related vitest plus type-check only. Do not run Maestro or boot a simulator in this task. Do not run any git command that writes.
- Backlog id **P8-18** (a follow-up to the same item). Decision id **D-109**: check `grep -o "D-1[0-9][0-9]" docs/DECISIONS.md | sort -u | tail -1` first. If it prints something above `D-108`, use the next free id everywhere.

## File Structure

| File | Responsibility |
| --- | --- |
| `copy/en-AU.json` (modify) | `guidance.summary.*`, `guidance.readMore` |
| `apps/mobile/src/features/guidance/GuidanceSummary.tsx` (create) | The summary card |
| `apps/mobile/src/features/guidance/GuidanceSummary.test.tsx` (create) | Component test |
| `apps/mobile/src/features/guidance/guidance.test.ts` (modify) | Copy test for the summaries |
| `apps/mobile/src/app/(tabs)/calendar.tsx` (modify) | Compute the phase for the selected day, render the card |
| `apps/mobile/.maestro/calendar-guidance.yaml` (create), `apps/mobile/.maestro/suite.sh` (modify) | On-device flow |
| `docs/DECISIONS.md`, `docs/i18n/strings-for-translation.csv` (modify) | Records |

---

## Task 1: Copy for the summaries

**Files:**
- Modify: `copy/en-AU.json` (inside the existing top-level `"guidance"` object)
- Test: `apps/mobile/src/features/guidance/guidance.test.ts` (append)

**Interfaces:**
- Produces: the copy keys `guidance.readMore` and `guidance.summary.<phase>.food` and `.move` for the six phases `menstrual`, `follicular`, `ovulatory`, `luteal`, `premenstrual`, `general`.

- [ ] **Step 1: Write the failing test.** Append this block to `guidance.test.ts`. The file already imports `en`, `GUIDE_PHASES` and defines `get` and `allStrings`. Do not add imports.

```ts
describe('guidance summaries (calendar card)', () => {
  it('every phase has a brief food line and a brief movement line, and the card says "Read more"', () => {
    for (const ph of GUIDE_PHASES) {
      for (const k of ['food', 'move']) {
        const s = get(`guidance.summary.${ph}.${k}`) as string;
        expect(s, `${ph}.${k}`).toMatch(/\S/);
        expect(s.length, `${ph}.${k}`).toBeLessThanOrEqual(110);
      }
    }
    expect(get('guidance.readMore')).toBe('Read more');
  });
});
```

- [ ] **Step 2: Run it and check that it fails.**

Run: `pnpm vitest run apps/mobile/src/features/guidance/guidance.test.ts`
Expected: FAIL (`guidance.summary.menstrual.food` is undefined).

- [ ] **Step 3: Add the copy.** Inside the existing `"guidance": { ... }` object in `copy/en-AU.json`, add these two entries. Put them after the `"more"` and `"moreA11y"` keys. Use these strings word for word.

```json
  "readMore": "Read more",
  "summary": {
    "menstrual": {
      "food": "Iron-rich foods with vitamin C, such as lentil dahl with a squeeze of lemon.",
      "move": "Any movement that feels good can lift your mood and energy. Rest is fine too."
    },
    "follicular": {
      "food": "Vitamin C, B vitamins and zinc, such as muesli with kiwifruit and yoghurt.",
      "move": "Exercise lifts mood and energy. Try harder sessions if you feel up to them."
    },
    "ovulatory": {
      "food": "Fibre-rich foods, such as overnight oats with berries.",
      "move": "Train as usual, and warm up well before jumping and quick turns."
    },
    "luteal": {
      "food": "Protein, magnesium and B12, such as eggs on toast or a handful of almonds.",
      "move": "Keep moving: exercise lifts mood. Drink regularly in warm weather."
    },
    "premenstrual": {
      "food": "Calcium-rich foods, such as yoghurt with fruit or a cheese and salad sandwich.",
      "move": "A walk, a swim or yoga can lift low mood or energy."
    },
    "general": {
      "food": "Iron and calcium: a lentil salad, or yoghurt with fruit.",
      "move": "Regular activity lifts mood and energy. Even a short walk helps."
    }
  },
```

Keep the file valid JSON (commas between entries) and its 2-space formatting. Change nothing else in it.

- [ ] **Step 4: Run the tests and check that they pass.**

Run: `pnpm vitest run apps/mobile/src/features/guidance apps/mobile/src/features/teen copy/copy.test.ts`
Expected: PASS. The teen audit and the word guard scan the new strings too. If one reports a forbidden word, reword that string and keep its meaning. Never add an exemption.

---

## Task 2: `GuidanceSummary` component

**Files:**
- Create: `apps/mobile/src/features/guidance/GuidanceSummary.tsx`
- Test: `apps/mobile/src/features/guidance/GuidanceSummary.test.tsx`

**Interfaces:**
- Consumes: `GuideDay` from `./guidance`; `Card` from `@/ui/Card`; `Text` from `@/ui/Text`; the copy from Task 1 and the existing `guidance.title`, `guidance.foodLabel`, `guidance.moveLabel`, `guidance.phaseLine`, `guidance.phaseExpected`, `guidance.phase.<phase>`.
- Produces: `export function GuidanceSummary(props: { day: GuideDay; onOpen: () => void }): JSX.Element`. TestIDs: `guidance-summary` (the pressable), `guidance-summary-phase-<phase>`, `guidance-summary-food`, `guidance-summary-move`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/src/features/guidance/GuidanceSummary.test.tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import '@/i18n';
import { GuidanceSummary } from './GuidanceSummary';

afterEach(cleanup);

it('shows the phase, a brief food line and a brief movement line, and opens on press', () => {
  const onOpen = vi.fn();
  render(<GuidanceSummary day={{ phase: 'luteal', expected: false }} onOpen={onOpen} />);
  expect(screen.getByText('Food and movement')).toBeTruthy();
  expect(screen.getByTestId('guidance-summary-phase-luteal').textContent).toBe('Luteal phase · estimate');
  expect(screen.getByTestId('guidance-summary-food').textContent).toBe('Food: Protein, magnesium and B12, such as eggs on toast or a handful of almonds.');
  expect(screen.getByTestId('guidance-summary-move').textContent).toBe('Movement: Keep moving: exercise lifts mood. Drink regularly in warm weather.');
  expect(screen.getByText('Read more')).toBeTruthy();
  fireEvent.click(screen.getByTestId('guidance-summary'));
  expect(onOpen).toHaveBeenCalledTimes(1);
});

it('marks a future day as expected', () => {
  render(<GuidanceSummary day={{ phase: 'menstrual', expected: true }} onOpen={() => {}} />);
  expect(screen.getByTestId('guidance-summary-phase-menstrual').textContent).toBe('Period · expected');
});
```

- [ ] **Step 2: Run it and check that it fails.**

Run: `pnpm vitest run apps/mobile/src/features/guidance/GuidanceSummary.test.tsx`
Expected: FAIL with "Failed to resolve import './GuidanceSummary'".

- [ ] **Step 3: Write the component**

```tsx
// apps/mobile/src/features/guidance/GuidanceSummary.tsx
// Calendar: a brief summary of the selected day's food and movement notes, in its own card below the day card (owner, 2026-10-14).
// Tapping it opens the day screen, which has the full notes with reasons, evidence grades and sources.
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import type { GuideDay } from './guidance';

export function GuidanceSummary({ day, onOpen }: { day: GuideDay; onOpen: () => void }) {
  const { t } = useTranslation();
  const p = day.phase;
  const phase = t(day.expected ? 'guidance.phaseExpected' : 'guidance.phaseLine', { phase: t(`guidance.phase.${p}`) });
  const food = `${t('guidance.foodLabel')}: ${t(`guidance.summary.${p}.food`)}`;
  const move = `${t('guidance.moveLabel')}: ${t(`guidance.summary.${p}.move`)}`;
  return (
    <Pressable testID="guidance-summary" accessibilityRole="button" accessibilityLabel={[t('guidance.title'), phase, food, move, t('guidance.readMore')].join('. ')} onPress={onOpen} style={{ minHeight: 56 }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="heading" accessibilityRole="header">{t('guidance.title')}</Text>
          <Text variant="caption" color="textSecondary" testID={`guidance-summary-phase-${p}`}>{phase}</Text>
          <Text variant="bodySmall" testID="guidance-summary-food">{food}</Text>
          <Text variant="bodySmall" testID="guidance-summary-move">{move}</Text>
          <Text variant="caption" color="accent">{t('guidance.readMore')}</Text>
        </View>
        <Text color="textSecondary" accessibilityElementsHidden>›</Text>
      </Card>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run the tests and the type-check, and check that they pass.**

Run: `pnpm vitest run apps/mobile/src/features/guidance && pnpm --filter @sanguine/mobile typecheck`
Expected: PASS and no type errors. If `fireEvent.click` does not call `onOpen`, look at how `apps/mobile/src/ui/components.test.tsx` fires presses on a `Pressable` and do the same. Do not weaken the assertions.

---

## Task 3: Calendar wiring

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/calendar.tsx`

**Interfaces:**
- Consumes: `phaseOn` from `@/features/guidance/guidance` (signature `phaseOn({ date, today, prediction, cycles, showEstimate }): GuideDay | undefined`); `GuidanceSummary` (Task 2).

- [ ] **Step 1: Add the imports.** After the existing line `import { FlagCard } from '@/features/today/cards';` add:

```ts
import { GuidanceSummary } from '@/features/guidance/GuidanceSummary';
import { phaseOn } from '@/features/guidance/guidance';
```

- [ ] **Step 2: Compute the analysed records once.** The existing `lunar` memo calls `analyzeCycles(history, settings).map((c) => c.record)` inline. Replace the `lunar` memo with a `records` memo plus a `lunar` memo that uses it:

```ts
  const records = useMemo(() => (history && settings ? analyzeCycles(history, settings).map((c) => c.record) : []), [history, settings]);
  const lunar = useMemo(() => lunarAligned(records), [records]);
```

  Keep the comment line above it (`// moon phases (D-089): ...`). Before the change, `lunar` was `false` when `history` or `settings` was missing. Now `lunarAligned([])` runs. Check `lunarAligned` returns `false` for an empty list in `apps/mobile/src/features/calendar/moon.ts`, and add `&& records.length > 0` to the `lunar` memo only if it does not.

- [ ] **Step 2b: Compute the phase for the selected day.** After the `estimateLines` line (`const estimateLines = ...`), add:

```ts
  // food and movement notes for the selected day (P8-18): same call and inputs as the day screen, so both show the same phase
  const guide = useMemo(
    () => (prefs.cycleGuidance ? phaseOn({ date: selected, today, prediction, cycles: records, showEstimate }) : undefined),
    [prefs.cycleGuidance, selected, today, prediction, records, showEstimate],
  );
```

- [ ] **Step 3: Render the card.** After the existing future-day note line

```tsx
      {isFuture ? <Text variant="caption" color="textSecondary" testID="cal-future-note">{tr('calendar.futureNote')}</Text> : null}
```

  add:

```tsx
      {guide ? <GuidanceSummary day={guide} onOpen={() => router.push({ pathname: '/day/[date]', params: { date: selected } })} /> : null}
```

- [ ] **Step 4: Type-check and run the related tests.**

Run: `pnpm --filter @sanguine/mobile typecheck && pnpm vitest run apps/mobile/src/features/calendar apps/mobile/src/features/guidance`
Expected: PASS.

---

## Task 4: Maestro flow (written now, run by the owner's session later)

**Files:**
- Create: `apps/mobile/.maestro/calendar-guidance.yaml`
- Modify: `apps/mobile/.maestro/suite.sh`

- [ ] **Step 1: Create the flow.**

```yaml
appId: ${APP_ID}
name: Calendar - food and movement summary card below the day card (P8-18)
---
- runFlow:
    file: _open.yaml
    env:
      LINK: ${LINKBASE}dev/seed?scenario=typical
- extendedWaitUntil:
    visible:
      id: screen-today
    timeout: 90000
- tapOn: Calendar
- extendedWaitUntil:
    visible:
      id: screen-calendar
    timeout: 10000
# today is cycle day 11 (follicular): the card sits below the day card and gives a brief summary
- scrollUntilVisible:
    element:
      id: guidance-summary
    centerElement: true
# the card is one accessible button on iOS, so Maestro reads its label: title, phase, food, movement, "Read more"
- assertVisible: "Food and movement\\. Follicular phase · estimate\\. Food: .*\\. Movement: .*\\. Read more"
- takeScreenshot: calendar-guidance-summary
# the summary is brief: the long notes and the sources are on the day screen only
- assertNotVisible: "Sources: .*"
# tapping the card opens the day screen with the full notes
- tapOn:
    id: guidance-summary
- extendedWaitUntil:
    visible:
      id: screen-day
    timeout: 10000
- scrollUntilVisible:
    element:
      id: guidance-card
    centerElement: true
- assertVisible:
    id: guidance-card
- takeScreenshot: calendar-guidance-day-screen
```

- [ ] **Step 2: Add it to the suite.** In `apps/mobile/.maestro/suite.sh`, change the line `flows=(shell onboarding onboarding-agegate today splash logging calendar insights ...)` so `calendar-guidance` follows `calendar`:

```bash
flows=(shell onboarding onboarding-agegate today splash logging calendar calendar-guidance insights settings backup discretion delete notifications)
```

  Change nothing else in that file. Do NOT run the flow: no simulator in this task.

---

## Task 5: Records and the final checks

**Files:** `docs/DECISIONS.md`, `docs/i18n/strings-for-translation.csv`

- [ ] **Step 1: Append the decision to `docs/DECISIONS.md`**, after the last `D-1xx` line, using the id from "Global Constraints":

> - D-109 (2026-10-14) Calendar: a separate food and movement summary card below the selected-day card (P8-18, owner request: the notes were only reachable by tapping the day card through to the day screen). The card shows the phase for the selected day (same `phaseOn` call and inputs as the day screen), one brief food line and one brief movement line per phase (`guidance.summary.*`, at most 110 characters each), and "Read more"; tapping it opens the day screen, which still holds the full notes, reasons, evidence grades, supplements and sources. It follows the same rules as the day card's notes: hidden when the Settings > Tracking switch is off, while prediction is suspended and for days `phaseOn` leaves out; it never lists supplements, and its copy sits under the teen-mode and word-guard tests. The Today screen is unchanged (it already shows the full card). Rejected: expanding the card in place (the day screen already holds the long form, and a second long layout would drift from it), and putting the summary inside the day card (the day card is one tappable target for the day detail).

- [ ] **Step 2: Refresh the translation sheet.**

Run: `pnpm i18n:extract`
Expected: `docs/i18n/strings-for-translation.csv` gains the `guidance.summary.*` and `guidance.readMore` rows. If the pnpm script fails, run `pnpm exec tsx tools/ci/i18n.ts extract`.

- [ ] **Step 3: Run the checks once.**

Run: `pnpm vitest run apps/mobile/src/features copy && pnpm typecheck && pnpm exec biome lint apps/mobile/src/features/guidance "apps/mobile/src/app/(tabs)/calendar.tsx"`
Expected: all pass. Lint may report warnings for non-null assertions in existing test files; those are fine.

## Self-review checklist (done by the author)

- Spec coverage: separate card below the day card (Task 3), brief summary (Tasks 1 and 2), click to read more (Task 2 `onOpen`, Task 3 route to the day screen). The day screen's full notes already exist.
- Types: `GuideDay`, `phaseOn` and the testIDs are used with the same names in every task.
- No placeholders.
