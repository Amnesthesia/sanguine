# Accessibility (WCAG 2.2 AA, PLAN.md §8.9)

## What is checked automatically

| Check | Where |
| --- | --- |
| Text contrast ≥ 4.5:1 and non-text ≥ 3:1 for every colour token, light and dark | `packages/ui-tokens/src/tokens.test.ts` |
| Every `Pressable`, `Switch`, `TextInput` has an accessibility label; every `Pressable` declares a target of at least 44 | `apps/mobile/src/a11y.test.ts` |
| No custom animation anywhere (reduced motion is therefore met; the ring is static) | `apps/mobile/src/a11y.test.ts` |
| Period, predicted range and fertile band are drawn as shapes and spoken in words, never opacity | `calendarModel.test.ts`, `a11y.test.ts` |
| Screens at about 150% text size on iOS (Dynamic Type AX1, ~160%) and Android (font scale 1.5) | `apps/mobile/.maestro/fontscale.sh ios\|android`, screenshots in `docs/screenshots/P2-14/` |
| Above 150% the ring collapses to a text header; below, quick-log buttons and symptom tiles reflow instead of splitting words | `PhaseRing`, `QuickLogRow`, `SymptomGrid` |

## Manual script (VoiceOver on iOS, TalkBack on Android)

Run with the sample data: open `exp://<host>:8090/--/dev/seed?scenario=typical` in Expo Go.

1. **Today.** Swipe right through the screen. Expect: title "Today", the ring as one element ("Cycle day 11. Follicular."), then Period, Symptoms, Temperature buttons, the headline ("Period likely in 15–22 days"), "fair estimate", the ovulation estimate button then its fixed sentence, the footer. No element should read a bare number or "image".
2. **Log sheet.** Activate Period. Expect "Friday 9 October" as a heading, flow options as radio buttons ("Medium", selected state spoken), symptoms as checkboxes ("Cramps, intensity 2 of 3" or "Cramps, not selected") with the long-press hint, More rows reading "Temperature. 36.42 °C" or "Add". Done closes the sheet.
3. **Calendar.** Explore by touch. Each day reads date and state in words ("Thursday 1 October, period, something logged", "… moderate likelihood of being in the fertile window"). Month chevrons are named. The summary card reads the selected day.
4. **Insights.** Segmented control reads as radio buttons. History rows read as one heading plus details. Charts read a summary label (cycle lengths; temperature count and coverline; symptom shares).
5. **Settings.** Rows read "title. current value". Switches read their title and state. The destructive row is announced by its title; the confirmation names the action ("Delete all my data").
6. **Onboarding.** Progress reads "Step 2 of 5". Year fields read their label and, when invalid, the error. The consent checkbox reads its sentence and checked state.
7. **Lock screen.** Title, explanation and the Unlock button are the only elements; the system sheet takes focus.

Record the device, OS version and any failure in `docs/DECISIONS.md`.

## Known limits

- Haptics are used on the quick-log buttons only and are never the only feedback.
- Colour themes follow the system; the in-app switch is in Settings > Appearance.
- Screen-reader output was checked by label inspection and the automated tests above; a person using VoiceOver or TalkBack has not yet walked the script (needs a human, see `docs/PROGRESS.md`).
