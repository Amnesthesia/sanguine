# UI and UX review (2026-10-10)

Basis: the iOS dev-client screenshots in `docs/screenshots/suite-p4-devclient` (47 states), the 150% font-scale set in `docs/screenshots/P2-14`, the dark-mode set, and `docs/mockups.html`, read against PLAN.md §8 (UX spec), §9 (design system) and the brand rules in `docs/CLAUDE.md`. Android was not re-screenshotted (owner's rule: iOS-only until the P3-14 pass); the Android notes come from the P3-1 set and are marked.

## 1. Overall

The app does what §8.1 asks: one fact per screen, ranges everywhere, neutral register, nothing gamified. The calendar is the strongest screen and already a better uncertainty drawing than the mockup. The weaknesses are consistency and density: a large dead band above every tab title, three different ways to show a "secondary action", a few places where the same fact is printed twice, and sparse-data states in Insights that look broken rather than early.

Priority key: **P1** fix before store screenshots, **P2** fix before launch, **P3** polish.

## 2. Cross-cutting

| # | Pri | Issue | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
| 1 | P1 | **Dead space above tab titles.** Each tab draws its title about 190 pt below the status bar; the top 16% of the screen is empty on Today, Calendar, Insights, Settings. It is the safe-area inset plus 8 pt plus the title's own top margin stacked on a large-title style with no navigation bar. | `ios-today.png`, `ios-month.png`, `ios-index.png` | In `ui/Screen.tsx` drop the extra `paddingTop` when there is no header and let the large title sit at the system large-title position (about 44 pt below the status bar). Or adopt the native large-title header from expo-router native stacks so the title collapses on scroll, which is what the mockup shows. |
| 2 | P1 | **Secondary actions in three styles.** "Cycle details" is a centred bold text label inside a card; "Edit · Details" on the Calendar day card are left-aligned text buttons; "Learn more · Mute for 90 days" on the flag card are text buttons again; "Back" is a bare word at the top-left with no chevron. | `ios-history.png`, `ios-month.png`, `ios-irregular-flag.png`, `ios-day-detail.png` | One rule: text buttons in the accent colour, left-aligned, 44 pt tall; the Back control uses the system chevron + "Back" (or the native stack header). Make "Cycle details" the whole-card tap target with a trailing chevron, as the Settings rows do. |
| 3 | P2 | **Accent text buttons sit on the same baseline as body text.** On the day card and the flag card the actions read as labels until tapped. | `ios-month.png`, `ios-irregular-flag.png` | Give text buttons the accent colour (they are currently black/ink) and 12 pt top padding; the accent is what makes a word a button in this palette. |
| 4 | P2 | **"darker = more likely to be in the fertile window" appears where nothing is darker.** It is printed inside the Today estimate card and under the Calendar legend. On Today the only graded element is the ring's thin band; in the card it reads as a stray footnote. | `ios-today.png`, `ios-month.png` | Keep it once, as the legend caption on Calendar. On Today, drop it or move it into the ring's accessibility label. |
| 5 | P2 | **Tab bar in dark mode is light.** The system glass tab bar stays near-white over a black screen; it is legal Liquid Glass behaviour but the contrast jump is harsh and the inactive icons go black-on-white while the rest of the UI is white-on-black. | `ios-typical-dark.png` | Pass the dark `tint`/`backgroundColor` tokens to the native tabs for `scheme === 'dark'`, or accept it and document it as a system choice in DECISIONS. |
| 6 | P3 | **Status-bar time 09:41 and the simulator battery** will appear in store shots; fine for the suite, but `tools/brand/store.ts` should override the status bar (it already frames the shots). | all | Already handled if the framer draws its own status bar; confirm. |

## 3. Today

| # | Pri | Issue | Recommendation |
| --- | --- | --- | --- |
| 7 | P1 | The estimate card says the range twice: title "Ovulation estimate uncertain (range 10–21 Oct)" and body "Estimated ovulation around 15 Oct (range 10–21 Oct)". | The body is the fixed §2.3 sentence and must stay. Make the title the confidence word only ("Ovulation estimate · uncertain") and let the body carry the dates. |
| 8 | P2 | Headline shows "Period likely in 15–22 days / Most likely 28 Oct". §8.5 asks for a date range chip ("27 Oct – 2 Nov") with the point date secondary. Days-from-now is friendlier day to day, but the dates are what the user puts in a diary. | Show both: headline in days, sub-line "27 Oct – 2 Nov · most likely 28 Oct". |
| 9 | P2 | Quick-log row: the Period segment is a filled accent pill, the other two are plain text; at 150% scale the row stacks and only Period looks like a button. | At default scale keep the emphasis but give Symptoms and Temperature a visible container (hairline or tonal). At > 1.3 scale render three equal full-width tonal buttons. |
| 10 | P2 | Ring: the fertile band is a desaturated green-grey at low opacity on the blush background; at opacity 0.1–0.4 it is close to the track colour. §8.9 asks 3:1 against the cell. | Raise the floor of the opacity ramp to 0.35 for the ring (keep the engine's p(d) mapping for the calendar), or use the fertile token at full opacity with width as the variable. Re-run the contrast test on the band tokens. |
| 11 | P3 | "fair estimate" chip is grey-on-grey; the confidence word is the second most important fact on the screen. | Tonal chip in the accent family, or bold text. |
| 12 | P3 | Flag card left border is amber; nothing else in the palette is amber. | Use the `warning` token if one exists in `ui-tokens`, otherwise the accent at 60%. Keep the border; it is the only non-colour cue, so also keep the title. |

## 4. Logging sheet and day detail

| # | Pri | Issue | Recommendation |
| --- | --- | --- | --- |
| 13 | P1 | Day-detail "Delete" per event is immediate, with no confirm or undo (see implementation review #14). | Inline "Deleted · Undo" for 5 s. |
| 14 | P2 | Sheet date arrows "‹ ›" are 24 pt glyphs; the touch target is the glyph. | Wrap in 44 pt pressables; they exist in `LogSheet.tsx:99` per the delegated check, but visually they look like decoration. Use the system chevron icons at 17 pt in the accent. |
| 15 | P2 | Symptom intensity dots are three 6 pt grey dots under each tile; on selection two turn accent. At 150% they stay 6 pt. | Scale the dots with font scale, or replace with a short bar. The long-press-to-adjust gesture (§8.4) has no visible affordance anywhere; add a one-time hint line under the grid ("Hold a symptom to change its strength"). |
| 16 | P2 | Day detail shows no provenance chip for manual entries and no per-event Edit; the only Edit is the full sheet. Fine, but the three event cards are 90 pt tall for one line of text. | Collapse to a list: one row per event, trailing "Delete" text button, provenance as a muted suffix ("· imported from Natural Cycles"). |
| 17 | P3 | "Not a period" and "Mark as spotting" appear even on a day with no flow logged. | Show them only when a flow event exists for the day. |

## 5. Calendar

| # | Pri | Issue | Recommendation |
| --- | --- | --- | --- |
| 18 | P2 | Legend lists "Ovulation estimate" with a blue dash, but on the uncertain-estimate month no marker is drawn (arms > 6 days, §8.5), so the legend promises something absent. | Hide the legend item when the marker is suppressed, or draw the arms faintly and keep the label "estimate uncertain" next to it. |
| 19 | P2 | Fertile underline is 4 pt tall in the same green-grey as the ring band; low-probability days are almost invisible against blush. | Same fix as #10; also give the underline rounded ends and 6 pt height so the gradation reads. |
| 20 | P3 | Day card under the grid: "Day 11 · BBT 36.42 °C" is good; "Edit / Details" could be one action since Details also offers Edit. | Make the card itself tap to Details and keep a single "Log" button. |
| 21 | P3 | Weekday header Mon–Sun is fixed; P6-1 added device first weekday, confirm the header follows it. | Check `calendarModel.ts` uses the locale rule. |

## 6. Insights

| # | Pri | Issue | Recommendation |
| --- | --- | --- | --- |
| 22 | P1 | Charts with one or two points look broken: cycle-length chart has two dots and an x-axis "Aug … Aug"; temperature chart is one dot with no coverline and axis 36.3–36.6. | Threshold each chart: below 3 cycles / 6 readings show a quiet card "Log two more cycles to see your lengths" / "Six morning temperatures show a shift" in place of the chart. Label the x-axis with month + year when the span crosses a year, or with day numbers for the temperature chart (it already does). |
| 23 | P2 | History row format differs between the open cycle ("29 Sep · day 11") and closed cycles ("31 Aug · 29 days"), and the quality chip ("current", "typical") is a grey pill with no icon. | "29 Sep · day 11 so far" for the open cycle; chips tonal, with "typical" muted and anything else accent-outlined. |
| 24 | P2 | History cards are 300 pt tall for three lines plus a centred button. | List rows with a chevron (see #2). |
| 25 | P3 | Accuracy tab is one card on an empty screen. | Add the per-cycle ledger below it (predicted range vs actual, one row per closed cycle); the data is already in `prediction_score`. |

## 7. Onboarding

| # | Pri | Issue | Recommendation |
| --- | --- | --- | --- |
| 26 | P1 | Step 5 says "Sanguine locks when you leave it for a minute" but the lock now defaults off (D-073). | Reword (implementation review #6). |
| 27 | P2 | Step 5 Finish button is drawn full-accent while disabled (both boxes unticked) in EU/UK mode; nothing says why it will not press. | Disabled style (60% opacity) plus a hint line. |
| 28 | P2 | Step 3 "Another date" opens the new `@expo/ui` picker inline on iOS with no chip wrapper, so the row looks different from the three chips beside it. | Render the picked date inside a chip ("8 Oct 2026 ▾") that opens the picker; keep the helper line. |
| 29 | P3 | Step 3 keeps "Continue", "I don't know" and "Back" stacked as three text rows; "I don't know" is the skip that §8.6 requires and should be visually on par with Continue. | Secondary (tonal) button for "I don't know". |

## 8. Settings and About

| # | Pri | Issue | Recommendation |
| --- | --- | --- | --- |
| 30 | P2 | Settings root: "Life state · None" and "Health sync" (no subtitle) sit beside "Appearance · Match system". | Subtitles on every row: Health sync "Off" or "3 types", Privacy and data "Lock off · Backup off", Notifications "Reminder 3 days before", Tracking "8 symptoms". |
| 31 | P2 | Privacy: "Your consent — No consent is recorded on this phone." reads as an error to a user who has just finished onboarding. | "Consent recorded 10 Oct 2026" when present; when absent, hide the row outside EU/UK regions. |
| 32 | P3 | About band: the taglines ("THE RIVER OF BLOOD NEVER EMPTIES; IT ONLY CRESTS.", "BY BLOOD BOUND, BY BRASS CROWNED.") are the client's brand voice and PROGRESS already flags the Warhammer echo for a trademark check. Visually they are fine. | No UI change; owner decision pending. |
| 33 | P3 | About prints "Version 1.0.0 / Estimate engine 0.1.10 / Engine hash 9db2b951f316" with the hash in monospace-ish grey; good. Add a "Copy" action for support. | Tap-to-copy on the hash row. |

## 9. Accessibility (§8.9)

- 150% scale: layouts reflow (ring collapses, quick-log stacks, cards grow). Checked on iOS at P2-14; re-shoot after the fixes above.
- Colour-only: period days carry a solid fill plus two white dots, predicted days are hatched, the fertile band is announced with a probability word (`calendarModel.ts:61`). The ring's fertile band has no non-colour encoding; it is decorative if the headline carries the fact, so set it `accessibilityElementsHidden`.
- Contrast: the two green-grey fertile tokens need a re-check at the low end of the opacity ramp (#10, #19). Everything else in the shots meets 4.5:1 by eye; the token test in `ui-tokens` covers the rest.
- Targets: the sheet's date chevrons and the day-card text buttons are the suspects (#14, #3).
- VoiceOver script in `docs/accessibility.md` still needs a real-device run (owner).

## 10. Android notes (from the P3-1 set, not re-verified)

- Dark-mode toolbar contrast is a known open item (P3-14).
- The Compose floating toolbar replaces the quick-log row; the three-style secondary-action problem (#2) is the same there.
- The `@expo/ui` date dialog on Android dismisses with `undefined` (implementation review #5); the age gate flow is iOS-only as written.

## 11. Suggested order

1. #1 dead space, #2/#3 action styles, #7 duplicate range, #22 sparse charts, #26 lock copy, #13 undo. These change every store screenshot, so do them before `tools/brand/store.ts` runs again.
2. #4, #8, #9, #10/#19 contrast, #18 legend, #23/#24 history rows, #27/#28 onboarding, #30/#31 settings subtitles.
3. The P3 items as time allows.

After step 1, re-run `fontscale.yaml` and re-shoot `docs/screenshots/P2-14` on iOS, then rebuild the framed store set.
