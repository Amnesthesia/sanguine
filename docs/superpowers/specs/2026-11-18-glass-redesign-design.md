# Glass redesign of the whole app

Date: 2026-11-18. Owner request, after choosing calendar layout B in the calendar work (`2026-11-18-calendar-clarity-design.md`): "do a full design overhaul of the app with this glass UI kind of design, so that we can make a plan for implementing this. I want mockups for the other screens too so you don't miss anything."

Mockups: the Design canvas "Sanguine glass redesign" (claude.ai artifact `4GnPfVGn2f1JqPVfh3kiWH`). Every artboard named below is on it. The calendar behaviour changes (period-end estimate, past ovulation, month list, ✕ removal with Undo, the two new settings) are specified in the calendar-clarity design; this document covers the visual system and every other screen.

## Intent

One calm, consistent iOS 26/27 Liquid Glass look across the app: glass for everything that navigates or floats, opaque content underneath, estimates that look like estimates, one obvious primary action per screen, and explanations designed as sections (pictures, evidence bars, sources) rather than paragraphs.

## Goals

- Every screen redrawn in one design language (below), with nothing the current screens do left out.
- Glass that visibly blurs what scrolls under it (owner: "glass UI uses blur").
- One filled control per screen; selected options and logged entries never look like it (owner, log sheet feedback).
- Everything round: pills and circles for every button (owner).
- Explanations that are pedagogical, cite sources and say when something is a guess, uncertain or thinly evidenced (owner).

## Non-goals

- No change to what the engine predicts (the calendar design covers its two additions).
- No new features beyond those in the calendar design.
- Android is not mocked: it gets the Material 3 Expressive equivalents of each piece (PLAN §9.1), listed per component below.
- The client brand stays exactly where it is (splash, icon, About band; CLAUDE.md "Brand").

## Anti-goals

- Glass on content: lists, cards, the grid and charts stay opaque so marks and text keep their contrast (PLAN §9.1). One owner-approved exception: the Today hero estimate cards are glass over a faint colour wash.
- Any estimate drawn like a logged fact; a single highlighted fertile day; a per-day chance of pregnancy.
- Text on glass below 4.5:1 with the busiest content scrolled beneath.

## Design language (canvas artboard "Design language and components")

- **Colour**: the existing tokens of `packages/ui-tokens` (PLAN §9.2) unchanged. Two additions for glass: secondary text on glass #4A4246 (light), and the caution panel tint rgba(185,116,30,0.10) with text #5E3A0C and icon #8A5512 (from the existing `flag` token).
- **Materials**: regular glass (system material via `expo-glass-effect` regular variant; mocked as blur 18, saturation 200%, a thin white tint brighter at the top edge, light rim, a tight and a soft shadow); tinted glass for the one primary action (accent, `glassAccent` token); opaque cards on `surface`/`surface2`. A sheet at its large detent is nearly opaque, with opaque cards inside.
- **Geometry**: glass inset 10 pt from the screen edges and 8 pt above the tab bar; tab bar radius 31, sheets 34, floating cards 28, content cards 24, panels 16–18, chips 14–18; every button a pill or circle; 16 pt gutter; rhythm 8/12/16/24; targets 44+.
- **Type**: system font; large title 34 on tab roots; toolbar title 17 semibold; section 22 bold; card heading 17 semibold; body 15/14; secondary 13; tiny uppercase labels 11 used sparingly.
- **Components**: glass tab bar with icons (drop, calendar, rising line, gear; the selected tab in a tinted pill); glass toolbar with a round back button and centred title (D-096 kept); primary pill (52 pt, plus icon when it logs) or primary circle; secondary glass pill; text and destructive text buttons; logged-entry chips (quiet, coloured leading mark, ✕); selectable chips (off: `surface2`; on: `accentSoft` with an accent border, never filled); switches in accent; segmented control in glass; three-bar meter for confidence and evidence, always with a word; ESTIMATE tag; caution panel; toast in glass with Undo; grouped lists on `surface2`; numbered sources.
- **Surfaces** (owner, after comparing four options on the canvas frame "Card surface options on a white page"; picked A with B on hero places): the page stays white. Cards are white with a hairline ring (rgba(31,26,28,0.04)) and a soft two-step shadow (0 2px 6px and 0 12px 32px, low opacity), radius 26, no border. Glass appears on content only where a faint rose, blue and green wash sits behind it, so the blur has something to show: the Today hero (dial and estimate cards); everywhere else glass stays in the navigation layer (toolbars, sheets, tab bar, floating controls). Grey (`surface2`) fills only inside cards. Sheets at their large detent (log sheet, expanded day sheet) are near-white (97%) with the same soft-elevation cards (owner). Settings rows carry round icons in one soft rose tint (accentSoft circle, onAccentSoft glyph), the same circle shape as every other control; owner: multicoloured square tiles were too colourful and did not match the app.
- **Estimate rule**: solid = logged; dashed ring or soft glow = estimate; graded green band = fertile window estimate.
- **Buttons say the action in one or two words** (owner: "Read more" should look like a button, not hold a whole phrase): "Read more ›", "Show details ⌃", "Log this day"; the longer meaning goes in the accessibility label. Only the screen's primary is filled; a toolbar "Today" is a secondary glass pill.
- **Today's cycle dial** (owner: the old ring looked amateurish): a 280 pt dial over the expected cycle length (the upper end of the next-period range): a soft neutral track with fine day ticks inside (longer every 7 days); continuous rounded arcs for the logged period (solid), estimated period days and the next-period range (soft rose), and the fertile window as a smooth graded green band; the ovulation estimate as a white point with a blue ring and halo; today as a white knob with a shadow and an accent ring. Centre: "CYCLE DAY", the number, a phase pill, one line ("Likely ends 3–5 Nov"). A legend line below. Irregular users get a wide next-period arc and no ovulation point; no data shows the bare track. Replaces `PhaseRing`.
- **Energy is a five-step slider** (owner): Very low to High with detents and labels; unset shows no thumb and "Not logged"; "Clear" removes the value (replaces tap-again-to-clear, D-108). Accessible as a slider with value text.

## Screens (artboards on the canvas)

| Area | Artboards | Notes |
| --- | --- | --- |
| Calendar | Calendar 1–3 (`B-Circles`, `B-SheetOpen`, `B-DaySheet`), `Calendar-Dark` | Specified in the calendar design. |
| Today | `Today-Period`, `Today-Typical`, `Today-Irregular-Flag`, `Today-Empty`, `Today-Suspended`, `Today-Pregnant`, `Today-Dark` | Glass floating Log; estimate cards with meters; food and movement compact (owner, 2026-11-18): two tiles (food, movement) with their evidence bars and "Read more", which opens the full sections in a sheet, the same component as the expanded day sheet. |
| Widgets and notifications | `Widgets-Notifications` | Home small/medium, lock-screen circular/rectangular, discreet and descriptive variants, banners. |
| Logging | `Log-Sheet-Empty`, `Log-Sheet-Filled`, `Log-Sheet-More`, `Log-Sheet-Contraception`, `Log-Period-Question` | Done becomes the filled tinted capsule; "Logged on this day" ✕ chips; Undo toast. |
| Day screen | `Day-Screen`, `Day-Screen-Future` | ✕ chips replace Delete rows and the confirm alert; corrections kept; full food and movement card. |
| Insights | `Insights-History`, `Insights-Charts`, `Insights-Accuracy`, `Insights-Irregular`, `Insights-Empty`, `Insights-Pattern`, `Cycle-Detail` | Segmented control in the glass toolbar; charts in opaque cards with a plain reading. |
| Onboarding and entry | `Splash`, `Onboarding-1` … `Onboarding-5` with `-Error`, `-DontKnow`, `-Postpartum`, `-Explicit` variants, `Onboarding-Dark`, `Lock-Screen` | Steps follow `OnboardingFlow.tsx`; glass header (Back, Skip) and a glass footer with the one Continue. |
| Settings | `Settings-Root`, `-Tracking`, `-Appearance`, `-Notifications`, `-LifeState`, `-About`, `-How` | The two new switches (calendar design part 2 and 6) appear in Tracking and Appearance. |
| Settings: data | `Settings-Health-Off`, `-Health-On`, `-Privacy`, `-Delete-Confirm`, `-Backup`, `-Backup-Restore`, `-Backup-OtherPhone`, `-Backup-RecoveryCode`, `-Report`, `-Report-Share`, `-CalendarExport`, `-CalendarExport-Teen`, `-Legal` | Destructive actions in period red, confirmed in a glass alert. |

## Decisions this changes (to record in DECISIONS when implemented)

- PLAN §9.1 keeps glass out of the content layer; the owner approved glass estimate cards over a colour wash on the Today hero as the one exception.
- PLAN §9.7 said onboarding has no glass; the overhaul puts its header and footer in glass (navigation chrome), content stays opaque.
- D-099 (one primary action floating above the tab bar): kept on Today; on the Calendar the Log action moves into the glass day card and sheet.
- D-101 (cycle-day badge): replaced by a small number above the date (calendar design part 2).
- D-075 / I-14 (confirm before deleting an entry): replaced by immediate removal with Undo (calendar design part 5).
- D-109 (separate food and movement card on the Calendar): its content moves into the day sheet.
- The log sheet's Done becomes a filled primary capsule.
- New copy, approved by the owner with this spec on 2026-11-18: the four evidence-grade definitions, "Also include" on the report screen, and any line the lanes flagged as new (see "States and copy still open").

## States and copy still open

Drawn screens cover the main states. These states exist in the code and are not drawn; the implementation keeps them and styles them with the same components (caution panel, toast, disabled control):
- Health: "not available on this phone"; "{n} could not be synced"; "Syncing…"; the teen and sexual-activity hiding rules; PLAN §9.8's Off/Read/Read & write control versus the code's single switch (the code wins unless the owner decides otherwise).
- Privacy: "Preparing…" during export; the import result (records, skipped problems, dropped notes) needs an inline panel, not a toast; export/import errors; "Turn on a screen lock on this phone first."; Android discreet-icon text and its unavailable state; "No consent is recorded on this phone."
- Backup: "Encrypting… {pct}%"; ready, too short, mismatch, missing passphrase, cloud off/failed/waiting for Wi-Fi/link failed/no backup yet, needs code, bad code, records imported after restore; Google Drive naming on Android.
- Report: "The PDF could not be made."; the ovulation switch hidden in teen mode.
- Calendar export: no period estimate yet (Share disabled); sharing failed.
- Legal: the screen shows one policy document; the list of policies lives in About.
- Today: the look-back symptom note and the low-energy line (they need more history than the sample has), the short-cycle confirmation, the late-period state, and a pregnancy without a due date.
- Insights: the unusually-long-cycle correction prompt, the pregnancy-outcome prompt, empty Charts and Accuracy segments, a missing-cycle detail, and teen fertility hiding.
- Logging, onboarding and Settings part 1: their lanes stopped at the usage limit before reporting; their frames were checked structurally and visually, but a line-by-line comparison with the code is still to do in the implementation plan.

## Owner approval

Approved 2026-11-18, including the four evidence-grade definitions and the new copy listed above.

## Implementation notes

- Glass: `expo-glass-effect` `GlassView` (regular) for toolbars, floating cards, toasts and segmented controls; native sheets with detents for the log sheet and day sheet; the system tab bar via native tabs already is glass. No CSS-style blur in React Native.
- Android: M3 top app bar, modal bottom sheet with detents, navigation bar with pill indicator, filled tonal primary, M3 switches and segmented buttons; no glass.
- Contrast is checked on device with busy content under each glass element (light and dark), and at 150% text.
- Shared components (meter, estimate tag, logged chip with ✕, caution panel, sources list, designed food and movement sections) live once in `apps/mobile/src/ui` and serve Today, the day sheet, the day screen and How it works.
