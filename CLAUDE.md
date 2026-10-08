# Sanguine — instructions for Claude Code

You are building Sanguine, a free, on-device menstrual-cycle tracker for iOS and Android (React Native + Expo). The complete design and architecture plan is in `docs/PLAN.md`. Read sections 4, 5 and 6 in full before writing any code; read the section relevant to a task before starting it. The plan is the source of truth; if you must deviate, record why in `docs/DECISIONS.md` and keep going.

## Brand
Splash: wine red #6A1220 with the white "Sanguine" wordmark in Dancing Script 700. Icon: white script S whose tail ends in a drop, on the same red. The brand colour appears only on the splash, the icon and the About band; the in-app accent is garnet #9E2A3C. Never use the Fana Studio font from the reference image. (PLAN.md §9.9)

## Non-negotiables (never change without a human decision)
- The prediction engine (`packages/engine`) is pure TypeScript: no React, no platform APIs, no I/O, no `Date.now()`, no randomness. `predict(history, settings, today)` is deterministic.
- No network calls anywhere except the optional, client-side-encrypted backup to the user's own iCloud Drive / Google Drive app folder (Phase 3). No analytics, crash-reporting, ad or attribution SDKs. CI fails the build if one appears.
- Symptoms (cramps, mood, acne, breast tenderness, mittelschmerz, etc.) never change a prediction. Only period dates, BBT, wearable temperature, LH tests, cervical mucus and cervical position do.
- Every prediction is a range with a confidence grade. Never render a single highlighted "fertile day".
- The regulatory wording in PLAN.md §2.3 is fixed copy. The forbidden-word list in §2.3 and §8.7 is enforced by a test over `copy/*.json`.
- Local data is SQLCipher-encrypted from Phase 3 (the key lives in Secure Store); the `Database` interface accepts the key from day one so the switch is a config change. Event rows are append-only: never UPDATE or DELETE an `event`; retract instead.
- Teen mode (age 13–17) hides fertility language by default; the minimum age is 13.

## Stack (PLAN.md §6.1)
Phases 0–2 (Expo Go): expo-router with native tabs, expo-sqlite (plain), expo-secure-store, expo-local-authentication, expo-notifications (local), expo-file-system, expo-sharing, expo-document-picker, @expo-google-fonts/dancing-script, expo-blur, @expo/ui, reanimated, react-native-svg, zustand, i18next, @noble/ciphers, @noble/hashes, vitest, fast-check, Maestro. Phase 3+: prebuild + dev client, expo-sqlite `useSQLCipher: true`, expo-glass-effect, Expo widgets, alternate icons, `MaterialExpressiveTheme`, `@kingstinct/react-native-healthkit`, `react-native-health-connect` v4. Expo SDK 57 now; upgrade to 58 at its stable release.

## Visual reference
`docs/mockups.html` renders the five core screens (Today, logging sheet, Calendar, Insights, onboarding) in both platform treatments with the sample data from PLAN.md §9.6; `docs/brand.html` renders the splash, icon and wordmark. Open them in a browser before building any screen and match them; the per-screen table in §9.7 and the Claude Design prompts in §9.8 specify the screens and states the HTML does not show (settings screens, widgets, every error and empty state).

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
You will often work while nobody is watching. Verify every item yourself: unit tests, then the Maestro flow on both simulators through Expo Go (`npx expo start`, open in the simulator, `maestro test`). Take screenshots of new screens into `docs/screenshots/<item-id>/` so the work can be reviewed later. If something cannot be verified on the simulator (a physical sensor, a store step), say so in DECISIONS.md and continue with the next item. Never leave the suite red at the end of a session; if an item cannot be finished, revert to the last green commit and record why.

## Definition of done for any task
- Tests written first for engine and data-layer work; a task without tests is not done.
- Type-check, lint and the dependency allow-list job pass.
- Accessibility labels on every interactive element; screens checked at 150% font scale.
- Any item marked VERIFY in PLAN.md that a task depends on is checked against current docs and the outcome recorded in `docs/DECISIONS.md`.
- The certification-readiness artefacts in PLAN.md §2.3 (`docs/regulatory/requirements.md`, `risk-register.md`, `soup.md`, `engine-changelog.md`) are updated whenever an engine rule, a dependency or a parameter changes.
- Commit messages reference the backlog item id.

## Decisions that have no external reviewer
No clinician or regulatory consultant is available, possibly ever. PLAN.md §11.1 and §11.2 list the conservative default for every such decision and the code location that isolates it. Apply those defaults exactly; do not loosen any of them. Where a new question of the same kind arises, choose the more conservative option, isolate it behind one constant, string or flag, and record it in `docs/DECISIONS.md` with the alternative you rejected. Never add a contraception feature, a conception mode, a per-day chance-of-pregnancy figure, or a flag that names a condition.
