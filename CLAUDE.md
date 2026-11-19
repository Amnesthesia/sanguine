# Sanguine — instructions for Claude Code

You are building Sanguine, a free, on-device menstrual-cycle tracker for iOS and Android (React Native + Expo). The complete design and architecture plan is in `docs/PLAN.md`. Read sections 4, 5 and 6 in full before writing any code; read the section relevant to a task before starting it. The plan is the source of truth; if you must deviate, record why in `docs/DECISIONS.md` and keep going.

## Brand
The logo and the splash are the client's v2 brand (D-049), cut back by the owner to those two places plus the icon and the About band (D-051). The emblem (a single-line uterus under a crescent moon) and the script "Sanguine" logotype are the client's image assets in docs/brand-v2/: recolour them, never redraw or re-typeset them. The splash and the About band sit on a blush field #F5E8E2 (dark: plum #2A1518) with ink #73393B and show one of six rotating taglines in Cormorant Garamond capitals (hidden in teen mode); those colours and that font live only there, as constants in the splash and About code, never in `packages/ui-tokens`. Inside the app the palette is the white/black one of PLAN.md §9.2 (accent rose #BC4560) and the type is the system font (§9.3). The copy addresses women (D-050); the fixed regulatory wording of PLAN.md §2.3 and the §8.7 forbidden-word list are unchanged. Spec: PLAN.md §9.9; brief: docs/brand-v2/REDESIGN_PROMPT.md.

## Non-negotiables (never change without a human decision)
- The prediction engine (`packages/engine`) is pure TypeScript: no React, no platform APIs, no I/O, no `Date.now()`, no randomness. `predict(history, settings, today)` is deterministic.
- No network calls anywhere except the optional, client-side-encrypted backup to the user's own iCloud Drive / Google Drive app folder (Phase 3), which also carries sync between the user's own phones through that same encrypted copy (owner, D-077; D-083), and the EAS Update check for new app code (D-069, carries no user data; reviewed JS engine changes may ship over the air (owner, D-110)). No analytics, crash-reporting, ad or attribution SDKs. CI fails the build if one appears.
- Symptoms (cramps, mood, acne, breast tenderness, mittelschmerz, etc.) never change a prediction. Only period dates, BBT, wearable temperature, LH tests, cervical mucus and cervical position do.
- Every prediction is a range with a confidence grade. Never render a single highlighted "fertile day".
- The regulatory wording in PLAN.md §2.3 is fixed copy. The forbidden-word list in §2.3 and §8.7 is enforced by a test over `copy/*.json`.
- Local data is SQLCipher-encrypted from Phase 3 (the key lives in Secure Store); the `Database` interface accepts the key from day one so the switch is a config change. Event rows are append-only: never UPDATE or DELETE an `event`; retract instead.
- Teen mode (age 13–17) hides fertility language by default; the minimum age is 13.

## Stack (PLAN.md §6.1)
Phases 0–2 (Expo Go): expo-router with native tabs, expo-sqlite (plain), expo-secure-store, expo-local-authentication, expo-notifications (local), expo-file-system, expo-sharing, expo-document-picker, @expo-google-fonts/dancing-script, expo-blur, @expo/ui, reanimated, react-native-svg, zustand, i18next, @noble/ciphers, @noble/hashes, vitest, fast-check, Maestro. Phase 3+: prebuild + dev client, expo-sqlite `useSQLCipher: true`, expo-glass-effect, Expo widgets, alternate icons, `MaterialExpressiveTheme`, `@kingstinct/react-native-healthkit`, `react-native-health-connect` v4. Expo SDK 57 now; upgrade to 58 at its stable release.

## Visual reference
The glass redesign (P8-20 to P8-22) is the visual source for every screen in the app: `docs/design/glass-redesign/index.html` (one file per screen in `docs/design/glass-redesign/frames/`), with exact values in `docs/superpowers/specs/2026-11-18-glass-design-language.md` and behaviour in `docs/superpowers/specs/2026-11-18-glass-redesign-design.md` and `2026-11-18-calendar-clarity-design.md`. Open the frame before building or changing a screen and match it; the frames win on look, the specs on behaviour. Text on glass uses `textOnGlass`, never the accent. `docs/brand.html` still renders the splash, icon and wordmark; `docs/mockups.html` is the older mock-up and is superseded where a frame exists.

## App config: `app.config.ts` first (owner, 2026-11-19, D-148)
Make Expo config changes in `apps/mobile/app.config.ts` (layer them on `config` there) rather than in `app.json` whenever the change leaves the JS-to-native interface as it is. `app.json` is hashed into the runtime version (`runtimeVersionFor`) and `app.config.ts` is not, so an `app.json` edit gives every later build a new runtime version, and builds already installed stop receiving OTA updates. Examples that go in `app.config.ts`: blocked or removed permissions, store and listing metadata, colours, splash and icon paths, update settings. Anything that adds or changes what the JS can call natively must still go in `app.json` (or `modules/`, `plugins/`, a dependency), so the runtime version changes: a native module or config plugin, an entitlement or capability, a usage string or Info.plist key the JS relies on, a permission the JS requests. If unsure, use `app.json`. After any config change, check `runtimeVersionFor('1.0.0')` still prints the pinned value unless a new runtime is intended.

## Repository layout (PLAN.md §6.2)
```
apps/mobile/            expo-router app
packages/engine/        @sanguine/engine (pure TS)
packages/health-adapter/
packages/crypto/
tools/backtest/         Node CLI; tools/backtest/proto.py is the research prototype (reference only)
docs/                   PLAN.md, DECISIONS.md, mockups.html
copy/                   en-AU strings and glossary
```

## Order of work and Expo Go rule
Follow `docs/BACKLOG.md` top to bottom. Phases 0–2 must run in Expo Go on the iOS simulator and the Android emulator with no native build; the Expo Go allow-list in PLAN.md §10 is enforced by CI until Phase 3. If a feature needs a native module before Phase 3, stub it behind the same interface, move the native part to Phase 3 in BACKLOG.md, and keep going. The engine with its golden fixtures (§4.12) comes before any screen.

## Working unattended
You will often work while nobody is watching. Verify every item yourself, but test in this order and no more often than this (owner's rule, 2026-10-09):
1. Make all the edits for the task first; do not test after each small edit.
2. Run only the affected unit tests (`npx vitest related <changed files>` or the test file you touched) plus the type-check.
3. Run only the Maestro flow(s) for the screens you changed, on the **iOS simulator only** (`.maestro/run.sh ios <flow>.yaml`). Never boot the Android emulator: memory cannot hold it next to the iOS simulator; Android gets one dedicated pass when the owner asks for it.
4. Fix what fails and rerun just that test or flow.
5. Run the full unit suite, lint and the deny-list once before committing. Run the full Maestro suite (`suite.sh ios`) only once per batch of items or before a release, never per item.
One simulator runs at a time on this machine: if another session is using it, wait or ask, do not boot a second one. Take screenshots of new screens into `docs/screenshots/<item-id>/` so the work can be reviewed later. If something cannot be verified on the simulator (a physical sensor, a store step), say so in DECISIONS.md and continue with the next item. Never leave the suite red at the end of a session; if an item cannot be finished, revert to the last green commit and record why.

## Definition of done for any task
- Tests written first for engine and data-layer work; a task without tests is not done.
- Type-check, lint and the dependency allow-list job pass.
- Accessibility labels on every interactive element; screens checked at 150% font scale.
- Any item marked VERIFY in PLAN.md that a task depends on is checked against current docs and the outcome recorded in `docs/DECISIONS.md`.
- The certification-readiness artefacts in PLAN.md §2.3 (`docs/regulatory/requirements.md`, `risk-register.md`, `soup.md`, `engine-changelog.md`) are updated whenever an engine rule, a dependency or a parameter changes.
- Commit messages reference the backlog item id.

## Decisions that have no external reviewer
No clinician or regulatory consultant is available, possibly ever. PLAN.md §11.1 and §11.2 list the conservative default for every such decision and the code location that isolates it. Apply those defaults exactly; do not loosen any of them. Where a new question of the same kind arises, choose the more conservative option, isolate it behind one constant, string or flag, and record it in `docs/DECISIONS.md` with the alternative you rejected. Never add a contraception feature, a conception mode, a per-day chance-of-pregnancy figure, or a flag that names a condition.
