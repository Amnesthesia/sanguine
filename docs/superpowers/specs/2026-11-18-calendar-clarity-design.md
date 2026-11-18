# Calendar clarity: estimates you can see, logs you can remove

Date: 2026-11-18. Owner feedback from testers on the 1.0.0 beta, with the owner's answers in this session.

## Why

Testers could not see on the Calendar what they most wanted to know, and could not find how to undo a log:

1. Logging the first day of a period draws only that one day. Other apps (Flo) draw a best guess for the rest of the period.
2. The cycle-day badge is a solid rose circle on every day of the month, future days included (D-101). It clutters the grid.
3. Information only appears after tapping a day. The owner logged three past periods retroactively and wanted to see where ovulation would have been last month; nothing on the grid showed it. Owner: ovulation is "one of the most important things to see other than bleeding days. Logged symptoms and predicted events should be on the calendar."
4. Undo exists but is hidden (tap a flow level or energy again, press and hold a symptom, Delete on the day screen). Owner: "You should be able to see what was logged on a day and click an X to remove it."
5. When an estimate is too uncertain the app shows nothing. Owner: let the user decide, with a setting.

Plus two settings the owner asked for: turn the cycle-day badges off, and show uncertain estimates.

## Goals

- The rest of a period in progress is drawn as an estimate as soon as day 1 is logged.
- Past months show where ovulation most likely was, marked as an estimate.
- Days with logged symptoms are distinguishable on the grid, and a month list under the grid spells out what was logged and what is estimated, day by day, without tapping.
- Every logged entry is visible where it is shown and removable with one tap on an ✕, with an Undo.
- A calmer grid (owner chose layout B) with Liquid Glass in the navigation layer.
- Future cycle-day numbers are visually lighter, and the numbers can be turned off.
- An opt-in setting draws uncertain ovulation and fertile estimates instead of hiding them.

## Non-goals

- No change to how the next period is predicted; it is redrawn in the B style (dashed rings for the 80% range, fainter rings for the 95% edge).
- No fertile band in past months (only the ovulation estimate).
- No predicted periods beyond the next one.
- Uncertain estimates are never pushed outside the app: reminders, widgets and the .ics export keep today's rules.

## Anti-goals (a failure even if it works)

- Any estimate drawn so it reads as a logged fact. Owner: past estimates carry an indicator that they are estimates.
- A single highlighted "fertile day" or a per-day chance of pregnancy (CLAUDE.md non-negotiables).
- Fertility language shown in teen mode where it is hidden today.
- A grid as crowded as the one testers complained about: each cell gains at most one new mark.

## Constraints

- `packages/engine` stays pure and deterministic. New estimates are engine output, so they are engine changes: version bump, `engine-changelog.md`, `requirements.md`, `risk-register.md`, engine hash, tests written first. Reviewed JS engine changes may ship over the air (D-110).
- Event rows are append-only: removal is a retraction, Undo appends a new event.
- Accessibility labels on every interactive element; every cell's screen-reader label says what its marks mean; checked at 150% text.
- Copy goes in `copy/en-AU.json` under the forbidden-word test; the §2.3 regulatory wording is unchanged.
- Visual verification on the iOS simulator only (CLAUDE.md "Working unattended").

## Approaches considered (for how logs and estimates show on the calendar)

- A. More marks in each cell (one glyph per kind: symptom, sex, temperature, LH). Everything on the grid, but 52 pt cells already hold date, badge, moon, drop, ovulation line and fertile band; crowded on a phone and breaks at 150% text.
- B. A month list under the grid, grid unchanged apart from past ovulation. Readable and accessible, but symptoms are not on the grid itself.
- C. Both, kept light: the grid adds past ovulation and one symptom dot; a month list carries the detail.

After C was agreed, five whole-screen layouts were mocked up (canvas "Calendar layout options", 2026-11-18): A (today's grid plus a month list), B (calm circles plus a day panel), C (vertically scrolling months plus a day sheet), D (a Month / Cycles switch with one row per cycle), E (a week strip plus a day-by-day agenda). **The owner chose B, and asked for it to be "more liquid glass".** B keeps approach C's split (light marks on the grid, detail below it) with a calmer cell. D's per-cycle comparison and E's agenda were not taken up.

## The design

### The screen (option B, with Liquid Glass)

Top to bottom, iOS:
- **Glass toolbar** (navigation layer): ‹, the month title, a tinted glass "Today" capsule (shown when not on the current month, as today), ›, and the weekday row. The grid scrolls beneath it. Swiping between months (D-092) and the title's screen-reader month actions stay.
- **Grid** (content layer, opaque): each day is a 36 pt circle holding the date, with the cycle day as a small number above it and one row of small marks below it (see the cell, next).
- **Legend**, then the **month list** (part 4) styled as option A's list. The separate food and movement summary card (D-109) goes: its content lives in the day sheet.
- **Day card = the sheet's closed detent** (owner: "when it isn't open, you should still get an overview of the day being viewed", and asked for it to be designed for glass). It is not a content card: it floats above the tab bar as the day sheet's lowest detent, so glass stays in the navigation layer (PLAN §9.1). Layout: a grabber; a row with the day as a 46 pt disc styled like its grid cell (here a period-red disc with "2" and "MON"), "Today, 2 November" and "Day 3 of your cycle · Period", and on the right a 52 pt round filled rose **Log** button (the one filled control; it replaces the floating Log capsule of D-099); a row of small read-only chips for what was logged; and an inset "Estimates" well with one line per estimate, its dashed marker and its confidence bars. Everything left of Log is one button that opens the sheet. Glass: about 64% white with a 30 pt blur and raised saturation, a 1 pt light border and inner top highlight for the edge, and two shadows (a tight 1 pt one for definition on white content, a soft 14/36 pt one for lift). Contrast: primary text `textPrimary`, secondary text #4A4246 (darker than `textSecondary`, because glass lightens what is behind it), the estimate label in a darkened ovulation blue; all must still reach 4.5:1 with the busiest grid row scrolled beneath. Spacing: 10 pt from the screen edges and 8 pt above the tab bar, matching the tab bar's inset; 28 pt corner radius, concentric with the tab bar; 16 pt inner padding; 10 pt between rows. The content scrolls beneath it with enough bottom inset that the last month-list row can scroll clear.
- **Day sheet, three states** (navigation layer). (1) Closed: the glass day card above. (2) Open at a small detent, when she taps a day that is already selected, taps the day card, or swipes up from it: a glass sheet above the tab bar, laid out like option C's sheet (owner's choice): a title row with the date, "Today · Day N · Period" and a round glass close button; the logged entries as ✕ chips (part 5); the estimate lines; a row "How these were worked out · Food and movement · Sources" that expands it; and at the bottom the primary **Log this day** and a secondary **Details** (the day screen). Tapping a different day while it is open updates the sheet in place. (3) Dragged up to the large detent (owner: "drag it up to expand it, then you can read all of the food and movement"): the full detail, see "The expanded sheet" below. Closing returns to (1). Primary-action rule (owner: the Log button looked like the selected chips, so the screen seemed to have several primary buttons): the sheet has exactly one filled element, the full-width Log button, with a plus icon and 52 pt height; logged-entry chips are never filled (translucent white with a small coloured leading mark: a red drop for flow, an accent dot for symptoms, a grey dot for anything else). Every button and chip is fully rounded, like the rest of the screen (owner). It replaces both the selected-day card and the floating Log button (D-099): the one primary action stays within thumb reach, now beside the day it logs. A future day shows no Log button, as today. Dragging the sheet up to its large detent shows the same content as the day screen.
- **System tab bar** (glass, as today).

Glass stays in the navigation layer only, as PLAN §9.1 requires: toolbar, sheet, capsules and tab bar. The grid and the cards stay opaque so marks and text keep their contrast. Text on glass must still reach 4.5:1 over the worst content scrolling beneath; use the platform's vibrancy (`expo-glass-effect` regular variant) and check it with period-red and fertile-green rows under the toolbar. Android gets the Material 3 equivalents (top app bar, modal bottom sheet, navigation bar), no glass.

### The expanded sheet (large detent)

Owner: the estimate and the food and movement sections must not be text blurbs. They must be designed sections with details and graphics, pedagogical, clear and to the point, scientifically accurate with citations, and clear when something is guesswork, uncertain or thinly evidenced. Mockup: canvas artboard "B · 3. drag the sheet up".

- **One meter for certainty.** A three-bar meter is used everywhere: as confidence on estimates (engine grade high, medium, low) and as the evidence grade on food, movement and supplements (Strong, Some, Early; General shows no filled bar). A small "How to read the bars" card explains it. The four grade definitions are new copy, approved by the owner (2026-11-18): Strong = large reviews or national guidelines agree; Some = several small trials point the same way, results vary; Early = one study, lab work, or a plausible link not tested in people; General = good advice on any day, not specific to this phase.
- **Estimates**, one card each, each with a picture, the plain answer, the meter, and a "How it was worked out" panel in her own numbers:
  - When this period ends: a 7-day strip (logged days solid, estimated days dashed) and her past period lengths placed on a 0–10 day scale with the FIGO typical range (up to 8 days) shaded.
  - Next period: a range bar with the 80% range dark, the 95% range light and dashed, the most likely day marked; the two shades in words as "8 in 10" and "about 19 in 20"; how her own cycles and the population prior (Bull 2019) combine, and that confidence can reach high after about six regular cycles (D-020).
  - Ovulation and fertile window (only where ovulation estimates are shown): a strip of the whole cycle with the period, the graded fertile band, the ovulation range and its most likely day, and today; an amber "Calendar only" tag when no LH, temperature or mucus data exists this cycle; the luteal-phase basis (12.4 ± 2.4 days, Bull 2019), why calendar estimates drift (variation sits before ovulation), and the Wilcox 1995 six-day window. The fixed PLAN §2.3 wording sits at the foot of this card unchanged.
- **Food and movement** for the day's phase, built from the existing guidance copy and grades (D-107), nothing new claimed:
  - What is changing: a schematic hormone curve with "you are here", captioned "A typical cycle, drawn to explain. Not your own hormone levels.", then the phase's `body` copy.
  - One card per food note and per movement note: an icon, the tip, example dishes as chips, the evidence meter, and the "why" in a tinted panel; a small chart where the copy has numbers (iron: 18 mg against 8 mg). An Early or General note says in its panel why it is only that.
  - Supplements (hidden in teen mode, as now): one row each with dose, trial size, grade, and the existing caveat in an amber panel.
- **Sources**: numbered superscripts in the text, a numbered list at the end (author, year, journal, and the study size where the copy gives it), then the existing general caveat.
- The same components serve the day screen and Today's guidance card, so the three never drift (Today keeps its short form).

### The cell

- **Period, logged:** the circle filled period red, date in white.
- **Period, estimate** (next period's 80% range, and the rest of a period in progress): the circle with a dashed period-red ring. The 95% edge days: a fainter dashed ring (`periodPredicted`).
- **Fertile window, estimate:** a continuous tinted band behind the circles of consecutive fertile days, opacity following p(d), rounded at the window's ends and at week edges. It needs the solid 1.5 pt lower edge of D-093 (or an equivalent) so every fertile day keeps 3:1 against the page; the mockup's tint alone does not.
- **Ovulation, estimate:** the point day is a white disc with a soft ovulation-blue glow and a blue semibold date (owner rejected a dashed ring as untidy); the other days of the 80% range get a short dotted blue line under the date. The soft edge is the estimate signal: crisp fills are logged, soft or broken edges are estimated. Same drawing for past months (part 3) and the current cycle.
- **Today:** a 2 pt accent ring outside the circle, bold date. **Selected:** the circle filled `accentSoft`.
- **Cycle day:** a small number above the circle (replaces the D-101 corner badge; owner chose B). Past days and today in semibold, future days in regular, both `textSecondary` so both pass 4.5:1. The setting of part 2 hides the numbers.
- **Marks row under the circle:** an accent dot for symptoms, a grey dot for anything else logged.
- **Moon phase** (D-089, only for lunar-aligned users): a small glyph at the cell's top right, level with the cycle-day number.
- Days outside the month at 40% opacity, as today.
- Screen-reader label of every cell unchanged in content: date, cycle day, today, each mark in words, "estimate" where it is one.

### Visual rule for estimates (owner: past estimates need an indicator)

One rule on the grid: **solid means you logged it; dashed or dotted means it is an estimate.** The legend says so. Words always say "estimate" in the day sheet, the day screen and the month list.

### 1. Rest of a period in progress

How the code works today (checked): the app's projection gives every cycle an `end` equal to its last logged period day (`apps/mobile/src/data/project.ts:160`), so the open cycle always has an `end` and `predict`'s fallback of 5 days (`packages/engine/src/predict.ts:134`, `open.end ?? start + DEFAULT_BLEED_DAYS - 1`) never applies in the app. "No logged end" therefore cannot be the trigger.

Engine: `predict` returns `currentBleed?: { point: ISODate; i80: Interval; confidence }`, the estimated last bleeding day of the open cycle's period, when all of these hold: `point` is after the open cycle's last logged period day (`open.end`); today is on or before `i80.hi`; and no flow log of "none" exists after `open.end` (the engine sees `history.logs`). Owner approved (2026-11-18): like Flo, the estimate stays even if she stops logging, until today passes its range or she logs "no flow"; the alternative (drop it after two days without a log) is more conservative but brings back the empty days testers complained about. Bleed length comes from her earlier cycles (up to the last 6 valid ones, `CycleRecord.bleedDays`): point = start + median − 1, 80% range from their spread; with fewer than 2 such cycles, point = start + 4 (the existing `DEFAULT_BLEED_DAYS` of 5) with range 4 to 7 days and confidence low. While `currentBleed` exists, the menstrual phase runs to its `point` instead of to `open.end`, so Today, the phase and the calendar agree. Not returned while suspended. Allowed with the hormonal IUD, since D-110 keeps period ranges there. Past days inside the range that she never logged stay drawn as estimates only while the range is current; once today passes `i80.hi` they are plain days again, so no past month keeps an estimated period.

Calendar: days after the last logged period day up to `currentBleed.point` get the dashed period ring; days from `point + 1` to `i80.hi` get the fainter dashed edge ring. A day the user logged as "no flow" is never drawn as estimated. Logging a later day turns it solid as today.

### 2. Cycle-day number

Option B replaces the D-101 badge with a small number above the date (see The cell): semibold up to today, regular weight after it, so future days read lighter while both stay at 4.5:1. New preference `calendarCycleDay` (default on) in Settings > Appearance: off hides every number and its legend entry. The cell's screen-reader label keeps saying the cycle day either way, and the day sheet keeps "Day N".

### 3. Past ovulation on the grid

Engine: new pure export `pastOvulations(history, settings): Array<{ cycleId; cycleStart; point; i80; basis; confidence }>`, one row per closed cycle (`nextStart` known) with quality `valid`:
- If the cycle has a biomarker estimate (from `analyzeCycles`), use it.
- Otherwise a retrospective calendar estimate: ovulation offset = cycle length − luteal mean − 1 (the luteal phase ends the day before the next period, D-098), SD = the luteal predictive SD, using the same `fitLuteal(lutealLengths(cycles))` as `predict`. With the next start known this is much narrower than the forward estimate.
- No row for a cycle that overlaps a hormonal IUD state (D-110 keeps ovulation off there); suspended cycles are already not `valid`.
- It does not write into `CycleRecord.ovulation`, so `lutealLengths`, guidance and flags read exactly what they read today.

App: the grid draws these with the estimate style above, on the same terms as the current one: only while ovulation estimates are shown (the existing `showOvulationEstimate` gate, so teen mode hides them), and only when the 80% range is narrow enough (the D-098 uncertain rule) unless the uncertain-estimates setting is on. The day sheet and day screen say "Ovulation estimate, 14–18 Oct (from your next period date)" or "(from your LH tests)" by basis. Past cycles get no fertile band.

### 4. Symptom dot and the month list

Grid: the grey "logged" dot becomes an accent dot on days with at least one symptom; other logged days keep the grey dot (both in the marks row under the circle). Legend: "Symptoms" and "Other log".

Month list (new, under the legend, headed by the month's name; owner: dates in it carry no month name, since the heading already says it, except a range that runs into another month, such as "24 Nov – 2 Dec"): one row per day of the shown month that has anything, in date order. A row has the date and short phrases joined by " · ", each estimate phrase marked as an estimate:
```
November
1       Period day 2 · Cramps (strong) · Headache (mild)
2 Today Period day 3 · Cramps (mild) · Energy low
3–5     Period likely ends · estimate from your usual length
6–20    Fertile window, estimate · most likely 10–15
14      Ovulation estimate, range 10–18 · medium confidence
26–30   Next period likely · at most 24 Nov – 2 Dec · medium confidence
```
Logged content uses the existing `shortDescribe` phrases. Estimates use the `dayEstimates` wording (D-104). The fertile window shows as one row with its range, never per day. Tapping a row selects that day (and updates the day sheet). Each row is one accessible element whose label reads the row. An empty month says so in one line.

### 5. See and remove what was logged

A shared `LoggedEntries` component lists a day's entries as chips, `Cramps (moderate) ✕`, each with a 44 pt target and the label "Remove: Cramps (moderate)". It appears in three places: the Calendar's day sheet, the top of the log sheet ("Logged on this day"), and the day screen, where it replaces the row-per-entry list with its Delete button and confirmation alert (supersedes the confirm step of D-075 / I-14).

Tapping ✕ removes the entry at once and shows a toast "Removed: Cramps (moderate)" with an **Undo** button for 6 seconds. Removal and Undo go through the same actions the log sheet uses, so every derived table (daily log, cycles) updates the same way: flow is cleared with `setFlow(..., 'none')`, a symptom with intensity 0, energy with 0; kinds without a clearing action are retracted. Undo retracts every event the removal wrote: the event log already treats a retracted retraction as restoring its target (`activeEvents`, `apps/mobile/src/data/project.ts`), so Undo brings back exactly what was there, including any period join answers `setFlow(..., 'none')` dropped, and stays append-only. The chips show the same entries the day screen lists today (`dayEvents`, which includes period start and end markers), so an imported period end or a split answer stays removable. `Toast` gains an optional action; with an action it stays 6 s and announces "Removed: …, Undo available" to the screen reader.

The day sheet is not one big button (the old selected-day card was): "Open day ›" opens the day screen, and the chips and Log are their own buttons.

The log sheet keeps tap-again-to-clear and press-and-hold; with the chip row at the top, nothing has to be discovered.

### 6. Show uncertain estimates (setting)

New preference `showUncertainEstimates`, default off, in Settings > Tracking under the ovulation estimate switch, with the description "Draw ovulation and fertile estimates even when your data is too irregular for a confident range. They are marked uncertain." Hidden while the ovulation estimate itself is off (teen mode included).

When on, `shownFertileDays` and the grid's ovulation mark no longer drop an uncertain estimate (D-098, D-106) on Today, the Calendar and the day screen; the day sheet and Today say "uncertain". Reminders, widgets and the .ics export ignore the setting. The engine is unchanged by this setting.

## Records

- DECISIONS: one entry per numbered part (next free ids from D-111), each with the alternative rejected; part 6 records the owner's override of D-098/D-106 for users who opt in, part 5 the end of the confirmation alert.
- PLAN §8.3, §8.5, §9.7 updated; BACKLOG items added (next free P8 ids) and ticked.
- Engine: `ENGINE_VERSION` minor bump, changelog row, requirements rows for `currentBleed` and `pastOvulations`, risk-register rows (a retrospective estimate read as a confirmed ovulation; an uncertain estimate relied on), `pnpm engine-hash`.
- Screenshots of the changed screens in `docs/screenshots/<item-id>/`, light and dark, and at 150% text.

## Left to the builder

- Exact sizes, spacing and colours within the rules above, the ring and dash patterns, and how the circle, the cycle-day number and the marks row fit the cell at 150% text.
- The day sheet's detents and how it behaves while the month swipes.
- How `currentBleed` reads the bleed lengths (from `CycleRecord.bleedDays`) and the exact percentile method for the 80% range.
- The month list's placement relative to the guidance summary card, and how many rows show before a "Show all".
- Which existing tests and Maestro flows need updating for the new marks, the glass toolbar and the day sheet that replaces the selected-day card.

## Same defect in the log sheet

The owner's note about the day sheet (a primary action that looks like the selected chips) applies to the log sheet too: its only action, **Done** at the top right, is plain accent text (`apps/mobile/src/features/logging/LogSheet.tsx:118`), while selected flow levels and chips use the accent tint, so nothing marks Done as the action that closes and keeps the entries. In the same work: Done becomes a filled, fully rounded accent capsule (iOS: the sheet toolbar's prominent tinted glass button; Android: a filled tonal button), and the selected chips keep their soft tint with no filled accent. Entries still save as they are tapped; Done only closes the sheet.
