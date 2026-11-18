# Calendar Clarity and Glass Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the owner-approved calendar behaviour changes (period-end estimate, past ovulation, month list, ✕ removal with Undo, two new settings) and redraw every screen in the approved glass design.

**Architecture:** Two engine additions stay pure (`currentBleed` on `Prediction`, `pastOvulations()`); a removal/undo API in the logging actions; new preferences; a shared UI kit (surfaces, meters, chips, glass chrome, toast with action) built once in `apps/mobile/src/ui`; then each screen is rebuilt on that kit in parallel lanes that own disjoint files.

**Tech Stack:** Expo SDK 57, React Native, expo-router native tabs, `expo-glass-effect` (`GlassView`), `@expo/ui`, react-native-svg, zustand, i18next, vitest + React Testing Library (react-native-web), Maestro (iOS simulator only).

**Specs:** `docs/superpowers/specs/2026-11-18-calendar-clarity-design.md` (behaviour) and `docs/superpowers/specs/2026-11-18-glass-redesign-design.md` (visual system and screens). Mockups: the design canvas "Sanguine glass redesign" (claude.ai artifact `4GnPfVGn2f1JqPVfh3kiWH`); each UI task names its artboards.

## Global Constraints

- `packages/engine` stays pure: no React, platform APIs, I/O, `Date.now()` or randomness (CLAUDE.md).
- Symptoms never change a prediction; every prediction is a range with a confidence grade; never a single highlighted fertile day; no per-day chance of pregnancy (CLAUDE.md).
- Events are append-only: removal is a retraction; Undo retracts what the removal wrote (calendar spec part 5).
- Teen mode hides fertility language and supplements wherever it does today; new ovulation/fertile drawing obeys the existing `showOvulationEstimate` gate (`effectivePrefs`).
- Glass only in the navigation layer (toolbars, tab bar, sheets, floating controls, toasts, segmented controls), with one owner-approved exception: Today's hero estimate cards over the colour wash (glass spec "Surfaces").
- White page; cards white, radius 26, ring `rgba(31,26,28,0.04)` plus shadows `0 2px 6px rgba(31,26,28,0.04)` and `0 12px 32px rgba(31,26,28,0.08)`, no border; grey (`surface2`) fills only inside cards; sheets at the large detent 97% white.
- One filled (tinted) control per screen or sheet; every button a pill or circle; button labels one or two words, longer meaning in `accessibilityLabel`.
- Text contrast ≥ 4.5:1 (light and dark), including text on glass over the busiest content; every interactive element has an accessibility label and role; screens checked at 150% font scale.
- Copy lives in `copy/en-AU.json`; the forbidden-word test must pass; the fixed PLAN §2.3 wording is unchanged.
- Engine changes: `ENGINE_VERSION` 0.2.2 → 0.3.0, `pnpm engine-hash`, rows in `docs/regulatory/engine-changelog.md`, `requirements.md`, `risk-register.md`. OTA allowed for reviewed JS engine changes (D-110); no native dependency changes in this plan.
- Testing order (CLAUDE.md "Working unattended"): edits first, then `npx vitest related <files>` + typecheck, then the screen's Maestro flow via `apps/mobile/.maestro/run.sh ios <flow>.yaml` wrapped in the simulator lock (`mkdir /tmp/sanguine-sim.lock`), screenshots to `docs/screenshots/<item>/`. Never boot the Android emulator. Full suite, lint and deny-list once per lane before its last commit.
- Commits: only your own files, `git commit -- <paths>`, never `git add -A`; message starts with the backlog id. Review fixes as `git commit --fixup=<sha>`.
- Ids: backlog items P8-20 (calendar clarity), P8-21 (glass UI kit), P8-22 (glass screens); decisions D-111 to D-125 are claimed by the tasks below (each task names its own).

## Review Focus

1. A user who logs day 1 then nothing for a week: the period estimate must disappear once today passes its range, and no past month keeps estimated period days (Task 1 test `drops currentBleed once today passes i80.hi`).
2. Removing the flow entry on a period's first day, then Undo: the cycle list and the period join answers must be exactly as before (Task 4 test `undo after removing a cycle-start flow restores cycles and join answers`).
3. A hormonal-IUD user or a suspended life state looking at past months: no past-ovulation marks for cycles overlapping a hormonal-IUD state (Task 2); nothing past while suspended (Task 9 test `nothing past while suspended`).
4. Teen mode with "Show uncertain estimates" switched on in the past: no ovulation or fertile drawing anywhere (Task 9 and Task 12 tests with `includeUncertain: true`, `showEstimate: false`).
5. Text on glass over a period-red and fertile-green row at 150% font scale, light and dark: legible, nothing clipped (each UI task's screenshot step).

---

## Task graph and lanes

```
Wave 0 (foundation, run in parallel, disjoint files)
  T1 engine currentBleed ─┐
  T2 engine pastOvulations ┼─ T3 engine records (after T1+T2)
  T4 removal + undo API
  T5 prefs + uncertain gate
  T6 tokens + theme
  T7 UI kit: surfaces, buttons, chips, meter, tags, panels, sources   (after T6)
  T8 UI kit: glass chrome, toast with action, segmented               (after T6)
Wave 1 (screen lanes, parallel, each owns its files; all need T7+T8)
  Calendar: T9 model (needs T1,T2,T5) → T11 expanded sections → T10 grid, day card and sheet with its large detent (needs T4, T11)
  Today:    T12 cycle dial → T13 Today screen (needs T11's section components)
  Logging:  T14 energy slider + log sheet (needs T4) ; T15 day screen (needs T4, T11)
  Insights: T16 Insights + cycle detail
  Settings: T17 root and preferences screens (needs T5) ; T18 data screens
  Entry:    T19 onboarding, splash chrome, lock
  Widgets:  T20 widgets and notification copy
Wave 2: T21 records, flows and the full run (after all)
```
Shared files have one owner: `copy/en-AU.json` additions go through each task's own key block, merged by T21 if two tasks collide; `apps/mobile/src/ui/*` belongs to T7/T8 only, so a screen lane that needs a new primitive asks for it instead of editing the kit.

---

### Task 1: Engine `currentBleed` (P8-20, D-111)

**Files:**
- Modify: `packages/engine/src/types.ts` (add `currentBleed` to `Prediction`)
- Modify: `packages/engine/src/predict.ts` (compute it; menstrual phase uses it; `predict.ts:134`)
- Test: `packages/engine/src/currentBleed.test.ts`

**Interfaces:**
- Produces: `Prediction.currentBleed?: { point: ISODate; i80: Interval; confidence: Confidence }`.

- [ ] **Step 1: Write the failing tests** (`currentBleed.test.ts`, history built with `historyFromLengths` plus explicit `end` dates and `logs`):
  - `estimates from her median bleed length`: closed periods of 5 and 4 days, open cycle started 2026-10-31 with `end` 2026-11-02, today 2026-11-02 → `point` within 2026-11-03..2026-11-04, `i80.lo` 2026-11-03, `i80.hi` 2026-11-04, `confidence` 'low'.
  - `defaults to 5 days with fewer than two closed periods`: one closed period → `point` 2026-11-04 (start + 4), `i80` 2026-11-03..2026-11-06, 'low'.
  - `absent once the logged end reaches the estimate`: `end` 2026-11-04 → `currentBleed` undefined.
  - `drops currentBleed once today passes i80.hi`: today 2026-11-09 → undefined.
  - `a no-flow log after the last period day removes it`: `logs` has `{ date: '2026-11-03', flow: 'none' }` → undefined.
  - `absent while suspended` (pregnant life state); `present with a hormonal IUD and capped at low` (four consistent 5-day periods still give 'low').
  - `ignores cycles without a bleed length`: closed cycles with no `end` are skipped, not counted as undefined; an open cycle with no `end` uses its start.
  - `menstrual phase follows currentBleed`: today 2026-11-03 with `currentBleed` → `currentPhase.phase === 'menstrual'`.
- [ ] **Step 2: Run** `npx vitest run packages/engine/src/currentBleed.test.ts` → FAIL (`currentBleed` undefined).
- [ ] **Step 3: Implement in `predict.ts`.** Bleed lengths = `bleedDays` of the last 6 `valid` closed cycles. Only cycles with a defined `bleedDays` count (skip undefined). With ≥ 2: point = start + round(median) − 1, i80 = start + min − 1 .. start + max − 1, confidence 'medium' when ≥ 4 lengths span ≤ 2 days, else 'low'; then apply `gate.confidenceCap` (the hormonal IUD caps it at 'low'). With < 2: point start + 4, i80 start + 3 .. start + 6, 'low'. Treat a missing `open.end` as `open.start`. Return it only when not suspended, `point > open.end`, `today <= i80.hi`, and no `logs` entry after `open.end` with `flow: 'none'`. `menstrualEnd` = `currentBleed?.point ?? open.end ?? start + 4`.
- [ ] **Step 4: Run** the new test and `npx vitest run packages/engine` → all PASS (fixtures A–I unchanged).
- [ ] **Step 5: Commit** `P8-20 Engine: estimate the rest of a period in progress (D-111)`.

### Task 2: Engine `pastOvulations` (P8-20, D-112)

**Files:**
- Create: `packages/engine/src/pastOvulation.ts`, `packages/engine/src/pastOvulation.test.ts`
- Modify: `packages/engine/src/index.ts` (export)

**Interfaces:**
- Produces: `export interface PastOvulation { cycleId: string; cycleStart: ISODate; point: ISODate; i80: Interval; basis: OvulationEstimate['basis']; confidence: Confidence }` and `export function pastOvulations(history: History, settings: EngineSettings): PastOvulation[]`.

- [ ] **Step 1: Write the failing tests:**
  - `retrospective calendar estimate from the next start`: cycles 28, 28 (no biomarkers) → for the 3 Oct cycle, `point` 2026-10-17 ± 1 day, `basis` 'calendar', `i80` width ≤ 9 days.
  - `uses the biomarker estimate when there is one`: an LH positive on 2026-10-15 in that cycle → `basis` 'lh'.
  - `no row for the open cycle`, `no row for a non-valid cycle`.
  - `no row for a cycle overlapping a hormonal IUD state`.
  - `does not write into CycleRecord.ovulation`: `analyzeCycles` output unchanged after calling it (deep-equal before/after).
- [ ] **Step 2: Run** → FAIL (module missing).
- [ ] **Step 3: Implement** over `analyzeCycles(history, settings)`: biomarker estimate if present; else offset = `length − fitLuteal(lutealLengths(records)).m − 1`, sd = `sqrt(predictiveVariance(luteal))`, i80 via `ovulationInterval`, confidence via `confidenceGrade(sd)`.
- [ ] **Step 4: Run** → PASS; `npx vitest run packages/engine` green.
- [ ] **Step 5: Commit** `P8-20 Engine: retrospective ovulation estimates for past cycles (D-112)`.

### Task 3: Engine records (P8-20)

**Files:** `packages/engine/src/params.ts` (`ENGINE_VERSION = '0.3.0'`), `packages/engine/src/buildInfo.ts` (via `pnpm engine-hash`), `docs/regulatory/engine-changelog.md` (row 0.3.0), `docs/regulatory/requirements.md` (ER rows for `currentBleed` and `pastOvulations`, tests named), `docs/regulatory/risk-register.md` (RK rows: a retrospective estimate read as a confirmed ovulation; an uncertain estimate relied on; controls = estimate styling, words "estimate", teen gate).

- [ ] **Step 1:** Edit the four files; run `pnpm engine-hash`.
- [ ] **Step 2: Run** `npx vitest run tools/ci packages/engine` → PASS (soup, engine-hash tests).
- [ ] **Step 3: Commit** `P8-20 Engine 0.3.0 records: changelog, requirements, risks`.

### Task 4: Removal and Undo API (P8-20, D-113)

**Files:**
- Modify: `apps/mobile/src/features/logging/actions.ts` (`setFlow`, `setSymptom`, `setEnergy` and the biomarker setters built on `replaceBiomarker` return the events they wrote)
- Create: `apps/mobile/src/features/logging/removeEntry.ts`
- Test: `apps/mobile/src/features/logging/removeEntry.test.ts`

**Interfaces:**
- Consumes: `EventStore.retract(id): Promise<EventRow>`, `dayEvents(store, day): Promise<DayEvent[]>`.
- Produces: `visibleEntries(events: DayEvent[]): DayEvent[]` (what the chips show: the latest flow event of the day unless its level is 'none', every other active entry; `period.start`/`period.end` markers kept as today) and `removeEntry(store: EventStore, db: Database, entry: DayEvent): Promise<EventRow[]>` (flow → `setFlow(..., 'none', { kind })`; symptom → intensity 0; energy → 0; other kinds → `store.retract(entry.id)`) and `undoRemoval(store: EventStore, written: EventRow[]): Promise<void>` (retracts each written event, newest first).

- [ ] **Step 1: Write the failing tests:** `removing flow hides its chip` (after `removeEntry` on the flow entry, `visibleEntries(await dayEvents(store, day))` has no flow; after undo the original flow is back and no 'none' entry shows); `removes a symptom and undo restores it`; `removing energy then undo`; `undo after removing a cycle-start flow restores cycles and join answers` (seed a split answer, remove day-1 flow, undo, compare `cycle` rows and active `period.start` events to the snapshot); `retracts a temperature and undo restores it`.
- [ ] **Step 2: Run** `npx vitest run apps/mobile/src/features/logging/removeEntry.test.ts` → FAIL.
- [ ] **Step 3: Implement** the two functions; make those setters and `replaceBiomarker` return `EventRow[]` (existing callers ignore the value).
- [ ] **Step 4: Run** `npx vitest related apps/mobile/src/features/logging/actions.ts` → PASS.
- [ ] **Step 5: Commit** `P8-20 Logging: remove an entry and undo it, append-only (D-113)`.

### Task 5: Preferences, estimate gates and the guidance phase (P8-20, D-114, D-115)

**Files:** `apps/mobile/src/data/prefs.ts`, `apps/mobile/src/features/today/fertileShown.ts`, `apps/mobile/src/features/guidance/guidance.ts` (`phaseOn` keeps the open cycle menstrual through `prediction.currentBleed.point`), tests `apps/mobile/src/features/guidance/guidance.test.ts` (extend), tests `apps/mobile/src/data/prefs.test.ts` (extend) and `apps/mobile/src/features/today/fertileShown.test.ts` (create).

**Interfaces:**
- Produces: `Prefs.calendarCycleDay: boolean` (default `true`), `Prefs.showUncertainEstimates: boolean` (default `false`); `shownFertileDays(p, opts?: { includeUncertain?: boolean })`; `ovulationDrawable(p: Prediction | undefined, includeUncertain: boolean): boolean`.

- [ ] **Step 1: Write the failing tests:** defaults; `includeUncertain draws a wide estimate`; `phaseOn says menstrual on an estimated period day` (open cycle end 2026-11-02, `currentBleed.point` 2026-11-04 → `phaseOn` for 2026-11-03 is menstrual, matching `currentPhase`). The consumer-level teen test lives in Tasks 9 and 12.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** Reminders, widgets and `.ics` keep calling `shownFertileDays(p)` without the option. **Step 4: Run** related tests → PASS.
- [ ] **Step 5: Commit** `P8-20 Settings: cycle-day numbers and uncertain estimates preferences (D-114, D-115)`.

### Task 6: Tokens and theme (P8-21)

**Files:** `packages/ui-tokens/src/tokens.ts`, `packages/ui-tokens/src/tokens.test.ts`, `apps/mobile/src/theme/index.tsx`.

**Interfaces:**
- Produces on `Theme`: `c.textOnGlass` (#4A4246 / #CFC6CA), `c.caution` / `c.cautionBg` / `c.cautionText` (#8A5512, rgba(185,116,30,0.10), #5E3A0C; dark from `flag`), `elevation.card` (the Global Constraints shadow), `radius.card = 26`, `radius.float = 28`, `radius.sheet = 34`, `glass.inset = 10`.

- [ ] **Step 1:** Add contrast assertions to `tokens.test.ts` (each new text pairing ≥ 4.5:1 on white and on `surface2`; dark too). **Step 2:** Run → FAIL. **Step 3:** Add tokens and theme fields. **Step 4:** Run → PASS. **Step 5: Commit** `P8-21 Tokens: glass text, caution, card elevation and radii`.

### Task 7: UI kit, content pieces (P8-21, D-116)

**Files (create or rewrite):** `apps/mobile/src/ui/Card.tsx` (soft elevation, no border), `ui/Button.tsx` (kinds `primary` filled pill, `secondary` white pill with hairline, `text`, `destructive`; optional `icon`), `ui/Chips.tsx` (on = accentSoft + accent border, never filled), `ui/LoggedChip.tsx`, `ui/Meter.tsx`, `ui/EstimateTag.tsx`, `ui/CautionPanel.tsx`, `ui/Sources.tsx`, test `ui/kit.test.tsx`.

**Interfaces:**
- Produces: `<LoggedChip label mark="flow"|"symptom"|"other" onRemove />` (accessibility label `Remove: <label>`); `<Meter level={0|1|2|3} word={string} />` with `confidenceLevel(c: Confidence): 0|1|2|3` and `evidenceLevel(e: Evidence): 0|1|2|3`; `<EstimateTag />`; `<CautionPanel>…</CautionPanel>`; `<Sources items={string[]} />` plus `<Cite n={number} />`.

- [ ] **Step 1: Write the failing tests** in `kit.test.tsx`: LoggedChip's remove button label and callback; Meter renders `level` filled bars and the word; Chips selected state has `accessibilityState.selected` and no filled background; Button `primary` is the only kind with the accent fill.
- [ ] **Step 2–4:** Run → FAIL; implement to the components board (`Main` artboard); run → PASS; `npx vitest related apps/mobile/src/ui` green.
- [ ] **Step 5: Commit** `P8-21 UI kit: cards, buttons, chips, meter, estimate tag, caution panel, sources (D-116)`.

### Task 8: UI kit, glass chrome (P8-21, D-117)

**Files:** `apps/mobile/src/ui/GlassBar.tsx` (create), `ui/SubScreen.tsx` and `ui/Screen.tsx` (use GlassBar; content scrolls beneath), `ui/Toast.tsx` (action), `ui/Segmented.tsx` (glass on iOS), test `ui/chrome.test.tsx`.

**Interfaces:**
- Produces: `<GlassBar title leading trailing />` (iOS `GlassView` regular, Android M3 top app bar surface); `showToast(message: string, action?: { label: string; onPress: () => void })` (6 s with an action, 4 s without; announces "…, <label> available").

- [ ] **Step 1: Write the failing tests:** toast with action shows the button and calls it once; toast without action unchanged; SubScreen renders the back button with label "Back".
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5: Commit** `P8-21 UI kit: glass toolbar, toast with Undo, glass segmented control (D-117)`.

### Task 9: Calendar model (P8-20)

**Files:** `apps/mobile/src/features/calendar/calendarModel.ts`, `calendarModel.test.ts`, `useCalendarData.ts`.

**Interfaces:**
- Consumes: `Prediction.currentBleed`, `pastOvulations`, `ovulationDrawable`, `shownFertileDays(p, { includeUncertain })`.
- Produces on `DayCell`: `periodEstimate: 'core' | 'edge' | undefined` (replaces `predicted80`/`predicted95Edge`; also covers `currentBleed`), `ovulation: 'point' | 'range' | undefined` for current and past cycles, `symptoms: boolean`, `cycleDayPast: boolean`; `buildMonth` input gains `pastOv: PastOvulation[]`, `symptomDays: Set<ISODate>`, `includeUncertain: boolean`. New `monthRows(...): MonthRow[]` with `interface MonthRow { from: ISODate; to: ISODate; kind: 'logged' | 'periodEstimate' | 'fertile' | 'ovulation' | 'nextPeriod'; text: string; estimate: boolean }`; date labels without the month name unless the range crosses months.

- Also produces: `dayEstimates(date: ISODate, i: { prediction?: Prediction; pastOv: PastOvulation[]; showEstimate: boolean; includeUncertain: boolean; period: boolean }): string[]`, replacing the four-argument form; it names a past cycle's range and basis ("from your next period date" / "from your LH tests"). Consumers: Task 10 (day card and sheet), Task 15 (day screen).

- [ ] **Step 1: Write the failing tests:** `uncertain setting never overrides the estimate gate` (`includeUncertain: true`, `showEstimate: false` → no ovulation or fertile marks and no ovulation words); `nothing past while suspended` (valid cycles before a pregnant life state, `prediction.suspended` set → no past-ovulation marks or words); `dayEstimates words a past ovulation with its basis`; currentBleed days are `periodEstimate: 'core'` up to `point` and `'edge'` to `i80.hi`; past ovulation marks October; no past marks when the estimate gate is off; symptom days flagged; `monthRows` for November 2026 yields `1`, `2`, `3–5`, `6–20`, `14`, `26–30` with "at most 24 Nov – 2 Dec".
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5: Commit** `P8-20 Calendar model: period-end estimate, past ovulation, symptom marks, month list`.

### Task 10: Calendar screen (P8-22, D-118, D-119)

**Files:** `apps/mobile/src/app/(tabs)/calendar.tsx`, `features/calendar/DayCellView.tsx`, create `features/calendar/DaySheet.tsx`, `features/calendar/MonthList.tsx`; test `features/calendar/calendarScreen.test.tsx`; flow `.maestro/calendar.yaml`.

**Artboards:** Calendar 1–3, Calendar dark.

**Interfaces:** Consumes `EstimateSections` and `GuidanceSections` from Task 11 for the sheet's large detent, and `visibleEntries`/`removeEntry`/`undoRemoval` from Task 4.

- [ ] **Step 1: Write the failing tests:** tapping a selected day opens the sheet; dragging to the large detent shows the estimate and guidance sections; ✕ on a chip calls `removeEntry` and shows the Undo toast; Undo calls `undoRemoval`; Log is the only filled control; cycle-day numbers hidden when `calendarCycleDay` is false; month-list row tap selects its day.
- [ ] **Step 2–4:** Run → FAIL; implement the cell (36 pt circle; period solid; estimate dashed ring; ovulation point white disc with blue glow; fertile graded band with 1.5 pt lower edge; cycle-day number semibold up to today), the glass day card (closed detent) with round Log, the day sheet (small detent: chips, estimate lines, "Show details", Log this day, Details), the month list; toolbar "Today" is a secondary glass pill; run → PASS.
- [ ] **Step 5: Verify:** typecheck; `run.sh ios calendar.yaml`; screenshots light, dark and 150% to `docs/screenshots/P8-22-calendar/`; compare with the artboards.
- [ ] **Step 6: Commit** `P8-22 Calendar: calm circles, glass day card and day sheet, month list, remove with Undo (D-118, D-119)`.

### Task 11: Estimate and guidance sections (P8-22, D-120)

**Files:** create `apps/mobile/src/features/guidance/sections/EstimateSections.tsx`, `GuidanceSections.tsx`, `HormoneCurve.tsx`; test `sections.test.tsx`; copy keys under `estimates.how.*`, `guidance.evidenceKey.*`.

**Artboard:** Calendar 3 (dragged up).

**Interfaces:**
- Produces: `<EstimateSections prediction day pastOv showEstimate />` (period end, next period, ovulation and fertile cards with pictures, meters and "How it was worked out") and `<GuidanceSections day={GuideDay} supplements={boolean} compact={boolean} />` (`GuideDay` from `features/guidance/guidance.ts`, keeping its `expected` wording) (compact = two tiles + "Read more").

- [ ] **Step 1: Write the failing tests:** the period-end card shows her lengths; next-period card shows "8 in 10" and "about 19 in 20"; ovulation card shows the "Calendar only" caution when basis is 'calendar'; evidence key lists Strong/Some/Early/General with the approved definitions; supplements hidden when `supplements` is false; compact mode renders exactly two tiles and a "Read more" button.
- [ ] **Step 2–4:** Run → FAIL; implement from the existing guidance copy (no new claims); run → PASS.
- [ ] **Step 5: Commit** `P8-22 Estimate and food-and-movement sections with evidence, sources and pictures (D-120)`.

### Task 12: Cycle dial (P8-22, D-121)

**Files:** create `apps/mobile/src/features/today/dialModel.ts`, `dialModel.test.ts`, `CycleDial.tsx`; remove `PhaseRing.tsx` usage (keep file until Task 13 lands).

**Interfaces:**
- Produces: `dialModel(i: { prediction?: Prediction; today: ISODate; periodDays: ISODate[]; showEstimate: boolean; includeUncertain: boolean }): DialModel` with `interface DialModel { days: number; arcs: Array<{ from: number; to: number; kind: 'period' | 'periodEstimate' | 'fertile'; p?: number }>; ovulationDay?: number; todayDay?: number }`; `<CycleDial model centre={{ kicker; big; pill?; sub? }} />`.

- [ ] **Step 1: Write the failing tests:** days = cycle day of `nextPeriod.i80.hi`; period arc days 1–3, estimate arc 4–5, next-period arc 27–31 for the sample; no fertile arc or ovulation when the gate is off, even with `includeUncertain: true`; empty model when no cycles.
- [ ] **Step 2–4:** Run → FAIL; implement (track, day ticks longer every 7, rounded arcs, fertile band as butt-capped slices in solid blended colours, ovulation white point with blue ring, today knob); run → PASS.
- [ ] **Step 5: Commit** `P8-22 Today: cycle dial replaces the phase ring (D-121)`.

### Task 13: Today screen (P8-22, D-122)

**Files:** `apps/mobile/src/app/(tabs)/today.tsx`, `features/today/cards.tsx`, `features/today/QuickLogRow.tsx`, test `features/today/todayScreen.test.tsx`, flow `.maestro/today.yaml`.

**Artboards:** Today period, typical, irregular, empty, suspended, pregnant, dark.

- [ ] **Step 1: Write the failing tests:** compact food and movement shows two tiles and "Read more" opens the sections sheet; logged chips remove with Undo; estimate cards show the meter and estimate tag; empty and suspended states keep their copy.
- [ ] **Step 2–4:** Run → FAIL; implement (hero wash behind dial and estimate cards, those cards in glass; other cards white); run → PASS.
- [ ] **Step 5: Verify** `run.sh ios today.yaml`; screenshots light, dark, 150% to `docs/screenshots/P8-22-today/`.
- [ ] **Step 6: Commit** `P8-22 Today: dial, glass hero estimates, compact food and movement (D-122)`.

### Task 14: Log sheet and energy slider (P8-22, D-123)

**Files:** `apps/mobile/src/features/logging/LogSheet.tsx`, create `features/logging/EnergySlider.tsx`, tests `LogSheet.test.tsx` (extend), `EnergySlider.test.tsx`, flow `.maestro/logging.yaml`.

**Artboards:** log sheet empty, filled, More, contraception, same-period question.

**Interfaces:** `<EnergySlider value={0|1|2|3|4|5} onChange={(v: 0|1|2|3|4|5) => void} />` (role `adjustable`, value text "Very low"…"High" or "Not logged"; "Clear" sets 0).

- [ ] **Step 1: Write the failing tests:** slider sets 2 on a tap at the second detent; Clear sets 0; accessibility increment/decrement step by one; Done is the filled capsule; "Logged on this day" chips remove with Undo.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5: Verify** `run.sh ios logging.yaml`; screenshots to `docs/screenshots/P8-22-logging/`.
- [ ] **Step 6: Commit** `P8-22 Log sheet: Done as primary, removable entries, energy slider (D-123)`.

### Task 15: Day screen (P8-22)

**Files:** `apps/mobile/src/app/day/[date].tsx`, test `features/logging/dayScreen.test.tsx` (extend).

- [ ] **Step 1: Write the failing tests:** entries as ✕ chips without a confirm alert; Undo restores; "Not a period" / "Mark as spotting" kept on a period day; full `EstimateSections` and `GuidanceSections`; future day shows estimates only.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5: Commit** `P8-22 Day screen: removable entries, full estimate and guidance sections`.

### Task 16: Insights and cycle detail (P8-22)

**Files:** `apps/mobile/src/app/(tabs)/insights.tsx`, `features/insights/HistoryRow.tsx`, `features/insights/charts.tsx`, `apps/mobile/src/app/cycle/[id].tsx`, tests extend `HistoryRow.test.tsx`, `energyScreen.test.tsx`; flow `.maestro/insights.yaml`.

**Artboards:** Insights history, charts, accuracy, irregular, empty, pattern; cycle detail.

- [ ] **Steps:** tests for the excluded-cycle row action and meters; implement on the kit; `run.sh ios insights.yaml`; screenshots; commit `P8-22 Insights and cycle detail on the glass kit`.

### Task 17: Settings root and preference screens (P8-22, D-124)

**Files:** `apps/mobile/src/app/(tabs)/settings.tsx`, `app/settings/tracking.tsx`, `appearance.tsx`, `notifications.tsx`, `lifestate.tsx`, `about.tsx`, `how.tsx`; `ui/SettingsRow.tsx` is T7's: request a `leadingIcon` prop there if missing; flow `.maestro/settings.yaml`.

**Artboards:** Settings root, tracking, appearance, notifications, life state, about, how.

- [ ] **Steps:** tests that the two new switches exist where the spec puts them ("Show uncertain estimates" hidden while the ovulation estimate is off; "Cycle day on calendar" in Appearance); round rose-tinted icons; implement; `run.sh ios settings.yaml`; screenshots; commit `P8-22 Settings on the glass kit, two new switches (D-124)`.

### Task 18: Settings data screens (P8-22)

**Files:** `app/settings/health.tsx`, `privacy.tsx`, `backup.tsx`, `report.tsx`, `calendar.tsx`, `legal.tsx`; flows `health.yaml`, `backup.yaml`, `report.yaml`, `share-calendar.yaml`, `delete.yaml`.

- [ ] **Steps:** keep every state listed in the glass spec "States and copy still open" (progress, errors, results) in caution panels, toasts or disabled controls; implement; run the five flows; screenshots; commit `P8-22 Settings data screens on the glass kit`.

### Task 19: Onboarding, splash chrome and lock (P8-22, D-125)

**Files:** `apps/mobile/src/features/onboarding/OnboardingFlow.tsx`, `features/lock/LockGate.tsx`; `features/splash/BrandSplash.tsx` only if spacing changes (brand untouched); flows `onboarding.yaml`, `onboarding-agegate.yaml`, `lock-ios.sh`.

- [ ] **Steps:** glass header (Back, Skip) and glass footer with the one Continue; record the §9.7 deviation as D-125; run flows; screenshots; commit `P8-22 Onboarding and lock on the glass kit (D-125)`.

### Task 20: Widgets and notifications (P8-22)

**Files:** `apps/mobile/src/services/widgets.ts`, the widget target views, `features/notifications/plan.ts` (copy only).

- [ ] **Steps:** restyle widgets to the artboard (discreet default unchanged); no new data in notifications; verify on the simulator home screen; commit `P8-22 Widgets restyled`.

### Task 21: Records, flows and the full run (P8-20, P8-22)

**Files:** `docs/DECISIONS.md` (D-111…D-125, each with the rejected alternative), `docs/PLAN.md` §8.3, §8.5, §9.1, §9.2, §9.7 rows, `docs/BACKLOG.md` (P8-20, P8-21, P8-22 ticked), `CLAUDE.md` (Visual reference: the canvas), delete or update the stale `docs/CLAUDE.md` copy, `copy/en-AU.json` key merge, `docs/i18n/strings-for-translation.csv` (`pnpm i18n:extract`).

- [ ] **Step 1:** Write the records. **Step 2:** `pnpm i18n:extract`; `pnpm soup`. **Step 3:** Full `npx vitest run`, `pnpm -s typecheck`, `pnpm -s lint` (only pre-existing failures allowed, listed), deny-list. **Step 4:** `suite.sh ios` once. **Step 5:** Commit `P8-22 Records: decisions D-111 to D-125, PLAN and BACKLOG, translation sheet`.
