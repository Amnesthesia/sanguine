# Sanguine glass redesign: design language (mockup reference)

Exact values behind the mockups in `docs/design/glass-redesign/index.html` (one HTML file per screen in `docs/design/glass-redesign/frames/`). Companion to `2026-11-18-glass-redesign-design.md`; where the two differ, the design spec wins.
The owner chose calendar layout B (artboards
`frames/Calendar-1-Closed.html`, `frames/Calendar-2-SheetOpen.html`, `frames/Calendar-3-SheetExpanded.html`) and asked for the whole app in
the same glass style. Copy those three files' patterns exactly (paste their inline styles); do not invent a new look.

## Frame and type
- iOS phone frame 390 wide. Root `<div>` fixed `width: 390px; height: <H>px; position: relative; overflow: hidden;
  background: #FFFFFF` (dark: `#000000`). Make H as tall as the content needs (a scrolled screen shows its full length).
- System font: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif`.
- Type: large title 34/41 bold (only on tab roots when not scrolled); screen title in a glass toolbar 17/22 semibold;
  section heading 22 bold; card heading 17 semibold; body 15/21 or 14/20; secondary 13/18; caption 12/17; tiny label 11
  semibold letter-spacing 0.4 uppercase (used sparingly: section labels inside cards).
- No status bar, no device bezel.

## Colour (light / dark), from packages/ui-tokens
bg #FFFFFF/#000000 · surface #FFFFFF/#1C1C1E · surface2 #F3F3F4/#2C2C2E · textPrimary #1F1A1C/#F4EEEF ·
textSecondary #6B6165/#B3A8AC · border #E4E4E6/#3A3A3C · accent #BC4560/#D4607A · accentSoft #F4DCE0/#3A1F27 ·
onAccentSoft #A3354F/#E8869A · period #B8324A/#D9607A · periodPredicted #D9A0AB/#7A4654 · fertile #5C8A6E/#7FAF93 ·
ovulation #3F6F88/#7FA7C2 · flag (caution) #B9741E/#D9A054 · success #3E7D5A/#6FB68C.
On glass, secondary text is #4A4246 (light) because glass lightens what is behind it. Caution panels: background
rgba(185,116,30,0.10), text #5E3A0C, icon #8A5512. Text must reach 4.5:1 (3:1 for 24 px+).

## Two layers (PLAN §9.1: glass only in the navigation layer)
- **Content layer, opaque**: the grid, lists, cards with information. Cards: `border-radius: 24px; background: #FFFFFF;
  border: 1px solid #E4E4E6` on a white screen, or `background: #F3F3F4` (surface2) for grouped lists. Never glass.
- **Navigation layer, glass**: toolbars, the tab bar, sheets, floating cards that are a sheet's closed detent, floating
  buttons, toasts, segmented controls in toolbars. Content scrolls beneath it; show screens slightly scrolled so content
  is visibly under the glass.
- Glass recipe (regular, owner: glass must visibly blur what is under it): `background: linear-gradient(180deg,
  rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.22) 42%, rgba(255,255,255,0.30) 100%); backdrop-filter: blur(18px)
  saturate(200%) brightness(1.04); -webkit-backdrop-filter: same; border: 1px solid rgba(255,255,255,0.6); box-shadow:
  0 1px 2px rgba(31,26,28,0.06), 0 14px 36px rgba(31,26,28,0.16), inset 0 1px 0 rgba(255,255,255,0.95)`. Dark:
  `linear-gradient(180deg, rgba(70,62,66,0.55), rgba(30,26,28,0.38) 42%, rgba(40,35,38,0.45))`, rim
  rgba(255,255,255,0.12). In the app: the system material via expo-glass-effect (regular variant), not CSS.
- Tinted glass (prominent): `background: rgba(188,69,96,0.96); color: #FFFFFF; box-shadow: inset 0 1px 0
  rgba(255,255,255,0.45), 0 6px 16px rgba(188,69,96,0.32)`.
- A sheet at its large detent: `rgba(250,249,250,0.94)` with blur; its cards inside are opaque white.

- Surfaces (owner, after comparing four options in `frames/Surface-Options.html`; picked A with B on hero places): the page stays white. Cards are white with a hairline ring (rgba(31,26,28,0.04)) and a soft two-step shadow (0 2px 6px and 0 12px 32px, low opacity), radius 26, no border. Glass appears on content only where a faint rose, blue and green wash sits behind it, so the blur has something to show: the Today hero (dial and estimate cards); everywhere else glass stays in the navigation layer (toolbars, sheets, tab bar, floating controls). Grey (`surface2`) fills only inside cards. Sheets at their large detent (log sheet, expanded day sheet) are near-white (97%) with the same soft-elevation cards (owner). Settings rows carry round icons in one soft rose tint (accentSoft circle, onAccentSoft glyph), the same circle shape as every other control; owner: multicoloured square tiles were too colourful and did not match the app.

## Geometry
- Glass elements inset 10 px from the screen edges; tab bar 370×62, radius 31; floating cards radius 28; sheets radius 34;
  content cards radius 24 (22 for compact ones); inner panels radius 16–18; chips radius 14–18. Everything is fully
  rounded: every button is a pill or a circle (owner). Screen gutter 16 px. Vertical rhythm 8/12/16/24.
- Touch targets ≥ 44 px.

## Components (copy from the B files)
- **Tab bar**: glass capsule, 4 items with icons (drop = Today, calendar = Calendar, rising line = Insights, gear =
  Settings; inline stroke SVG, 22 px, stroke 1.7), label 10 px; the current tab has a tinted pill rgba(188,69,96,0.14)
  and colour #A3354F. Copy it from `frames/Calendar-1-Closed.html`.
- **Glass toolbar** (pushed screens and Calendar): floating capsule at top 10 px, round glass back button 44 px with ‹,
  title centred 17 semibold, optional round trailing button or tinted "Today"/"Done" pill.
- **Primary action**: exactly one filled (tinted) control per screen or sheet. Filled rose pill (52 px tall, plus icon
  when it logs) or a 52 px filled rose circle. Everything else is a glass/white pill (secondary) or text.
- **Chips**: logged entries are quiet (white/translucent, small coloured leading mark, ✕ to remove). Selectable chips
  (log sheet options, filters): off = surface2; on = accentSoft background + 1.5 px accent border + onAccentSoft text,
  never a solid fill, so they never look like the primary button.
- **Meters**: three 4×11 px bars, filled #1F1A1C, empty #E4E4E6; used for engine confidence (high/medium/low) and for
  evidence grades (Strong/Some/Early; General = none filled). Always with a word beside it.
- **Estimate tag**: small capsule "ESTIMATE", 11 px semibold, colour #3F6F88 (on glass #2F5568), border
  rgba(63,111,136,0.45), radius 9.
- **Estimate visuals**: solid = logged; dashed or soft-glow = estimate. Period estimate = dashed period-red ring;
  ovulation estimate = white disc with a soft blue glow; fertile window = graded green tint band. Never a single
  highlighted fertile day; every prediction is a range with a confidence word.
- **Lists** (settings, history): grouped inset cards on surface2 with 16 px padding rows ≥ 52 px, hairline #E4E4E6
  between rows, chevron › for navigation, iOS-style switch 51×31 (track #BC4560 when on, #E4E4E6 when off, white
  27 px knob with a soft shadow).
- **Toast**: glass capsule at the top under the toolbar, message + "Undo" in accent when the action can be undone.
- **Caution panel**: amber tint (above) with a round info icon.
- **Sources**: superscript numbers in text; numbered list card at the end.

## Content rules
- Use the app's real copy from `copy/en-AU.json` wherever a string exists. Mark copy you had to write as new by keeping
  it plain and factual; never invent medical claims or numbers. Regulatory fixed wording (PLAN §2.3) appears as the
  placeholder "[Fixed regulatory wording, PLAN §2.3]" where the current screen shows it.
- Never: a single highlighted fertile day, a per-day chance of pregnancy, contraception or conception features, a
  condition named in a flag (flags say "a doctor can help you check").
- Teen mode hides fertility language; mock it only where a lane says so.
- Sample data (keep it consistent): periods started 5 Sep, 3 Oct, 31 Oct 2026 (cycles 28, 28 days; periods 5 and 4
  days); today Monday 2 November 2026, cycle day 3, medium flow, cramps mild, energy low; next period likely
  26–30 Nov (at most 24 Nov – 2 Dec), medium confidence; ovulation estimate 10–18 Nov, most likely 14 Nov, calendar
  basis; BBT 36.42 °C logged on 27 Oct. Other states may use another "today" (say so in the frame title).
