# Sanguine backlog

Ordered for unattended work. Phases 0–2 run entirely in Expo Go on the iOS simulator and Android emulator; the first `expo prebuild` happens at P3-1 and not before. Each item names the PLAN.md section that specifies it and ends when its tests pass. Items marked **gap** need the agent to propose, implement and record a decision in `docs/DECISIONS.md`.

## Phase 0 — Foundations (Expo Go + Node, §10)

- [x] P0-1 Monorepo scaffold: pnpm workspaces; `apps/mobile` created with `create-expo-app` on SDK 57 (expo-router template, TypeScript); `packages/engine`, `packages/health-adapter` (empty), `packages/crypto`, `packages/ui-tokens`, `tools/backtest`, `tools/brand`, `docs/`, `copy/`. Verify `npx expo start` opens in Expo Go on both simulators. (§6.2)
- [x] P0-2 CI: lint, type-check, vitest; `tools/ci/expo-go-allowlist.test.ts` fails if `apps/mobile/package.json` contains a package outside the Expo Go allow-list in PLAN.md §10 (until Phase 3 opens); deny-list job for analytics/ad/crash SDKs. (§6.6, §10)
- [x] P0-3 `packages/ui-tokens`: light/dark values from §9.2, iOS glass and Android M3 roles; automated contrast test.
- [x] P0-4 Brand: `tools/brand/build.ts` tints `docs/brand-v2/emblem.png` and `logotype.png`, composes the lock-up, splash (blush and plum) and icon files; `app.json` splash (`backgroundColor` #F5E8E2, dark #2A1518, lock-up image), icon and adaptive icon; tagline rotation component; confirm the splash renders in Expo Go on both simulators. (§9.9, docs/REDESIGN_PROMPT.md)
- [x] P0-5 `copy/glossary.en-AU.json`, `copy/en-AU.json` (every string in §2.3, §4.10, §8.6, §8.7, §9.6 plus Settings strings), `copy/symptoms.json` (24 codes, 8 default-visible); forbidden-word test. **gap**: Settings strings and the full symptom list.
- [x] P0-6 `packages/engine` types exactly as §4.2; `studentTQuantile` without dependencies, tested against the SciPy values ν ∈ {5,6,8,10,11,13}, p ∈ {0.9, 0.975}. (§4.11)
- [x] P0-7 Golden fixtures A–I as failing tests with the numbers in §4.12 (tolerance 0.05 d). **gap**: add expected fertile-day probabilities for B–E from the §4.8 formula.
- [x] P0-8 `docs/DECISIONS.md` with every §11.1 and §11.2 default copied in as applied, and every VERIFY item with status.
- [x] P0-9 `docs/regulatory/`: `requirements.md`, `risk-register.md`, `soup.md` (generated), `engine-changelog.md`. (§2.3)
- [x] P0-10 `docs/privacy-policy.md`, `docs/consumer-health-data-policy.md`, `docs/dpia.md` drafted from §2.4–2.5 and §6.3.

## Phase 1 — Engine (Node, §4)

- [x] P1-1 `fitCycleLength` (weighted NIG, λ = 0.92, window 12, age-band priors) and `predictiveInterval`. (§4.3)
- [x] P1-2 `classifyCycles` with robust exclusion and quality codes. (§4.4)
- [x] P1-3 Luteal model, calendar-only ovulation estimate, `fertileDayProbabilities`. (§4.5, §4.8)
- [x] P1-4 `detectBbtShift`: three-over-six + coverline, CUSUM secondary, disturbance and time exclusion, separate wearable series. (§4.6)
- [x] P1-5 `detectLhSurge`, `detectMucusPeak`, cervical position, `combineOvulation` with the temporal gate and conflict rule. (§4.6)
- [x] P1-6 Life-state gates. (§4.9)
- [x] P1-7 `evaluateFlags`, age-aware, 90-day rate limit. (§4.10)
- [x] P1-8 Property tests (§4.15) with fast-check; `tools/backtest` CLI porting `proto.py` and reproducing the §4.13 table; λ acceptance test.
- [x] P1-9 All fixtures A–I green; engine published to the workspace with a build hash exposed for About.

## Phase 2 — Core app in Expo Go (§8, §9)

Data layer
- [x] P2-1 `Database` interface (`open(key?)`) over plain expo-sqlite; migrations runner; schema from §5.2; the key parameter is accepted and ignored until Phase 3.
- [x] P2-2 Event writer with retract semantics; projections; rebuild command; idempotence test. (§5.3–5.4)
- [x] P2-3 Prediction-score ledger on cycle close. (§4.15)
- [x] P2-4 Export zip (events.jsonl + CSVs + README via expo-file-system and expo-sharing) and import (Sanguine format, CSV of period starts via expo-document-picker). (§8.10)
- [x] P2-5 `packages/crypto`: Argon2id (@noble/hashes) + XChaCha20-Poly1305 (@noble/ciphers) backup file format from §6.3; encrypt/decrypt round-trip tests with fixed vectors; backup saved through the share sheet (cloud upload is P3-7).

Screens (each item: component tests + a Maestro flow on both simulators; match `docs/mockups.html` for the five core screens and PLAN.md §9.7–9.8 for the rest)
- [x] P2-6 App shell: expo-router native tabs, fonts, theme provider, Expo Go-safe chrome (expo-blur stands in for glass; @expo/ui Jetpack Compose theme on Android). (§9.1)
- [x] P2-7 Onboarding, 5 steps, teen mode. (§8.3, §8.6)
- [x] P2-8 Today: PhaseRing, HeadlineCard, EstimateCard (flag `SHOW_OVULATION_ESTIMATE`), QuickLogRow, FlagCard, footer wording. (§8.3, §9.5)
- [x] P2-9 Logging sheet and day detail; Maestro asserts the 2-tap period log and 2-tap symptom log. (§8.4)
- [x] P2-10 Calendar with 80%/95% ranges, graded fertile band, ovulation marker; back-dating flow. (§8.5)
- [x] P2-11 Insights: history, charts, accuracy. (§8.3)
- [x] P2-12 Settings: life state, privacy and data, notifications, appearance, tracking options, about (wordmark band, engine hash). (§8.2)
- [x] P2-13 App lock with expo-local-authentication; discreet notification defaults; local notifications scheduled from the prediction interval. (§8.8, §6.1)
- [x] P2-14 Accessibility pass (§8.9): labels, 150% font scale screenshots on both simulators, reduced-motion check.
- [x] P2-15 Full Maestro suite green on iOS simulator and Android emulator in Expo Go; tag `v0.2-expo-go`.

## Phase 3 — First native build (dev client, §10)

- [x] P3-1 `expo prebuild` with config plugins; dev-client builds for both simulators (local `expo run:ios` / `expo run:android`); all Phase 2 Maestro flows pass on the dev client. Remove the Expo Go allow-list job.
- [x] P3-1b Android local reminders on the dev client: `expo-notifications` cannot be imported in Expo Go on Android (SDK 53+), so P2-13 ships `remindersSupported = false` there; enable and re-run `apps/mobile/.maestro/notifications.yaml` on the emulator. (§6.1)
- [x] P3-2 SQLCipher: `useSQLCipher: true`, key generated on first launch into expo-secure-store, `PRAGMA key` on open; migration of any existing plain DB; test that the file is unreadable without the key. (§6.1)
- [x] P3-3 Liquid Glass tab bar and quick-log pill with expo-glass-effect; Reduce Transparency and pre-iOS 26 fallbacks. (§9.1)
- [x] P3-4 Material 3 Expressive theme via @expo/ui jetpack-compose with `MotionScheme.expressive()`; shape-morphing Period button; system animation-scale check. (§9.1)
- [x] P3-5 Widgets: iOS lock screen/home; discreet defaults. (§8.3) Android Glance moved to P3-5b.
- [ ] P3-5b Android Glance widget when expo-widgets' Android renderer is more than a placeholder (D-047).
- [x] P3-6 Alternate app icons (discreet "Notes"); screenshot protection. (§8.8, §9.9)
- [ ] P3-7 Cloud backup upload: iCloud Drive container (entitlement) and Google Drive appDataFolder (expo-auth-session); restore E2E across two simulators. (§6.3)
- [ ] P3-8 Final icon and splash assets built natively (Icon Composer layers, adaptive icon). (§9.9)
- [x] P3-9 Period runs join across gaps up to 7 days unless the user splits them; `period.start { merge: false }` splits. (§5.4, client review 1 #3)
- [x] P3-10 λ documentation fix: PLAN §4.3/§4.12/§11.1 and types.ts say the shipped default (λ = 1, D-021); fixtures pinned to RECENCY_LAMBDA. (client review 1 #4)
- [x] P3-11 Mockup weekday labels corrected (10 Oct 2026 is a Saturday). (client review 1 #5)
- [x] P3-12 Pregnancy outcome (birth / loss) on ending the pregnant state; post-pregnancy bleeding kind; "I was pregnant" action on long cycles; neutral long-cycle wording. (§4.9, client review 1 #2)
- [x] P3-13 Natural Cycles import: the app's daily-entries export (.xlsx, or the same columns as CSV, plain or as "Daily Entries.csv" in a zip) imports flow (including bleeding after a loss), temperature, LH and pregnancy tests, mucus, symptoms and notes through the shared DailyRow writer (`data/importDaily.ts`, `data/importNaturalCycles.ts`); what it cannot map is reported (D-056). (§8.10, client review 1 #1)
- [ ] P3-14 Full Android check and fix-up, run as one dedicated pass when memory allows (owner decision 2026-10-09: iOS-only testing until then): rebuild the Android dev client, run `.maestro/suite.sh android` and `fontscale.sh android`, retake the Android screenshots, fix what fails (known untested: app lock through the device-credential prompt; Android launcher-alias deep links; dark-mode toolbar contrast), and record the outcome.

## Phase 4 — Health sync (§7)

- [ ] P4-1 `packages/health-adapter` core with a fake driver: mapping §7.1, sync tables, echo prevention, conflicts, deletions §7.3; the §10 round-trip scenario as a test.
- [ ] P4-2 iOS driver (`@kingstinct/react-native-healthkit`): anchored queries, background delivery, metadata `com.sanguine.eventId`, deletes by UUID; simulator tests with seeded HealthKit data. VERIFY: third-party write for contraceptive/pregnancy/lactation; background-delivery frequency per type.
- [ ] P4-3 Android driver (`react-native-health-connect` v4): changes API with token persistence, `clientRecordId` upsert, background read + WorkManager hourly, history permission; emulator tests with the Health Connect Toolbox. VERIFY: changes-token expiry.
- [ ] P4-4 Health sync settings and permission UX (§7.5); Play health declaration and Apple usage strings (§6.6).
- [ ] P4-5 Wrist/finger temperature import into the wearable series. (§4.6)

## Phase 5 — Launch (Australia), Phase 6 — International, Phase 7 — Regulated tier
As PLAN.md §10. Phase 5 needs store accounts and signing credentials from the human; nothing else does.
