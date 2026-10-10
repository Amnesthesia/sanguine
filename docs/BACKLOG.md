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
- [x] P3-7 (D-061; verified on the iOS simulator with the local test folder: switch on, recovery code first, encrypted upload, wipe, restore; the iCloud account and a Google OAuth client id are the owner's, see PROGRESS; native Argon2id at 64 MiB x 3 adopted) Cloud backup upload: iCloud Drive container (entitlement) and Google Drive appDataFolder (expo-auth-session); restore E2E across two simulators. (§6.3)
- [x] P3-8 Final icon and splash assets built natively (Icon Composer layers, adaptive icon). (§9.9)
- [x] P3-9 Period runs join across gaps up to 7 days unless the user splits them; `period.start { merge: false }` splits. (§5.4, client review 1 #3)
- [x] P3-10 λ documentation fix: PLAN §4.3/§4.12/§11.1 and types.ts say the shipped default (λ = 1, D-021); fixtures pinned to RECENCY_LAMBDA. (client review 1 #4)
- [x] P3-11 Mockup weekday labels corrected (10 Oct 2026 is a Saturday). (client review 1 #5)
- [x] P3-12 Pregnancy outcome (birth / loss) on ending the pregnant state; post-pregnancy bleeding kind; "I was pregnant" action on long cycles; neutral long-cycle wording. (§4.9, client review 1 #2)
- [x] P3-13 Natural Cycles import: the app's daily-entries export (.xlsx, or the same columns as CSV, plain or as "Daily Entries.csv" in a zip) imports flow (including bleeding after a loss), temperature, LH and pregnancy tests, mucus, symptoms and notes through the shared DailyRow writer (`data/importDaily.ts`, `data/importNaturalCycles.ts`); what it cannot map is reported (D-056). (§8.10, client review 1 #1)
- [ ] P3-14 (mostly done, D-070: suite, encryption and the Health Connect first pass checked on the emulator; left: `cloud-backup.yaml` on Android, the Health Connect Toolbox import and the hourly task, the Play store captures (the iOS slides were re-shot after D-076, the Android ones still show the old layout)) Full Android check and fix-up, run as one dedicated pass when memory allows (owner decision 2026-10-09: iOS-only testing until then): rebuild the Android dev client, run `.maestro/suite.sh android` and `fontscale.sh android`, retake the Android screenshots, fix what fails (known untested: app lock through the device-credential prompt; Android launcher-alias deep links; dark-mode toolbar contrast), and record the outcome.

## Phase 4 — Health sync (§7)

- [x] P4-1 `packages/health-adapter` core with a fake driver (D-057): mapping §7.1, sync tables, echo prevention, conflicts, deletions §7.3; the §10 round-trip scenario as a test.
- [x] P4-2 iOS driver (D-060; verified on the simulator with `health.yaml`; background delivery observed) (`@kingstinct/react-native-healthkit`): anchored queries, background delivery, metadata `com.sanguine.eventId`, deletes by UUID; simulator tests with seeded HealthKit data. VERIFY: third-party write for contraceptive/pregnancy/lactation; background-delivery frequency per type.
- [ ] P4-3 (code complete and mapping tested, D-060; the runtime check with the Health Connect Toolbox is in P3-14) Android driver (`react-native-health-connect` v4): changes API with token persistence, `clientRecordId` upsert, background read + WorkManager hourly, history permission; emulator tests with the Health Connect Toolbox. VERIFY: changes-token expiry.
- [x] P4-4 (iOS verified; Android in P3-14) Health sync settings and permission UX (§7.5); Play health declaration and Apple usage strings (§6.6).
- [ ] P4-5 (read path built and the mapping tested on both platforms, D-060; needs a real Apple Watch or a Health Connect device to see data) Wrist/finger temperature import into the wearable series. (§4.6)

## Phase 5 — Launch (Australia), Phase 6 — International, Phase 7 — Regulated tier
As PLAN.md §10. Phase 5 needs store accounts and signing credentials from the human; the items below are everything that does not.

- [ ] P5-1 (blocked: no documented export format, D-062; needs sample exports from the owner) Flo and Clue importers through the shared DailyRow writer (§8.10; VERIFY current export formats).
- [x] P5-2 (D-064) Teen-mode audit: every surface checked against the teen rules by a test; Maestro teen flow. (§2.4, §11)
- [x] P5-3 Release readiness: privacy manifest, EAS profiles, tag-triggered release workflow (no OTA), store listing, review notes and Play health declaration drafts, checked by `tools/ci/store.test.ts` (D-058). Owner: accounts, signing, `EXPO_TOKEN`, submission.
- [x] P5-4 (code and files done; the owner's items are in PROGRESS) Open-source and policy files (AGPL `LICENSE`, `TRADEMARK.md`, `SECURITY.md`, `CONTRIBUTING.md`, README claims table: done in D-058); in-app policy screens and the consent record. Owner: publishing the repository, brand permission, legal review.
- [x] P5-5 (D-072; owner: enable GitHub Pages with source "GitHub Actions", legal name for the operator and the App Store copyright) Store data: listing text, framed store screenshots, Play feature graphic and icon (`tools/brand/store.ts`), the public website with privacy, health-data and support pages (`apps/site/`, Astro since D-074, `.github/workflows/pages.yml`), contact filled into the policies, privacy answers that declare the update check's installation id.
- [x] P6-1 (D-063) Localisation infrastructure with en-GB and en-US overrides, °F display and entry for en-US, device first weekday, locale snapshot tests. (§6.4)
- [x] P6-2 (pipeline and loader done, D-063; translations need translators and a clinician check, see PROGRESS) Translation pipeline for de, fr, es, pt-BR (extract, validate, load): no machine translation; the translations themselves need translators and a clinician check.
- [x] P6-3 (D-063; controller, representative and legal review are the owner's) GDPR Article 9 explicit-consent step for EU/UK regions, US state health-data policy text. Owner: controller identity, GDPR representative, legal review.

## Phase 8 — Competitive gaps (docs/ROADMAP.md §2.3; plan docs/superpowers/plans/2026-10-10-competitive-gaps.md)

- [x] P8-1 drip import through the shared DailyRow writer, cervix included (D-078; roadmap R2-4).
- [x] P8-2 Calendar (.ics) export of the predicted period range, optional fertile range, teen-gated (D-079; R2-3, owner approved in D-077).
- [x] P8-3 "How Sanguine estimates" reference pages under About (R2-6).
- [x] P8-4 Perimenopause view in Insights: variability facts, vasomotor symptom counts, no stage label, no 12-month milestone (R3-1, D-081).
- [x] P8-5 Pregnancy view on Today: gestational week and day, due date as a range (R3-2, D-082).
- [x] P8-6 Report for a doctor, PDF on the device through expo-print (R2-1, D-084).
- [x] P8-7 Sync between the user's own devices: merge core with property tests first, then transport through the backup channel (R5-1, D-077, D-083).
- [x] P8-8 Home-screen quick actions on both platforms (D-085; R2-2). Siri, App Shortcuts and Control Center wait for expo-app-intents at the SDK 58 upgrade (spike result in D-085).
- [ ] P8-9 Apple Watch app (R4-1): spike done (D-086); needs the owner's decision on the experimental expo-apple-targets plugin and a Swift watch target.
- [ ] P8-10 Android Glance widget and Wear OS tile (R4-2, P3-5b): spike done (D-086); blocked until expo-widgets supports Android (re-check at SDK 58).
- [x] P8-11 Today look-back symptom note: own logs only, past tense, allow-listed physical codes, switchable (D-087; amends C-10).
- [x] P8-12 Prediction test suite: how forecasts move with new input (early, late, missed, loss, contraception, tests), synthetic life-event backtest with candidate models, fake Natural Cycles export round trip, and a local-only backtest on a real export (D-091). Tests only; findings left for the owner.
- [x] P8-13 Prediction improvements from P8-12 (D-094, engine 0.2.0): ranges from her own errors, per-user recency, softer post-loss warm-up with a range floor, long-cycle limit as of closure, the short-cycle question on Today, `post_pregnancy` flowKind; learning-over-time tests. Open: a dated range once the forecast has passed (finding g, UI decision first)
- [ ] P8-14 Feedback channel without analytics (R1-5): a GitHub issue template, and a "Send feedback" row in About that opens a `mailto:` carrying the app and engine versions and no user data, with a line saying an e-mail reveals the sender's address and a GitHub issue is the more anonymous route.
- [ ] P8-15 Backup reminder, once (R2-5): after the second logged cycle, if the backup is off, one quiet Today card ("Set up" / "Not now"; "Not now" hides it for 6 months; never again once the backup is set up). No badge, no notification.
- [ ] P8-16 Public threat model (R5-2): `docs/security/threat-model.md` (what someone holding the phone, the cloud folder or a backup file can and cannot read) and the `packages/crypto` test vectors, linked from `SECURITY.md` and the website. Submitting to Mozilla's *Privacy Not Included* is the owner's.
- [ ] P8-17 Accuracy page per engine version (R5-3): the `tools/backtest` coverage and MAE tables on the website under "engine validation on synthetic cycles", whose first sentence says synthetic cycles are not real users.
