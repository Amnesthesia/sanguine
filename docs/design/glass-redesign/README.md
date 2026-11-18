# Sanguine glass redesign mockups

Approved by the owner on 2026-11-18. Open `index.html` in a browser to see every screen, grouped by area. Each screen is also a standalone file in `frames/` (plain HTML and CSS, no scripts, no network), so it opens on its own and can be diffed.

The design these show is specified in:

- `docs/superpowers/specs/2026-11-18-glass-redesign-design.md`: the visual system and the screen list.
- `docs/superpowers/specs/2026-11-18-calendar-clarity-design.md`: the calendar behaviour changes.
- `docs/superpowers/specs/2026-11-18-glass-design-language.md`: exact colours, glass recipe, surfaces, geometry and components.

Implementation plan: `docs/superpowers/plans/2026-11-18-calendar-clarity-and-glass-redesign.md`.

Notes:

- Sample data: today is Monday 2 November 2026; the period started 31 October. Frames showing another day say so in their title.
- Glass is drawn with CSS `backdrop-filter`, an approximation of the system material the app uses (`expo-glass-effect`). It needs a browser that supports `backdrop-filter`. Floating glass that holds text over scrolling content (Today's Log bar, the Calendar's day bar and open day sheet) is drawn with a much stronger white (dark: near-black) tint: the system material alone lets the text beneath read through on iOS 26 (verification finding X1), so the app adds a legibility tint and the frames show that.
- Corrected on 2026-11-18 by the glass redesign fix plan (`docs/superpowers/plans/2026-11-18-glass-redesign-fix-plan.md`, Task 5, backlog P8-27) to follow the decisions made after approval: the compact day bar, the sheet's drag states and past fertile bands (P8-23), Insights "This cycle" with a slimmer calendar sheet and day screen, white ink on a darker dark-mode primary, the system tab bar's grey selection, one confidence vocabulary and plain method words. Verification findings: `docs/superpowers/specs/2026-11-18-glass-redesign-verification.md`.
- `Surface-Options.html` records the four card treatments compared on a white page; the owner chose A (soft elevation) with B (glass over a colour wash) on the Today hero only.
- Placeholders in square brackets (the fixed regulatory wording, the client's logo images) stand for content the app already has.
