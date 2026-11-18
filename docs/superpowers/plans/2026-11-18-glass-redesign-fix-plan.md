# Glass Redesign Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the built app match the approved glass design, fix the frames where the frames are wrong, and move the long explanations out of the calendar sheet and the day screen into a new Insights "This cycle" segment, so that the owner stops finding drift.

**Source:** every task fixes findings from `docs/superpowers/specs/2026-11-18-glass-redesign-verification.md` (ids such as X1, C3, L1 below refer to that report). Screenshots of the drift: `docs/screenshots/P8-23-verify/`.

**Architecture:** First a verification harness (deep-link states plus a frame-versus-simulator screenshot script), so every later task can prove its screen matches its frame without taps or Maestro. Then three foundation tasks with disjoint files (tokens, UI kit, copy) and one design task (frames and specs), then the screen lanes, then one full verification pass.

**Tech Stack:** Expo SDK 57, React Native, expo-router native tabs, `expo-glass-effect`, `@expo/ui`, react-native-svg, zustand, i18next, vitest + React Testing Library, headless Chrome for frames, `xcrun simctl` for the simulator.

**Specs:** `docs/superpowers/specs/2026-11-18-glass-redesign-design.md`, `2026-11-18-glass-design-language.md`, `2026-11-18-calendar-clarity-design.md` (to be corrected by Task 5), frames in `docs/design/glass-redesign/frames/`.

## Global Constraints

- All CLAUDE.md non-negotiables hold: engine pure; symptoms never change a prediction; every estimate a range with a confidence word; never a single highlighted fertile day; fixed §2.3 wording unchanged; teen mode hides fertility language; events append-only.
- No engine change in this plan. If Task 10's past-band rule moves into the engine, that is a separate engine task with fixtures, version bump and regulatory rows.
- No native dependency change (the fixes must ship over the air like P8-23). Task 2's `GlassView` tint is a prop of the installed `expo-glass-effect`; check it against current docs with Context7 first (VERIFY) and record the result in DECISIONS.
- Owner rules for this machine (2026-11-18): one simulator (iPhone 17 Pro Max `1C4C0CE9-4A7A-441F-8FCA-5EDBD373D757`), never the Android emulator, never Maestro in this plan, one heavy process at a time, no parallel test runs. Wrap every simulator use in the lock: `until mkdir /tmp/sanguine-sim.lock 2>/dev/null; do sleep 5; done; trap 'rmdir /tmp/sanguine-sim.lock' EXIT`. Tasks may edit in parallel; simulator verification runs one task at a time.
- Testing order (CLAUDE.md): edits first; then `npx vitest related <changed files>` and the type-check; then the task's harness screens; full unit suite, lint and the deny-list once per lane before its last commit.
- Commits: only your own files, `git commit -- <paths>`, never `git add -A`; message starts with the backlog id; review fixes as `git commit --fixup=<sha>`. Work on a branch off `main` (the checkout is detached at `origin/main`).
- Ids: backlog items P8-24 onward (Task 13 also adds the missing P8-23 item); decisions from D-130 (check the last id in `docs/DECISIONS.md` right before writing; announce it to any peer session).
- Every task saves its harness screenshots (frame | build, light, dark, 150%) to `docs/screenshots/<item-id>/` and reports what it saw and what it could not check. A UI task without screenshots is not done.

## Defect checklist (every implementer checks these before committing)

Collected from the verification report; add a line whenever a review finds a new class.

1. Text under a floating glass surface must not be legible through it (X1). Check with the busiest content scrolled under it.
2. Primary ink: white on the primary fill in both themes, at least 4.5:1 (X2).
3. No fractions or codes in user-facing text ("2/3"), no "calendar" as a method word, one confidence vocabulary (X3, X5, CON1).
4. Superscripts really raised (X4).
5. Every control a pill or a circle; no 12 pt tiles (L1).
6. At 150% text: nothing runs off screen, every ✕ and button reachable, toolbar titles fit one line or shrink (L2, X7).
7. Dark mode: every mark at 3:1 against black (T6, C11).
8. Estimates: 80% stronger than 95%, out-of-month opacity never inverts that, legend names every mark drawn and nothing that is not (C3, C5).
9. Paused states (pregnancy, suspended): no cycle-day numbers, no fertility legend (C5).
10. Props passed as explicit `undefined`, empty and failure states, light theme, screen-reader labels, wide screens.
11. Fixtures: tests build history through `project()`, never hand-made records with derived fields (S7).
12. The frame you match is the one Task 5 corrected; if the build must deviate, update the frame and add a D-entry in the same commit.

## Task graph, lanes and file ownership

```
Wave 0 (now, in parallel; disjoint files)
  T1 verification harness            app/(tabs)/*.tsx param parsing, app/day, tools/verify-screens/**
  T3 tokens: dark primary fill       packages/ui-tokens/**, apps/mobile/src/theme/**
  T4 copy and plain language         copy/*.json, features/logging/describe.ts, copy tests
  T5 frames and specs                docs/design/glass-redesign/**, docs/superpowers/specs/2026-11-18-*.md
  T12 report cycles bug              app/settings/report.tsx, features/report/**
Wave 1 (after T3; T1 must be merged before any simulator verification)
  T2 UI kit fixes                    apps/mobile/src/ui/** (after T3)
Wave 2 (screen lanes, parallel edits, one simulator verification at a time; need T1, T2, T3, T4)
  T6 log sheet                       features/logging/FlowSelector.tsx, SymptomGrid.tsx, LogSheet.tsx
  T7 calendar                        app/(tabs)/calendar.tsx, features/calendar/**
  T8 Today                           app/(tabs)/today.tsx, features/today/**
  T10 settings, onboarding, lock     app/settings/* (except report.tsx), features/onboarding/**, features/lock/**
Wave 3 (needs T5's approved This-cycle frame, and T7 for the sheet's detail slot)
  T9 Insights "This cycle" + slimmer day screen and sheet
                                     app/(tabs)/insights.tsx, features/insights/ThisCycle*.tsx, app/day/[date].tsx,
                                     features/guidance/sections/**, features/calendar/SheetDetail.tsx (new, created by T7 as a stub)
  T11 runtime text-size change       apps/mobile/src/ui/Text.tsx, ui/useFontScale.ts (after T2)
Wave 4
  T13 full verification pass and records (after all)
```

Shared files: `copy/en-AU.json` belongs to T4 only; a screen task that needs a string adds it to T4's list or, after T4 has merged, edits only its own key block. `apps/mobile/src/ui/**` belongs to T2 (and T11 for `Text.tsx`). `app/(tabs)/calendar.tsx` is touched by T1 (parameter parsing only, first) and then owned by T7. Reviews: review T3/T4/T12 while T2 is built; review each screen lane while the next one verifies; one review of the whole branch before the PR. T5 is documentation and gets no separate code review, but it needs the owner's approval of the new frames before T9 starts.

---

### Task 1: Screen-verification harness (P8-24)

Findings: the root cause of the whole drift (verification report "Root cause" 1 and 7).

**Files:**
- Modify: `apps/mobile/src/app/(tabs)/calendar.tsx` (read `?day=YYYY-MM-DD&sheet=closed|small|large`; dev only)
- Modify: `apps/mobile/src/app/(tabs)/insights.tsx` (read `?tab=history|charts|accuracy` and, after T9, `this-cycle`)
- Modify: `apps/mobile/src/app/(tabs)/today.tsx` and `apps/mobile/src/app/day/[date].tsx` (read `?scroll=<anchor>`: scroll a named section to the top on mount; dev only)
- Modify: `apps/mobile/src/features/logging/LogSheet.tsx` only if its existing `section` param does not already scroll (check first)
- Create: `tools/verify-screens/manifest.json` (one row per frame: frame file, seed scenario, theme, deep link, optional `scroll`)
- Create: `tools/verify-screens/run.sh` (takes the simulator lock; for each row: seed, open the link, wait, `xcrun simctl io screenshot`; render the frame with headless Chrome at 390 wide; join the two side by side with `sips`; write to `docs/screenshots/<item-id>/<frame>-<light|dark|150>.png`; restores appearance and text size at exit)
- Test: `apps/mobile/src/features/calendar/calendarScreen.test.tsx` (the `sheet` param opens the given detent; ignored when `__DEV__` is false)

- [ ] **Step 1:** Write the failing test: rendering the calendar route with `{ day: '2026-11-02', sheet: 'large' }` selects 2 Nov and shows `day-sheet-large`; without `__DEV__` the params are ignored.
- [ ] **Step 2:** Implement the params (all behind `__DEV__`, like `app/dev/seed.tsx:17`).
- [ ] **Step 3:** Write `manifest.json` covering every frame listed in the glass redesign spec's screen table (rows whose state needs a tap that the params do not cover are marked `"reachable": false` with the reason).
- [ ] **Step 4:** Write `run.sh`. It must never start Maestro, a second simulator or the Android emulator; it uses Metro on 8090 if it is up and stops if free disk is under 3 GB or swap is nearly full (`sysctl vm.swapusage`).
- [ ] **Step 5:** Run it once for Calendar-1-Closed and Calendar-3-SheetExpanded only, light; check the images; delete any it should not keep.
- [ ] **Step 6:** Add `tools/verify-screens/check-screenshots.sh`: fails when the last commit names a backlog id and touches `apps/mobile/src/app/**` or `apps/mobile/src/features/**/*.tsx` but `docs/screenshots/<id>/` has no PNG. Wire it as a CI step next to the deny-list (or a pre-push hook if CI cannot run it).
- [ ] **Step 7:** `npx vitest related` on the changed files, type-check, commit `P8-24 Verification harness: dev deep links for sheet, tab and scroll states, frame-versus-build screenshots`.

**Verification on the simulator:** the two images from Step 5 show the sheet at the requested detent next to its frame.

---

### Task 2: UI kit fixes (P8-25, D-130 for the glass tint)

Findings: X1, X2 (kit part), X4, X7, X8, L2, S9, I1.

**Files:**
- Modify: `apps/mobile/src/ui/GlassBar.tsx` (`GlassSurface` gains a `legible` variant used by floating surfaces that hold text over scrolling content: a tint over the system glass so text beneath is not readable through it. First check `expo-glass-effect`'s `tintColor` with Context7; if it cannot reach the needed opacity, place a tinted `View` (light `rgba(255,255,255,0.72)`, dark `rgba(28,28,30,0.72)`, values to tune on the simulator) between the material and the content. `GlassBar` title: one line, `adjustsFontSizeToFit` with `minimumFontScale` 0.8, and the side slots shrink to their content.)
- Modify: `apps/mobile/src/ui/Button.tsx:10` (primary ink from the new token `onAccent`, primary fill from `accentFill`, see Task 3)
- Modify: `apps/mobile/src/ui/Sources.tsx:7` (superscript that really rises: a `Text` with smaller size and a negative baseline offset that iOS honours, e.g. `lineHeight` trick or `textAlignVertical`; check on the simulator)
- Modify: `apps/mobile/src/ui/LoggedChip.tsx:10-12` (`maxWidth: '100%'`, label `flexShrink: 1`, wraps to two lines, ✕ always visible)
- Modify: `apps/mobile/src/ui/BackButton.tsx:20` (44 pt round white/glass circle as in the frames)
- Modify: `apps/mobile/src/ui/OptionList.tsx` (selected row filled `accentSoft`, as Settings-LifeState)
- Modify: `apps/mobile/src/ui/Segmented.tsx` (labels follow the text size; check what `@expo/ui` Picker allows)
- Test: `apps/mobile/src/ui/kit.test.tsx`, `chrome.test.tsx`, `components.test.tsx`

- [ ] **Step 1: Failing tests.** `GlassSurface legible` renders a tint layer whose alpha is at least 0.7 in both themes; `Button` primary uses `onAccent` and the pair reaches 4.5:1 in both themes; `LoggedChip` label has `flexShrink: 1` and the chip `maxWidth: '100%'`; `GlassBar` title has `numberOfLines={1}`; `OptionList` selected row background is `accentSoft`.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** `npx vitest related apps/mobile/src/ui/*.tsx`, type-check.
- [ ] **Step 4: Simulator** (harness rows: Today-Typical with `scroll=estimates` so the ovulation card sits under the Log bar; Calendar-1-Closed with the month list under the bar; Log-Sheet-Filled at 150% with a temperature entry; Settings-LifeState; Settings-Notifications; Settings-How). Crop the Log bar at full resolution: no word of the card beneath may be readable. Light, dark and 150%.
- [ ] **Step 5:** DECISIONS D-130: the floating glass gets a legibility tint over the system material; the alternative rejected (plain `regular` glass, which shows text through it, or an opaque bar, which loses the glass the owner asked for). Commit `P8-25 UI kit: legible floating glass, primary ink token, raised source numbers, wrapping chips, round back button`.

---

### Task 3: Tokens for the primary fill and dark marks (P8-25, D-131)

Findings: X2, T6, C11; D-128 (the dial track constant).

**Files:**
- Modify: `packages/ui-tokens/src/tokens.ts` (add `accentFill` and `onAccent`: light `#BC4560` with `#FFFFFF`; dark a darker rose with white ink at 4.5:1 or more, e.g. around `#B5455F` (compute; the frames' Onboarding-Dark Continue is the visual target); add `dialTrack` light `#ECE7E9` / dark `#2A2628` from D-128; add a dark `estimateSwatch` that reaches 3:1 on black)
- Modify: `packages/ui-tokens/src/tokens.test.ts` (contrast assertions for the new pairs)
- Modify: `apps/mobile/src/theme/index.tsx` (expose the tokens)

- [ ] **Step 1:** Failing tests: `contrast(onAccent, accentFill) >= 4.5` in both themes; `contrast(estimateSwatch.dark, '#000000') >= 3`.
- [ ] **Step 2:** Choose values; implement; tests pass.
- [ ] **Step 3:** DECISIONS D-131: dark primary is white ink on a darker rose (the frames' look) instead of black ink on the light rose; alternative rejected: black ink (what shipped, read as "black buttons"). Also closes D-128.
- [ ] **Step 4:** Commit `P8-25 Tokens: primary fill and ink pair, dial track, dark estimate swatch`. Simulator check happens in Task 2, 7, 8 and 10 where the tokens are used.

---

### Task 4: Copy and plain language (P8-26, D-132)

Findings: X3, X5, C4, S4, CON1, D4 (copy part).

**Files:**
- Modify: `copy/en-AU.json` (`day.entry.symptom` "{name} ({level})" with words mild/moderate/strong (line 329); `calendar.legend.predicted` "Period, estimate", `calendar.legend.fertile` "Fertile window, estimate" (353-354); shorten or drop `calendar.legendRule` (360) and `today.legendFertile` (178) per the corrected Calendar-1 frame; `calendarOnly` (1284) to plain words, e.g. "Worked out from your period dates only: no ovulation tests or temperatures this cycle"; the sections' confidence labels (1269 block) to the How vocabulary "Confident / Fair estimate / Rough estimate"; a one-day range sentence without "around" repeated)
- Modify: `copy/about.en-AU.json:3` (band, not underline)
- Modify: `apps/mobile/src/features/logging/describe.ts:14` (pass the intensity word)
- Modify: `docs/i18n/strings-for-translation.csv` (changed keys)
- Test: the existing forbidden-word test over `copy/*.json` (find it with `grep -rl forbidden apps/mobile/src packages`), extended with: no `{n}/3`; "calendar" not used as a method word outside the screen name and settings that name the phone's calendar; only the How vocabulary for confidence.
- Test: `apps/mobile/src/features/logging/describe.test.ts` ("Cramps (mild)").

- [ ] **Step 1:** Failing tests (copy rules, describe).
- [ ] **Step 2:** Edit copy; keep §2.3 fixed wording and the forbidden-word list untouched.
- [ ] **Step 3:** `npx vitest related` on describe.ts and the copy test; type-check.
- [ ] **Step 4:** DECISIONS D-132: one confidence vocabulary (How's words) everywhere; the alternative rejected (two vocabularies). Commit `P8-26 Copy: intensity words, plain method words, one confidence vocabulary, legend and About wording`.

**Verification on the simulator:** in Task 13 (and by each screen task that shows the strings).

---

### Task 5: Frames and specs follow the decisions; frames for undrawn states (P8-27)

Findings: every DESIGN item in the report's "Frames to fix": X1, X2, X5, X9, CON1, CON2, T3, T6, T7, C2, C3, C8, C9, C10, C11, S4, D1.

**Files:**
- Modify: `docs/design/glass-redesign/frames/Today-Typical.html`, `Today-Irregular-Flag.html` (green/neutral pill, plain method words), `Today-Dark.html`, `Onboarding-Dark.html`, `Calendar-Dark.html` (white ink on the darker dark primary, Task 3 values; visible dark estimate swatch and ovulation disc), `Calendar-1-Closed.html` (dark "Today" pill text, legend wording from Task 4), `Calendar-2-SheetOpen.html` (one details control: "Show details" expands; "Open day" only at the large detent), `Calendar-3-SheetExpanded.html` (slimmed per Task 9: estimate lines, compact hormone curve, "More about this cycle ›" to Insights), `Day-Screen.html`, `Day-Screen-Future.html` (slimmed per Task 9), `Insights-History.html` (no "ovulation: calendar"), `Settings-About.html` (band wording), and the tab bar in every frame (the system tab bar's grey selection, since iOS ignores the tint)
- Create: `frames/Calendar-Bar-Compact.html` (the P8-23 closed bar, light and dark, with busy content beneath showing the legibility tint), `frames/Calendar-Drag-States.html` (closed → small → large, a mid-drag frame, the scrim), `frames/Calendar-Past-Bands.html` (a past month with a past fertile band and past ovulation, and the 80% vs 95% next-period rings across a month edge), `frames/Insights-This-Cycle.html` (the new segment, light and dark, one tall frame)
- Modify: `docs/design/glass-redesign/index.html` (list the new frames)
- Modify: `docs/superpowers/specs/2026-11-18-glass-design-language.md` (glass: "system material plus a legibility tint where text scrolls beneath"; primary pair tokens), `2026-11-18-glass-redesign-design.md` (screen table: new frames; Insights gains "This cycle"), `2026-11-18-calendar-clarity-design.md` (non-goal "No fertile band in past months" replaced by the owner's P8-23 decision; compact bar and drag detents)

- [ ] **Step 1:** Edit frames by copying the existing B-file patterns (glass-design-language "Components"); no new look.
- [ ] **Step 2:** Render each changed or new frame with headless Chrome (`--window-size=420,1500`, taller for long frames) and look at it; fix what does not match the decisions.
- [ ] **Step 3:** Ask the owner to approve the four new frames and the slimmed Calendar-3 / Day-Screen before Task 9 starts; record the approval date in the redesign spec's "Owner approval".
- [ ] **Step 4:** Commit `P8-27 Frames: corrected defects, compact bar, drag states, past bands, Insights This cycle`.

---

### Task 6: Log sheet controls are round (P8-28)

Findings: L1, L3.

**Files:**
- Modify: `apps/mobile/src/features/logging/FlowSelector.tsx:22` (four circles with the drop and the word beneath, as Log-Sheet-Filled)
- Modify: `apps/mobile/src/features/logging/SymptomGrid.tsx:27` (two-column pills, name left, intensity dots right, "Mild" under the name when set)
- Modify: `apps/mobile/src/features/logging/LogSheet.tsx` (header date on one line, shrinking)
- Test: `apps/mobile/src/features/logging/SymptomGrid.test.tsx`, `LogSheet.test.tsx` (border radius equals half the height for flow options; symptom option `borderRadius: 999`; labels unchanged; accessibility labels unchanged)

- [ ] **Step 1:** Failing tests. **Step 2:** Implement. **Step 3:** `npx vitest related` + type-check.
- [ ] **Step 4: Simulator:** harness rows Log-Sheet-Empty, Log-Sheet-Filled (seed `inProgress`), light, dark, 150%; frame and build side by side; nothing clipped at 150%.
- [ ] **Step 5:** Commit `P8-28 Log sheet: flow circles and symptom pills as the frames`.

---

### Task 7: Calendar (P8-29)

Findings: C1 (wiring the kit's `legible` glass), C3, C5, C6, C7, C8 (weekdays), C12, X2 (sheet ink), and the sheet's large detent trimmed to make room for Task 9.

**Files:**
- Modify: `apps/mobile/src/features/calendar/DayCellView.tsx` (`:33` 80% ring 2 pt, 95% edge 1 pt in `periodPredicted`-strength dash with a distinct pattern; `:52` out-of-month opacity applied to the date text only, not to estimate rings, so an 80% day never looks weaker than a 95% day; `:71` a dotted mark drawn with small dots (Views or SVG), not a single-side dotted border)
- Modify: `apps/mobile/src/features/calendar/calendarModel.ts:68` (`showCycleDay` false while estimates are paused, e.g. pregnancy)
- Modify: `apps/mobile/src/app/(tabs)/calendar.tsx` (`:144` single-letter weekdays as the frame; `:154` legend lists only marks drawn in the visible month, plus a "Period, wider range" entry when a 95% edge day is drawn; pass the sheet's large-detent content from the new `SheetDetail`)
- Modify: `apps/mobile/src/features/calendar/DaySheet.tsx` (`:79`, `:129-130` ink from `onAccent`; `:125` disc drawn like its grid cell, selected included; `:78` no "Day N of your cycle" while paused; use `GlassSurface legible` for the bar and small detent)
- Modify: `apps/mobile/src/features/calendar/MonthList.tsx:42-43` (one date column width for the whole list, sized for the longest label; a cross-month range on one line where it fits; heading month name only, as the calendar spec part 4)
- Create: `apps/mobile/src/features/calendar/SheetDetail.tsx` (stub: today's large-detent content moved out of `calendar.tsx` unchanged; Task 9 slims it)
- Test: `calendarModel.test.ts` (no cycle day while pregnant; legend kinds follow drawn marks; 95% entry), `calendarScreen.test.tsx` (ring widths; out-of-month opacity on text only), `sheetSnap.test.ts` unchanged

- [ ] **Step 1:** Failing tests. **Step 2:** Implement. **Step 3:** `npx vitest related` + type-check.
- [ ] **Step 4: Simulator:** harness rows Calendar-1-Closed (`typical` and `inProgress`), Calendar-Bar-Compact, Calendar-Past-Bands, Calendar-2-SheetOpen (`sheet=small`), Calendar-3-SheetExpanded (`sheet=large`), Calendar-Dark, and `pregnant`; light, dark, 150%. Crop the bar at full resolution: month-list text beneath not readable. Check the 30 Nov / 3 Dec ring case of `docs/screenshots/P8-23-verify/calendar-nextperiod-rings-light.png` is fixed.
- [ ] **Step 5:** Commit `P8-29 Calendar: legible bar, ring hierarchy, paused state, month list column, dotted ovulation range`.

---

### Task 8: Today (P8-30, D-133)

Findings: T1 (wiring), T2, T4, T5, T6 (wiring the token), X2 (Log bar ink).

**Files:**
- Modify: `apps/mobile/src/features/today/todayModel.ts:96-106` (no estimate card while the ovulation estimate is uncertain and `showUncertainEstimates` is off; with the setting on, the card as now)
- Modify: `apps/mobile/src/features/today/cards.tsx` (no change to the §2.3 sentence)
- Modify: `apps/mobile/src/features/today/QuickLogRow.tsx` (`GlassSurface legible`; ink from `onAccent`; second line "Pregnant" while pregnant)
- Modify: `apps/mobile/src/features/today/CycleDial.tsx` (empty state draws the ticks; `:79` the dark estimate swatch token; the track from the `dialTrack` token, closing D-128)
- Modify: `apps/mobile/src/features/today/pregnancyModel.ts` (due-date range carries the year when it is not this year)
- Test: `todayModel` test (uncertain + setting off → no estimate card; uncertain + setting on → card), `CycleDial.test.tsx` (ticks in the empty state), `pregnancyModel.test.ts` (year), `QuickLogRow.test.tsx` (ink token; pregnant line)

- [ ] **Step 1:** Ask the owner for the D-127 nod (hide the uncertain card when the setting is off). Until then implement the conservative option, as CLAUDE.md requires for decisions without a reviewer, and record D-133 with the rejected alternative (words-only card whose fixed sentence still prints a date).
- [ ] **Step 2:** Failing tests. **Step 3:** Implement. **Step 4:** `npx vitest related` + type-check.
- [ ] **Step 5: Simulator:** harness rows Today-Period, Today-Typical (with `scroll=estimates`), Today-Irregular-Flag, Today-Empty, Today-Pregnant, Today-Dark; light, dark, 150%; the Log bar crop must not show the card beneath.
- [ ] **Step 6:** Commit `P8-30 Today: legible Log bar, no dated uncertain ovulation card, empty ticks, pregnancy line`.

---

### Task 9: Insights "This cycle"; slimmer calendar sheet and day screen (P8-31, D-134)

Owner decision (2026-11-18): the explanatory estimate cards (period end, next period, ovulation and fertile window, each with its picture and "How it was worked out"), the full "What is changing" hormone curve, the evidence key ("How to read the bars"), the sources list and the full food and movement sections leave the calendar sheet's large detent and the day screen, and live in a new Insights segment "This cycle". The sheet keeps a compact hormone curve. Findings: D1, D2, D3, D4, C10.

Needs: Task 5's approved `Insights-This-Cycle`, slimmed `Calendar-3-SheetExpanded`, `Day-Screen` and `Day-Screen-Future`; Task 7 merged (`SheetDetail.tsx` exists).

**Files:**
- Create: `apps/mobile/src/features/insights/ThisCycle.tsx` (the current cycle: the four estimate cards from `EstimateSections`, the full hormone curve with "you are here", the evidence key, food and movement for today's phase from `GuidanceSections` with supplements hidden under 18 as now, numbered sources at the end, the general caveat; teen mode hides ovulation and fertile cards exactly as now)
- Create: `apps/mobile/src/features/insights/ThisCycle.test.tsx`
- Modify: `apps/mobile/src/app/(tabs)/insights.tsx` (segment "This cycle" first or last per the frame; `?tab=this-cycle` from Task 1)
- Modify: `apps/mobile/src/features/calendar/SheetDetail.tsx` (large detent: logged chips, one-line estimate rows with meters, the compact hormone curve, a short phase line, and "More about this cycle ›" opening Insights This cycle; Log + "Open day" in the footer)
- Modify: `apps/mobile/src/app/day/[date].tsx` (`:82` "Estimates for this day" as short lines with meters, as the frame; compact food and movement tiles with "More about this cycle ›"; `:68` "+ Log this day" with the plus icon; `:84` the future note as the top card; no full sections)
- Modify: `apps/mobile/src/features/guidance/sections/EstimateSections.tsx`, `GuidanceSections.tsx`, `HormoneCurve.tsx` (a `compact` variant of the curve; a range bar "this day" marker for a future day; weekday labels on the period-end strip; one-day range sentence)
- Modify: `apps/mobile/src/features/today/` only if Today's "Read more" sheet should now open Insights This cycle instead of its own sheet (ask the owner; default: keep Today's sheet, D-122)
- Test: `ThisCycle.test.tsx` (all sections present for an adult; ovulation and fertile cards and supplements absent in teen mode; sources numbered), `dayScreen.test.tsx` (no "How it was worked out" on the day screen; short estimate lines present; plus icon), `calendarScreen.test.tsx` (large detent has the compact curve and the link, not the full sections), `sections.test.tsx`

- [ ] **Step 1:** Failing tests. **Step 2:** Implement, moving components rather than copying them (one source for each section, glass spec "Implementation notes").
- [ ] **Step 3:** `npx vitest related` + type-check; check the teen-mode tests still pass (`a11y.test.ts`, the effective-prefs tests).
- [ ] **Step 4: Simulator:** harness rows Insights-This-Cycle (adult and `teen=1`), Calendar-3-SheetExpanded (`sheet=large`), Day-Screen, Day-Screen-Future; light, dark, 150%.
- [ ] **Step 5:** DECISIONS D-134 (supersedes the "expanded sheet = day screen content" part of D-119 and D-120's placement): the explanations live in Insights This cycle; alternative rejected (keeping them in the sheet and day screen, which read as an article per day). PLAN §8.3/§8.5 lines updated. Commit `P8-31 Insights This cycle; slimmer calendar sheet and day screen`.

---

### Task 10: Settings, onboarding and lock details (P8-32)

Findings: S1, S2, S3, S5, S6, S8, O1, K1 (S4 copy is Task 4; S9 is Task 2).

**Files:**
- Modify: `apps/mobile/src/app/settings/appearance.tsx` (today ring on the preview disc)
- Modify: `apps/mobile/src/app/settings/notifications.tsx` (section label style for "Your reminders")
- Modify: `apps/mobile/src/app/settings/how.tsx` (17 semibold card headings; source number after "Bull et al. 2019")
- Modify: `apps/mobile/src/app/settings/privacy.tsx:75-76` (export: arrow out of the tray; import: arrow in)
- Modify: `apps/mobile/src/app/settings/backup.tsx` (white bordered fields, "Cloud copy" label, shield icon on the primary)
- Modify: `apps/mobile/src/app/settings/about.tsx` (Check for updates: white secondary pill with refresh icon)
- Modify: `apps/mobile/src/features/onboarding/OnboardingFlow.tsx` (title weight and size as the frames)
- Modify: `apps/mobile/src/features/lock/LockGate.tsx:51` (Face ID glyph in Unlock)
- Test: the existing screen tests for each file (labels unchanged; icons hidden from the screen reader)

- [ ] **Step 1:** Edits. **Step 2:** `npx vitest related` + type-check.
- [ ] **Step 3: Simulator:** harness rows for every Settings frame (light, dark, and 150% for Root, Tracking and Privacy), Onboarding-1, Onboarding-Dark, Lock-Screen (seed `lock=1`; the simulator's Face ID can be enrolled and matched with `xcrun simctl spawn <udid> notifyutil -p com.apple.BiometricKit_Sim.pearl.match` after `-s com.apple.BiometricKit.enrollmentChanged 1`). Onboarding needs a first run: move the app's `Documents/SQLite` aside (seed data only), relaunch, restore it afterwards.
- [ ] **Step 4:** Commit `P8-32 Settings, onboarding and lock: icons, headings, fields as the frames`.

---

### Task 11: Text size changed while the app runs (P8-33)

Finding: X6 (cause not yet traced).

**Files:**
- Investigate first: `apps/mobile/src/ui/Text.tsx:23` (fixed `lineHeight` per variant), `apps/mobile/src/ui/useFontScale.ts`, any `useWindowDimensions().fontScale` memoisation.
- Modify: the file the investigation names; test next to it.

- [ ] **Step 1:** Reproduce on the simulator: Today at `large`, then `xcrun simctl ui <udid> content_size accessibility-medium`, screenshot; then back to `large`, screenshot (the artefacts in `docs/screenshots/P8-23-verify/insights-after-textsize-change-light.png`).
- [ ] **Step 2:** Find the root cause (systematic-debugging skill); write a failing test where possible (a font-scale change re-renders with new line heights).
- [ ] **Step 3:** Fix; rerun Step 1; commit `P8-33 Layout follows a text-size change without a relaunch`.

---

### Task 12: Report for a doctor covers the logged cycles (P8-34)

Finding: S7 (pre-existing since P8-6).

**Files:**
- Modify: `apps/mobile/src/app/settings/report.tsx:34` and `apps/mobile/src/features/report/report.ts:30` (take closed cycles from `analyzeCycles(history, settings)` records, which carry `length`, or derive `length` from `nextStart` once in a shared helper; both places use the same helper)
- Modify: `apps/mobile/src/features/report/report.test.ts` (build the history through `project()` from events, as the app does, instead of hand-made records with `length` at `:7`)
- Test: a new case "lists the two closed cycles of the typical scenario" built from `scenario('typical', today)` events through `project()`.

- [ ] **Step 1:** Failing test (it must fail on today's code with "no cycles"). **Step 2:** Fix. **Step 3:** `npx vitest related` + type-check.
- [ ] **Step 4: Simulator:** seed `typical`, open `sanguine://settings/report`: "2 cycles from … to …"; generate the PDF and look at its cycle table (share sheet: screenshot only, do not send).
- [ ] **Step 5:** Sweep: grep `history.cycles` and `\.length !== undefined` / `c.length` across `apps/mobile/src` for other readers of a derived field on raw records; list what was found in the commit message. Commit `P8-34 Report: closed cycles come from the analysed records`.

---

### Task 13: Full verification pass and records (P8-35)

**Files:**
- Create: `docs/screenshots/P8-35-verify/` (harness output for every manifest row, light, dark, 150%)
- Modify: `docs/superpowers/specs/2026-11-18-glass-redesign-verification.md` (append "Re-check" with each finding's status)
- Modify: `docs/BACKLOG.md` (P8-23 retroactive entry for the device-feedback work; P8-24 to P8-35 ticked), `docs/DECISIONS.md` (P8-23's undocumented decisions: compact bar, detents, past fertile bands, with the alternatives), `docs/PLAN.md` §8.3, §8.5, §9.7 where the decisions change them

- [ ] **Step 1:** Run the harness for the whole manifest (one simulator, lock held, no Maestro).
- [ ] **Step 2:** Compare every pair; any mismatch goes back to the owning task as a fixup.
- [ ] **Step 3:** Full unit suite, lint, deny-list once; `tools/verify-screens/check-screenshots.sh`.
- [ ] **Step 4:** Ask the owner whether to run the Maestro suite once now (it was not run in this plan because of the memory rule).
- [ ] **Step 5:** Commit `P8-35 Glass redesign re-verified against the frames; P8-23 records`.

## Open owner decisions (asked in the tasks that need them)

1. D-127 / Task 8: hide the uncertain ovulation card when "Show uncertain estimates" is off (conservative default implemented until answered).
2. Task 2: how strong the legibility tint on floating glass may be (enough that text beneath is unreadable; the simulator images decide).
3. Task 3: the dark primary fill value (white ink, 4.5:1).
4. Task 4: one confidence vocabulary (How's "Confident / Fair estimate / Rough estimate").
5. Task 5: approval of the four new frames and the slimmed sheet and day screen, before Task 9.
6. Task 9: whether Today's "Read more" should open Insights This cycle instead of its own sheet.
