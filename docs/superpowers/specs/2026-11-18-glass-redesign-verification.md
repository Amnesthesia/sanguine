# Glass redesign: verification of the built app against the frames

Date: 2026-11-18. Checked: `origin/main` at `c063fe0` (P8-23, the build published as the OTA), in the dev client on the iPhone 17 Pro Max simulator (iOS 26.4), against the approved frames in `docs/design/glass-redesign/frames/` (rendered with headless Chrome at 390 pt wide), the three 2026-11-18 specs and D-111 to D-129. Read-only on source; no tests or Maestro were run (owner's memory rule for this session).

Screenshots are in `docs/screenshots/P8-23-verify/` (cited below as `shots/<name>.png`, path relative to the repo: `docs/screenshots/P8-23-verify/<name>.png`). Seed data comes from `sanguine://dev/seed` scenarios, relative to the real date, so "today" in the build is Wed 18 Nov 2026 and the numbers differ from the frames' Mon 2 Nov sample; that is expected and not reported.

Each finding: id, severity, BUILD (the design says X, the app does Y) or DESIGN (the frame itself is wrong, contradicts the spec, a decision or the owner's feedback), the responsible file:line, and the screenshot.

## Summary

The structure of most screens matches the frames: Settings root, Tracking, Appearance, Notifications, Privacy, Life state, Report, Cycle detail, Insights History, Onboarding step 1 and the lock screen are close copies. The drift the owner keeps finding is concentrated in five places:

1. **Glass that does not blur.** The floating Log bar on Today and the Calendar's compact day bar are near-transparent Liquid Glass: the text of the cards and month-list rows scrolling beneath them is sharply legible through them and collides with the bar's own text. The frames draw a frosted 50% white with an 18 pt blur; the build uses the iOS 26 `regular` glass material with no tint, which does not frost. This is the "content showing through the Log today pill" the owner saw.
2. **Dark-mode primary buttons have black ink** (Done, Log today, Log this day, Continue, the calendar's round + button). The frames draw white ink; the code chose black because white on the dark accent fails 4.5:1, and nobody fixed the frame or the fill.
3. **Words the frames do not use**: symptom chips read "Bloating 2/3", "Cramps 1/3"; the legend says "Predicted period" and "Fertile window likelihood"; the ovulation caution still says "Calendar only"; the day screen says "Medium confidence" while Today and How say "fair estimate"; About still explains a "fertile-window underline" that no longer exists.
4. **States the frames never drew**: P8-23 (device feedback) replaced the frame's closed day card with a one-line compact bar, added past-cycle fertile bands (the calendar spec says "No fertile band in past months") and drag detents, with no frame, no decision record and no screenshots. The specs and frames now contradict the shipped app.
5. **Shapes**: the log sheet's flow and symptom options are 12 pt rounded squares in a four-column grid, where the frames (and the owner's "everything round" rule) draw flow circles and two-column symptom pills.

Two functional bugs surfaced along the way: the Report screen says "No complete cycles are logged yet" with two complete cycles logged, and the PDF uses the same filter (blocker); and at 150% text a logged chip runs off the screen so its ✕ cannot be reached.

Counts: **2 blocker, 15 major, 31 minor** (48 distinct findings; T1 and C1 are the per-screen instances of X1 and are not counted twice; 17 involve a DESIGN defect in the frames or specs, listed again in "Frames to fix").

### The five most serious

1. **X1, blocker**: floating glass (Today Log bar, Calendar compact bar) shows the content beneath sharply, text over text. `apps/mobile/src/ui/GlassBar.tsx:41-44`. `shots/today-logbar-ghosting-light.png`, `shots/calendar-period-light.png`.
2. **S7, blocker**: Report for a doctor says no complete cycles exist and the PDF filters the same way, so it carries no cycle table. `apps/mobile/src/app/settings/report.tsx:34`, `apps/mobile/src/features/report/report.ts:30`, root `apps/mobile/src/data/project.ts:160`. `shots/settings-report-light.png`.
3. **T2, major**: an uncertain ovulation estimate (hidden everywhere else unless "Show uncertain estimates" is on) still prints a single date and a 19-day range on Today through the fixed §2.3 sentence. `apps/mobile/src/features/today/todayModel.ts:105`. `shots/today-irregular-light.png`.
4. **X2, major**: dark-mode primary buttons with black ink. `apps/mobile/src/ui/Button.tsx:10`. `shots/log-dark.png`, `shots/onboarding-1-dark.png`.
5. **L1, major**: log sheet flow and symptom options are rounded squares, not the frame's circles and pills. `apps/mobile/src/features/logging/FlowSelector.tsx:22`, `SymptomGrid.tsx:27`, `apps/mobile/src/theme/index.tsx:37`. `shots/log-light.png`.

## Cross-cutting findings

| Id | Sev | Kind | What is wrong | Where | Shots |
| --- | --- | --- | --- | --- | --- |
| X1 | blocker | BUILD + DESIGN | Floating glass does not frost. Today's Log bar and the Calendar's compact bar let the text beneath show through sharply ("Ovulation: rough estimate", "Estimated ovulation around 23 Nov", month-list rows), overlapping the bar's own text; the grabber sits on month-list text. Frames: frosted white (≈50% tint, blur 18). Build: `GlassView glassEffectStyle="regular"` with no tint, which on iOS 26 is a clear lens, not a frosted material. The spec contradicts itself ("mocked as blur 18" vs "the system material"), so the frame promised a look the chosen material cannot give. The spec's own contrast rule ("4.5:1 with the busiest content scrolled beneath") fails. | `apps/mobile/src/ui/GlassBar.tsx:41-44`; users `features/today/QuickLogRow.tsx`, `features/calendar/DaySheet.tsx:119-135` | `today-logbar-ghosting-light.png`, `today-typical-light.png`, `calendar-period-light.png`, `calendar-typical-light.png`, `today-typical-150.png` |
| X2 | major | BUILD + DESIGN | Dark mode: every filled primary has black ink on `#D4607A` (Done, Log today, Log this day, Continue, Unlock, the calendar's round +). Frames Today-Dark, Calendar-Dark and Onboarding-Dark draw white ink. White on `#D4607A` is about 3.4:1, so the frames fail 4.5:1 for 17 pt semibold; the code fixed contrast by switching ink instead of darkening the fill, and the frame was not updated. | `apps/mobile/src/ui/Button.tsx:10`; `features/calendar/DaySheet.tsx:79`; `features/today/QuickLogRow.tsx:39` | `log-dark.png`, `day-dark.png`, `onboarding-1-dark.png`, `today-period-dark.png`, `calendar-period-dark.png` |
| X3 | major | BUILD | Symptom intensity shown as a fraction: "Bloating 2/3", "Cramps 1/3" in every logged chip (Today, log sheet, day screen, calendar sheet). Frames: "Cramps (mild)". Plain-language rule. | `copy/en-AU.json:329` (`day.entry.symptom` = "{name} {n}/3"); `apps/mobile/src/features/logging/describe.ts:14` | `day-light.png`, `day-150.png` |
| X4 | major | BUILD | Source numbers are not superscript: "worldwide.1", "for you.2" sit on the baseline. A `transform` on a nested `<Text>` is ignored on iOS. | `apps/mobile/src/ui/Sources.tsx:7` | `day-light.png`, `day-dark.png` |
| X5 | major | DESIGN + BUILD | "Calendar only: no LH tests or temperatures this cycle" names the method by jargon (owner: no "calendar" as a basis word). The frames carry the same word (Today-Typical "Calendar only" tag, Calendar-3 caution, Insights-History "ovulation: calendar"). Insights and cycle detail were already fixed ("Estimated from cycle lengths only"); the caution was not. | `copy/en-AU.json:1284` (`calendarOnly`) | `day-light.png`, `day-future-light.png` |
| X6 | minor | BUILD (cause not confirmed) | Changing the text size while the app runs leaves stale layout: clipped glyphs ("Today" title cut, "Log tc") after going to 150%, oversized cards and pills after going back, until the app is relaunched. After a relaunch 150% renders correctly. | Probably `apps/mobile/src/ui/Text.tsx:23` (fixed `lineHeight` per variant) with cached layout; not traced | `insights-after-textsize-change-light.png` |
| X7 | minor | BUILD | Toolbar titles wrap to two lines ("Notifications and widgets", "How Sanguine estimates"; the day title at 150%; the log header to three lines at 150%). The title gets `flex: 3` of five, between two `flex: 1` slots. Frames: one line. | `apps/mobile/src/ui/GlassBar.tsx:61` | `settings-notifications-light.png`, `settings-how-light.png`, `log-150.png`, `day-150.png` |
| X8 | minor | BUILD | Back is a bare chevron; frames draw a 44 pt round white/glass button. | `apps/mobile/src/ui/BackButton.tsx:20` | any pushed screen, e.g. `settings-appearance-light.png` |
| X9 | minor | DESIGN | The system tab bar marks the current tab with a grey pill and rose glyph; the frames draw a rose-tinted pill. iOS ignores `indicatorColor` (the code's own comment). The frame draws something the native tab bar cannot do. | `apps/mobile/src/app/(tabs)/_layout.tsx:26-32` | `today-typical-light.png` |
| CON1 | major | DESIGN + BUILD | Two vocabularies for one confidence grade: Today and How use "fair estimate / rough estimate" (How defines Confident, Fair estimate, Rough estimate, No estimate); the day screen and expanded sheet say "Medium confidence / Low confidence". Frames do the same split (Today-Typical vs Calendar-3). | `copy/en-AU.json:1269` (sections confidence "Medium confidence", used by `features/guidance/sections/EstimateSections.tsx:22` `CardHead`) vs `features/today/cards.tsx:81` (`confidence.*` words) | `day-light.png` vs `today-typical-light.png` |
| CON2 | minor | DESIGN | Flow chip label differs between frames ("Medium flow" on Today and Calendar-1, "Flow: medium" on Calendar-2 and Log-Sheet, "Flow: heavy" on Day-Screen). The build uses "Medium flow" everywhere, which is fine; the frames should agree. | frames | — |
| CON3 | minor | BUILD | "Today" is an accent ring on the grid and the dial but a black outlined capsule in the day screen's ovulation strip. | `features/guidance/sections/EstimateSections.tsx` (cycle strip) | `day-future-light.png` |

## Today (frames Today-Period, Today-Typical, Today-Irregular-Flag, Today-Empty, Today-Pregnant, Today-Dark)

Matches: large title and date, the dial (track, ticks, rounded period arc, dashed next-period arc, graded fertile band, ovulation point, today knob), the centre text, the legend line, the headline card, logged chips with ✕, glass estimate cards over the wash, the floating Log bar layout, the paused ring for pregnancy. P8-23 already fixed the rose "Fertile window" pill (now green-tinted, `features/today/CycleDial.tsx:88`) and the black Log button.

| Id | Sev | Kind | What is wrong | Where | Shots |
| --- | --- | --- | --- | --- | --- |
| T1 | (X1) | BUILD | = X1 on Today: the Log bar shows the ovulation card's text through it. | `features/today/QuickLogRow.tsx`, `ui/GlassBar.tsx:41-44` | `today-logbar-ghosting-light.png` |
| T2 | major | BUILD (open decision D-127) | Irregular user, "Show uncertain estimates" off: the card is titled "Ovulation estimate uncertain" (words only, as D-127 allows) but the always-visible fixed §2.3 sentence is filled with a point and range: "Estimated ovulation around 23 Nov (range 14 Nov–2 Dec)". D-098/D-115 hide a range over 12 days everywhere else. The frame shows only the placeholder "[Fixed regulatory wording]", so the conflict was never visible in design. The fixed wording cannot change, so the conservative option is to not render the card while the estimate is uncertain and the setting is off (D-127's rejected alternative). | `apps/mobile/src/features/today/todayModel.ts:96-106`, `features/today/cards.tsx:118` | `today-irregular-light.png` |
| T3 | minor | DESIGN | The frames still draw the rose pill naming the green fertile window (Today-Typical) and a rose "Rough estimate" pill (Today-Irregular-Flag). The build is right (green / neutral); the frames are wrong. | frames | `today-typical-light.png` |
| T4 | minor | BUILD | Empty state: the bare track has no day ticks; Today-Empty draws ticks. | `features/today/CycleDial.tsx` (empty branch) | `today-empty-light.png` |
| T5 | minor | BUILD | Pregnant: the Log bar has no second line (frame: "Pregnant"); the due-date range has no year although it falls next year ("16 Jun – 21 Jul"; frame "31 May – 5 Jul 2027"). | `features/today/QuickLogRow.tsx`, `features/today/pregnancyModel.ts` | `today-pregnant-light.png` |
| T6 | minor | DESIGN | Dark: the dial legend's "Estimate" swatch (period red over black at the estimate alpha) is nearly invisible (below 3:1 non-text contrast). Today-Dark draws the same. | `features/today/CycleDial.tsx:79` | `today-period-dark.png` |
| T7 | minor | DESIGN | The headline card ("Day 2 of your period · Logged: medium flow") repeats the chip directly under it ("Medium flow ✕"). The frames do the same. | `features/today/cards.tsx:84-91` | `today-period-light.png` |

## Calendar (frames Calendar-1-Closed, Calendar-2-SheetOpen, Calendar-3-SheetExpanded, Calendar-Dark)

Matches: glass toolbar with month, ‹ ›, weekday row; 36 pt circles with the cycle day above; solid period discs; dashed rings for the period in progress (19, 20 Nov in `calendar-period-light.png`); graded fertile band with its solid lower edge; ovulation point as a white disc with a blue glow; symptom and other-log dots; legend; month list. The "Today" pill uses `textOnGlass` (correct per D-117; the frame's rose text on glass fails at 2.4:1, see C8).

| Id | Sev | Kind | What is wrong | Where | Shots |
| --- | --- | --- | --- | --- | --- |
| C1 | (X1) | BUILD | = X1 on the compact bar: month-list rows ("Ovulation estimate, range 21 Oct – 7 No…", "Period day 2 · Medium flow") read through the bar and cross its line "Day 2 of your cycle · Period". | `features/calendar/DaySheet.tsx:115-136`, `ui/GlassBar.tsx` via `SheetMotion.tsx` | `calendar-period-light.png`, `calendar-typical-light.png`, `calendar-period-dark.png` |
| C2 | major | DESIGN | The closed state is no longer the frame's day card (date title, logged chips, an "Estimates" well with meters): P8-23 shipped a one-line compact bar (disc, "Day 11 of your cycle", round +). No frame, no decision record, no screenshot covers the compact bar, the drag between detents or the past-cycle bands (C9). The owner is comparing the app to frames that no longer describe it. | `features/calendar/DaySheet.tsx:115-136`, `SheetMotion.tsx`, `sheetSnap.ts` (P8-23) | `calendar-typical-light.png` |
| C3 | major | BUILD + DESIGN | Next-period rings have the wrong visual priority. The 95% edge day inside the month (30 Nov: thin dashed, full opacity) looks stronger than the 80% days in the next month (3–6 Dec: thicker dashed but at the 40% out-of-month opacity). 80% and 95% differ only by 1.5 pt vs 1 pt in the same red; the legend has one entry ("Predicted period") and nothing explains the fainter ring. The frame avoids the case (its 80% range sits in the month) and never draws the 95% edge. | `features/calendar/DayCellView.tsx:33` (ring), `:52` (opacity 0.4 out of month); legend `app/(tabs)/calendar.tsx:154` | `calendar-nextperiod-rings-light.png`, `calendar-typical-light.png` |
| C4 | minor | BUILD | Legend wording and length: "Predicted period" and "Fertile window likelihood" (frame: "Period, estimate", "Fertile window, estimate"); two extra caption lines ("Solid means you logged it…", "darker = more likely…") make the legend five lines against the frame's three. "likelihood" is jargon. | `copy/en-AU.json:353-354, 360, 178`; `app/(tabs)/calendar.tsx:180-189` | `calendar-typical-light.png` |
| C5 | major | BUILD | Pregnant (estimates paused): cells show cycle days 33–62 and the bar says "Day 50 of your cycle" while Today says "Week 7, day 0"; the legend lists "Fertile window likelihood" and "Ovulation estimate" though nothing is drawn (the filter only checks `ovulationHidden`; D-118 says the legend follows what is drawn). | `features/calendar/calendarModel.ts:68` (`showCycleDay`), `DaySheet.tsx:78`, `app/(tabs)/calendar.tsx:154` | `calendar-pregnant-light.png` |
| C6 | minor | BUILD | The other days of the ovulation 80% range get short solid dashes, not the frame's dotted line: a single-side `borderStyle: 'dotted'` is drawn solid on iOS. | `features/calendar/DayCellView.tsx:71` | `calendar-typical-light.png` |
| C7 | major | BUILD | Month list: the date column is 56 or 92 pt depending on that row's label, so the text column jumps between rows; a cross-month range wraps to "27 Oct –" / "7 Nov"; heading "November 2026" (frame "November"). The owner flagged the list's padding. | `features/calendar/MonthList.tsx:42-43` | `calendar-period-light.png`, `calendar-typical-light.png` |
| C8 | minor | DESIGN + BUILD | Weekday header "Mon Tue Wed" (frame "M T W"). The frame's toolbar "Today" in rose text on glass fails contrast (D-117); the build's dark text is right and the frame should change. | `app/(tabs)/calendar.tsx:144` (weekday row) | `calendar-typical-light.png` |
| C9 | minor | DESIGN | Past cycles now draw a full fertile band (P8-23, "owner"), contradicting the calendar spec's non-goal "No fertile band in past months" and D-118. Nothing records the reversal (no D-entry, no BACKLOG item); the band rule is rebuilt in app code (`pastFertileDays`) rather than in the engine with its golden fixtures. | `features/calendar/calendarModel.ts` (`pastFertileDays`) | `calendar-period-light.png` (27 Oct – 7 Nov) |
| C10 | major | DESIGN | Calendar-2's small detent has two buttons that both say details: "Show details" (expand) and "Details" (open the day screen). The owner reported duplicate Details buttons. The build now has "Show details" in the small detent and "Open day" in the large one (`DaySheet.tsx:148-151, 167`); the frame was not corrected. Built sheet states not reachable without a tap. | frame Calendar-2-SheetOpen | — |
| C11 | minor | DESIGN | Dark: the ovulation point is a black disc with a faint blue glow on black (also in Calendar-Dark); hard to see. | `features/calendar/DayCellView.tsx:25,32` | `calendar-period-dark.png` |
| C12 | minor | BUILD | The bar's disc for today is white with a rose ring, while the same day in the grid is accentSoft-filled (selected): "styled like its grid cell" is not met. | `features/calendar/DaySheet.tsx:125` (`selected={false}`) | `calendar-typical-light.png` |

## Log sheet (frames Log-Sheet-Empty, -Filled, -More, -Contraception, Log-Period-Question)

Matches: sheet chrome, glass header with ‹ › and the filled Done capsule, "Today · Day 11 · Saved", "Logged on this day" chips, white section cards, the energy slider with "Not logged" and five labelled steps.

| Id | Sev | Kind | What is wrong | Where | Shots |
| --- | --- | --- | --- | --- | --- |
| L1 | major | BUILD | Flow levels are four rounded squares (radius 12) and symptoms a four-column grid of rounded squares with dots below. Frames: flow as circles, symptoms as two-column pills with the intensity dots on the right. Owner rule: every control a pill or a circle. | `features/logging/FlowSelector.tsx:22`, `features/logging/SymptomGrid.tsx:27`, `theme/index.tsx:37` (`tile: 12`) | `log-light.png`, `log-dark.png`, `log-150.png` |
| L2 | major | BUILD | At 150% a long logged chip ("Temperature 36.42 °C · 06:40 · Oral") runs past the screen edge and its ✕ is off screen, so it cannot be removed. Same chip on Today and the day screen. | `apps/mobile/src/ui/LoggedChip.tsx:10-12` (no `maxWidth`, label without `flexShrink`) | `log-150.png` |
| L3 | minor | BUILD | Header date wraps to three lines at 150% (X7). | `features/logging/LogSheet.tsx` header | `log-150.png` |

## Day screen (frames Day-Screen, Day-Screen-Future)

| Id | Sev | Kind | What is wrong | Where | Shots |
| --- | --- | --- | --- | --- | --- |
| D1 | major | DESIGN (owner decision) | The frame's day screen has a short "Estimates for this day" card (lines with meters) and then "Food and movement" with "What is changing". The build shows the full explanatory cards (Next period with the range bar and "How it was worked out", Ovulation and fertile window strip, sources) on every day, identical to the expanded sheet, so a single day reads like an article. Owner decision (this session's brief): move the explanatory estimate cards, the hormone curve, the evidence key, sources and the full food and movement into a new Insights "This cycle" segment, keeping a compact hormone curve in the sheet. | `app/day/[date].tsx:82`, `features/guidance/sections/EstimateSections.tsx`, `GuidanceSections.tsx` | `day-light.png`, `day-future-light.png` |
| D2 | minor | BUILD | "Log this day" floats without the plus icon (frame "+ Log this day") and covers the caution panel below it at rest. | `app/day/[date].tsx:68` | `day-light.png` |
| D3 | minor | BUILD | Future day: "You can log this day once it arrives." sits at the very bottom (frame: a card at the top); the range bar has no "this day" marker. | `app/day/[date].tsx:84`; `EstimateSections.tsx` | `day-future-light.png` |
| D4 | minor | BUILD | Copy: "Most likely ends 20 Nov, around 20 Nov." when the range is one day; "Your own cycles (2 used)" where the frame names the lengths ("28 and 28 days"); the period-end strip has no weekday labels (frame: Sat, Sun, Today…). | `features/guidance/sections/EstimateSections.tsx` | `day-dark.png`, `day-light.png` |

## Insights and cycle detail (frames Insights-History, -Charts, -Accuracy, -Irregular, -Empty, -Pattern, Cycle-Detail)

History matches the frame (glass toolbar with title and segmented control, one card per cycle, "current"/"typical" tags). The new ovulation wording is in: "Ovulation estimate 18–29 Nov" (the frame still says "ovulation: calendar", X5). Cycle detail matches (`cycle-detail-light.png`).

| Id | Sev | Kind | What is wrong | Where | Shots |
| --- | --- | --- | --- | --- | --- |
| I1 | minor | BUILD (cause not confirmed) | The segmented control's labels stay at the default size at 150% while everything else scales. | `apps/mobile/src/ui/Segmented.tsx` (`@expo/ui` Picker) | `insights-150.png` |

## Settings (frames Settings-*)

Root, Tracking, Appearance, Notifications, Privacy, Backup, Report and Life state match in structure, rows, round rose icons, switches and chips.

| Id | Sev | Kind | What is wrong | Where | Shots |
| --- | --- | --- | --- | --- | --- |
| S1 | minor | BUILD | Appearance: the cycle-day preview's middle disc lacks the today ring the frame draws. | `app/settings/appearance.tsx` | `settings-appearance-light.png` |
| S2 | minor | BUILD | Notifications: "Your reminders" is a 22 pt section heading; the frame uses the small section label. | `app/settings/notifications.tsx` | `settings-notifications-light.png` |
| S3 | minor | BUILD | How: card headings are 22 pt and wrap to two lines (frame 17 semibold, one line); the "(Bull et al. 2019)" citation has no number. | `app/settings/how.tsx` | `settings-how-light.png` |
| S4 | major | DESIGN + BUILD | About's "How to read estimates" says "A darker fertile-window underline means more likely…": the calendar draws a band now, not an underline. The frame copies the old text. Wrong instructions for reading the calendar. | `copy/about.en-AU.json:3` | `settings-about-light.png` |
| S5 | minor | BUILD | Privacy: export shows the download glyph and import the upload glyph, the reverse of the frame. | `app/settings/privacy.tsx:75-76` | `settings-privacy-light.png` |
| S6 | minor | BUILD | Backup: passphrase fields are grey fills (frame: white with a hairline); "CLOUD COPY" in capitals (frame "Cloud copy"); the primary has no shield icon. | `app/settings/backup.tsx` | `settings-backup-light.png` |
| S7 | blocker | BUILD (pre-existing, P8-6) | Report: "No complete cycles are logged yet." with two complete cycles (Insights lists 12 Sep · 28 days, 10 Oct · 29 days). `history.cycles` are raw records without `length` (`project.ts:160`); the screen and `buildReport` both keep only records with a `length`, so the PDF has no cycle table. The unit test hand-builds records with `length` (`report.test.ts:7`), so it passes. The PDF itself was not opened. | `app/settings/report.tsx:34`, `features/report/report.ts:30`, `data/project.ts:160` | `settings-report-light.png` |
| S8 | minor | BUILD | Report: the primary has no share icon (frame has one). About: "Check for updates" is a grey pill with rose text and no icon (frame: white pill, refresh icon, dark text). | `app/settings/report.tsx`, `app/settings/about.tsx` | `settings-report-light.png`, `settings-about-light.png` |
| S9 | minor | BUILD | Life state: the selected row has no accentSoft fill (frame fills it). | `apps/mobile/src/ui/OptionList.tsx` | `settings-lifestate-light.png` |

## Onboarding and lock (frames Onboarding-1 … -Dark, Lock-Screen)

Step 1 matches (step platter, title, body, glass footer with one Continue). The lock screen matches (lock glyph in a rose circle, title, body, Unlock pill under the system Face ID prompt).

| Id | Sev | Kind | What is wrong | Where | Shots |
| --- | --- | --- | --- | --- | --- |
| O1 | minor | BUILD | Step titles are semibold at about 26 pt; the frames draw a heavier 28 pt bold. Dark Continue has black ink (X2). | `features/onboarding/OnboardingFlow.tsx` | `onboarding-1-light.png`, `onboarding-1-dark.png` |
| K1 | minor | BUILD | Unlock has no Face ID glyph (frame has one). | `features/lock/LockGate.tsx:51` | `lock-light.png` |

## Frames to fix (DESIGN defects)

X1 (glass recipe vs the system material), X2 (white ink on the dark accent), X5 ("Calendar only", "ovulation: calendar"), X9 (tinted tab pill), CON1 (two confidence vocabularies), CON2 (flow chip label), T3 (rose pill for the fertile window and for "Rough estimate"), T6 (dark estimate swatch), T7 (headline repeats the chip), C2 (compact bar, drag states and past bands never drawn), C3 (95% edge never drawn), C8 (rose "Today" on glass), C9 (spec still says no past bands), C10 (Show details + Details), C11 (dark ovulation disc), S4 (underline), D1 (day screen content, superseded by the owner's decision).

## What I could not verify

Without a tap tool, anything behind a tap, a drag or a scroll was not reached:
- Calendar: the small and large detents of the day sheet, dragging between them, tapping a day or a month-list row, month swipe, the dark sheet.
- Today below the first screen: food and movement tiles, "Read more" and its sheet, the flag card, the regulatory footer.
- Insights Charts, Accuracy, Pattern, Irregular and Empty segments (segmented control needs a tap).
- Log sheet: More rows expanded, Contraception, the period question, the Undo toast after ✕.
- Settings below the first screen (Tracking's switches, Notifications' widgets block, Privacy's consent and delete, How sections 2–5, About's sources), Health, Legal, Calendar export, the backup restore, other-phone and recovery-code states; Settings in dark and at 150%.
- Onboarding steps 2–5 and their variants (need taps); lock screen in dark; Splash; widgets and notifications.
- Today-Suspended (no seed scenario for a paused non-pregnancy state) and teen mode.
- The report PDF's content (S7 is read from the code and the screen's own message).
- A physical iPhone: Liquid Glass on device can differ from the simulator; Android not checked at all.

## Root cause: why the build drifted

1. **No frame-to-build comparison happened.** CLAUDE.md requires screenshots in `docs/screenshots/<item-id>/`; `docs/screenshots/P8-22-devclient/` is empty and P8-20, P8-21 and P8-23 have no folder. Nothing shows that any screen was ever put next to its frame on the simulator before PR #1 and #2 merged.
2. **The tests check structure on react-native-web, where the native pieces are mocked.** `GlassView` does not exist under vitest, so tests cover the opaque fallback (`ui/glassSurfaceFailure.test.tsx`), never the real material; the iOS 26 glass that lets text through (X1) could not fail a test. Contrast tests assert "≥ 4.5:1", which black ink satisfies, so the swap away from the frame's white ink (X2) passed. The same class shows up in data: `report.test.ts` hand-builds cycle records with `length`, a field the app never supplies (S7).
3. **The frames promised a CSS material the platform does not render.** The spec says both "mocked as blur 18" and "use the system material"; nobody checked on a device which one wins.
4. **The frames contain their own defects** (rose pill for a green window, accent text on glass, white ink on the dark accent, "calendar" jargon, two "details" buttons). Lanes quietly fixed some in code and copied others, and never fed the fixes back into the frames, so the owner sees drift in both directions.
5. **Device-feedback changes skipped the design records.** P8-23 changed the closed sheet, added detents and past fertile bands with no frame, no DECISIONS entry, no BACKLOG item and no screenshots; the calendar spec still says the opposite.
6. **The UI kit had no "option chip" primitive matching the frames**, so the log lane reused a 12 pt tile radius from the theme (L1); copy keys from older screens ("{name} {n}/3", "Predicted period", "Medium confidence") were reused instead of the frames' words, and nothing compared copy against the frames.
7. **Dynamic Type was checked at launch at most**, not while changing size, and long chips at 150% were never seen (L2, X6).

## Prevention

- **A screen-verification harness, run per UI PR** (fix plan Task 1): dev-only deep-link parameters that open every frame's state without a tap (calendar day and sheet detent, Insights segment, scroll anchor, log-sheet section), and a script that renders each frame with headless Chrome and screenshots the matching state on the simulator, light, dark and 150%, side by side, into `docs/screenshots/<item-id>/`. The manifest maps frame → seed → deep link.
- **A check, not a sentence**: a script in CI (or a pre-push hook) that fails when a commit names a UI backlog item (P8-xx touching `apps/mobile/src/app` or `features/**/*.tsx`) and `docs/screenshots/<id>/` has no images.
- **Copy tests**: extend the forbidden-word test over `copy/*.json` to reject fraction intensities (`/\{n\}\/3/`) and "calendar" as a method word, and to require one confidence vocabulary.
- **Fixture rule**: screen and report tests build history through `project()` (the runtime path), never hand-made records with derived fields.
- **Frames follow the code**: any deliberate deviation from a frame (owner feedback, contrast fix, platform limit) updates the frame and adds a DECISIONS entry in the same PR.

## Re-check (2026-11-18, after the fix plan)

Source: `docs/superpowers/plans/2026-11-18-glass-redesign-fix-plan.md` (Tasks 1 to 12 written, Task 13 partly done), the implementers' reports, `git status` and the images in `docs/screenshots/P8-35/`. Decisions: D-130 to D-147; backlog P8-24 to P8-35.

**What was seen on a simulator.** Only the five light-theme images in `docs/screenshots/P8-35/`. Three show the build: `Calendar-3-SheetExpanded-light.png`, `Log-Sheet-Filled-light.png` and `Insights-This-Cycle-light.png`. In `Calendar-1-Closed-light.png` and `Today-Typical-light.png` the build side is the Expo development launcher, not the app (the app was not in the foreground), so those two screens were not seen. The machine then ran out of memory and no further run was possible. Everything marked "in code" below is covered by unit tests (vitest, react-native-web, where the native glass, SVG and segmented control are mocked) and has not been looked at; the implementers ran only the tests of the files they touched, and the controller's type-check, lint and full-suite run is not recorded here. No dark-theme, 150% or Android image exists for any fix.

Status words: **seen fixed** (visible in a P8-35 build image), **fixed in code, not seen** (changed and unit-tested, no image of the build), **frame fixed** (a DESIGN defect corrected in the frames or specs, checked in a headless-Chrome render in `docs/screenshots/P8-27/`), **not done**.

| Id | Status | Note |
| --- | --- | --- |
| X1 | fixed in code, not seen | `GlassSurface legible` tint at `LEGIBLE_ALPHA` 0.94 (D-130; 0.72 was seen to fail). Wired into toolbars, the calendar toolbar, the Log bar and the day bar. Never seen at 0.94. Toast, log-sheet header and onboarding footer are the same class and were not changed or checked. |
| X2 | seen fixed (light), dark not seen | White ink on `#BC4560` visible on "Log this day" and Done (`Calendar-3-SheetExpanded-light.png`, `Log-Sheet-Filled-light.png`). Dark `#BB546B` is in code only. Android roles unchanged (D-131). |
| X3 | fixed in code, not seen | "Cramps (mild)" in copy and `describe.ts`; the P8-35 build images log no symptom. |
| X4 | seen fixed | "for you.²" is raised in `Insights-This-Cycle-light.png`. |
| X5 | seen fixed (Insights), frames fixed | The caution reads "Worked out from your period dates only: no ovulation tests or temperatures this cycle". The day screen and Today were not seen. |
| X6 | fixed in code, not seen | `key={fontScale}` remount in `ui/Text.tsx` (D-141); the cause was never confirmed. `TextField`, the error screens and `DayCellView` are not covered. |
| X7 | fixed in code, not seen | Toolbar titles shrink to one line; the log header date is one line at 100% in the P8-35 image. 150% and the long Settings titles not seen. |
| X8 | fixed in code, not seen | 44 pt round Back; no pushed screen was captured. |
| X9 | frame fixed | The grey tab selection is drawn in the frames; the build was never different (the build images show the grey pill). |
| CON1 | seen fixed (Insights) | "Fair estimate" and "Rough estimate" in the This-cycle cards. Day screen and sheet rows not seen with the new words. |
| CON2 | frame fixed | A sweep of the frames finds no "Flow: medium". |
| CON3 | not done | The day screen strip's "Today" capsule was in no task; not checked. |
| T1 | = X1 | |
| T2 | closed by owner ruling | Owner, 2026-11-18: an uncertain ovulation estimate may show its date. Build unchanged on purpose (D-127 answered, D-133). |
| T3 | frame fixed | |
| T4 | fixed in code, not seen | 28 ticks on the empty dial. |
| T5 | fixed in code, not seen | Log bar second line, year in the due range. |
| T6 | fixed in code, frame fixed, not seen | `estimateSwatch` dark `#A3485C` (3.64:1). |
| T7 | frame fixed, build not done | The frames dropped the "Logged: medium flow" line under the headline card; `HeadlineCard`'s subtitle still shows it. |
| C1 | = X1 | |
| C2 | frames and records done, build not seen | `Calendar-Bar-Compact`, `Calendar-Drag-States`, `Calendar-Past-Bands`, D-144 to D-145. The bar itself was not seen (the Calendar-1 capture shows the launcher). The mid-drag panel cannot be reached by a link. |
| C3 | fixed in code, not seen | 2 pt dashed and 1 pt dotted rings, text-only fade out of month (D-136). The 30 Nov / 3 Dec case was not re-checked. |
| C4 | fixed in code, not seen | Legend wording and caption; the month list in the Calendar-1 capture was the frame's, not the build's. |
| C5 | fixed in code, not seen | Paused state: no cycle days, no fertility legend. The harness has no pregnant calendar row. |
| C6 | fixed in code, not seen | Four dots for the ovulation range; whether iOS draws the 1 pt dotted ring correctly is unchecked. |
| C7 | fixed in code, not seen | One date column, month name heading. |
| C8 | fixed in code and frame fixed, not seen | Single-letter weekdays. |
| C9 | recorded | Spec and D-145. The rule still lives in app code (`pastFertileDays`), not the engine. |
| C10 | frame fixed; large detent seen | "Open day" beside "Log this day" at the large detent (`Calendar-3-SheetExpanded-light.png`). The small detent was not seen. |
| C11 | fixed in code, frame fixed, not seen | Dark ovulation disc with a solid blue rim. |
| C12 | fixed in code, not seen | The bar's disc is the selected cell. |
| L1 | seen fixed (light, 100%) | Flow circles and two-column pills in `Log-Sheet-Filled-light.png`. |
| L2 | fixed in code, not seen at 150% | The temperature chip fits at 100%. |
| L3 | fixed in code, not seen at 150% | |
| D1 | fixed in code; sheet seen, day screen not | The slim large detent (compact curve, "More about this cycle ›") is in `Calendar-3-SheetExpanded-light.png`; the build shows no estimate rows there, which `cycleHeadlines` (D-137) was written to fix after the image was taken. This cycle is seen in `Insights-This-Cycle-light.png`. |
| D2 | fixed in code, not seen | |
| D3 | fixed in code, not seen | "This day" marker only when the day falls inside the range bar. |
| D4 | partly done | One-day sentence and weekday labels in code, not seen. "Your own cycles (2 used)" still does not name the lengths (visible in `Insights-This-Cycle-light.png`). |
| I1 | fixed in code, unconfirmed | A Dynamic Type text style on the picker labels; the native control may ignore it. Four segments fit at 100% (`Insights-This-Cycle-light.png`); 150% not seen. |
| S1, S2, S3, S5, S9 | fixed in code, not seen | |
| S4 | fixed in code, frame fixed, not seen | About copy says band; About not seen. |
| S6 | fixed in code, not seen | Backup uses a local `TextField` (D-140), to be replaced by a shared tone. |
| S7 | fixed in code, not seen | `closedCycles` helper and a `project()`-based test (D-139). Neither the screen with seeded data nor the PDF was opened. |
| S8 | partly done | About's pill done; Report's share icon not done. |
| O1, K1 | fixed in code, not seen | Lock screen's failure icon (outside the list) not done. |

**Open from this check.**
- Screens the controller could not re-verify, all of them: Today (all states, dark, 150%), Calendar closed bar, small detent, drag, past bands, pregnant state, dark and 150%; Day screen and Day screen future; the This-cycle segment in dark, at 150% and in teen mode; the log sheet at 150%, dark, empty and More; every Settings screen; Onboarding; the lock screen; Insights History, Charts and Accuracy; the report PDF; the text-size change while running (X6). Android and a physical iPhone were never checked.
- `Calendar-1-Closed-light.png` and `Today-Typical-light.png` need retaking with the app in the foreground.
- Seen in the images but not in the report: the Today title and clock overlap behind the log sheet's top edge in `Log-Sheet-Filled-light.png` (not investigated).
- The new frames and the slimmer screens were approved by the fix plan's controller, not by the owner; the owner's look is still to come (redesign spec, "Owner approval").
- D-129 (About's fertile-window wording shown to under-18s) is still open.
- Harness gaps (D-142): rows for a pregnant calendar, a past-month calendar, teen This-cycle and a paused-state seed scenario; `run.sh` has never run end to end.
- Maestro flows that name the removed Today sheet and sheet sections are stale (`today.yaml`, `calendar.yaml`, `calendar-guidance.yaml`); the suite was not run in this work.
- To check the text-size fix (X6): seed `typical`, open Today at the default size, run `xcrun simctl ui 1C4C0CE9-4A7A-441F-8FCA-5EDBD373D757 content_size accessibility-medium` with the app still running, screenshot, then `content_size large`, screenshot, and compare with a relaunch at the same size.
