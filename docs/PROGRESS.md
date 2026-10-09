# Progress

One line per finished backlog item. "Needs human" lists what cannot be done without a person.

## Needs human

- Operator legal name in `docs/privacy-policy.md` and `docs/consumer-health-data-policy.md` (contact admin@dothings.lol filled in, D-072); controller and EU representative in `docs/dpia.md` (TBD (human)); legal review of all three before publication.
- Website (D-072): enable GitHub Pages with source "GitHub Actions" in the repository settings; the first push to main then publishes https://amnesthesia.github.io/sanguine/.
- Run the VoiceOver / TalkBack script in `docs/accessibility.md` on a real device and record the result.
- Android: app lock through the device-credential prompt is still untested (setting a PIN locks the emulator itself); Android reminders pass on the dev client (P3-1b).
- Legal review of the three policy drafts and a clinician / regulatory read of `copy/*.json` and the fixtures before any public release (no reviewer exists; defaults are in docs/DECISIONS.md).
- Brand (D-042, D-045): check that the horned mark and the splash taglines (`app.taglines`) do not infringe a third party's trademark ("Blood God" and "Lord of Rage" echo Games Workshop Warhammer phrasing) before any store listing; also confirm the taglines suit the store's health-category review.
- Splash (D-045): run `.maestro/splash.yaml` on the Android emulator once the Android dev client is rebuilt; this session verified iOS only.
- Store accounts, signing credentials and the Apple Health / Health Connect declarations (Phase 5).

## Log

- P1-1 fitCycleLength/predictiveInterval/cyclePrior with fixture numbers; window and recency tested.
- P1-2 classifyCycles with robust exclusion, reasons, life-state overlap.
- P1-3 luteal model, calendar ovulation, confidence, fertileDayProbabilities (A table to 0.01).
- P1-4 detectBbtShift/detectWearableShift: three-over-six, CUSUM, exclusions, provenance factors (D-016).
- P1-5 LH, mucus, cervix detectors and combineOvulation with gate/conflict rules (D-017).
- P1-6 life-state gates, warm-ups, perimenopause suggestion (D-018).
- P1-7 evaluateFlags: all §4.10 flags, age-aware, mute and 90-day raisedOn (D-019).
- P1-9 (part) predict() wired, fixtures A–I green and the failing-gate removed (D-020); build hash still to do after P1-8.
- P1-8 property tests (1000 runs), purity check, seeded backtest CLI reproducing §4.13, λ acceptance FAILED so default λ=1 (D-021, D-022).
- P1-9 fixtures A–I green, engine MIT package with build hash (pnpm engine-hash, CI-checked). Phase 1 complete.
- P2-1 Database interface, expo-sqlite adapter, migrations runner, §5.2 schema with append-only triggers (D-023).
- P2-2 EventStore: validation, append/retract/appendMany, full projection rebuild, order-independent project(), engine inputs (D-024).
- P2-3 prediction-score ledger on cycle close with hindsight-free forecasts, stable rows and summary (D-025).
- P2-4 export zip (events.jsonl + CSVs + README + manifest), Sanguine and CSV import, device services (D-026).
- P2-5 packages/crypto: backup.v1 (Argon2id + XChaCha20-Poly1305 + HMAC), BIP-39 recovery code, RFC 9106 vector, independently verified pinned vector; data/backup.ts and device services (D-027).
- P2-6 app shell: native tabs, theme/i18n/zustand, onboarding gate, DB opens in Expo Go; Maestro shell flow green on iOS simulator and Android emulator.
- P2-7 onboarding: five steps with age gate (13), teen note, life states, consent; Maestro flows green on iOS and Android; component tests (D-029).
- P2-8 Today: PhaseRing, headline/estimate/flag cards, quick-log row, footer; view-model tests; dev scenarios; Maestro green on iOS and Android (D-030).
- P2-9 logging sheet and day detail: 2-tap period and symptom, temperature/tests/mucus/cervix/sex/note, merge rule, corrections; Maestro green on iOS and Android (D-031).
- P2-10 Calendar: month model, graded fertile band, hatched predicted range, ovulation marker, day summary, back-dating; Maestro green on iOS and Android (D-032).
- P2-11 Insights: history rows with missed-log actions, charts (cycle length band, temperature + coverline, symptoms by phase), accuracy ledger text, cycle detail; Maestro green on iOS and Android (D-033).
- P2-12 Settings: life state, privacy and data (export/import/backup/delete), notifications UI, appearance, tracking options, about with engine hash, health placeholder; Maestro green on iOS and Android (D-034, D-035).
- P2-12 follow-up: fixed three security-review findings (masked passphrase fields, secure wipe, cache file cleanup) (D-036).
- P2-13 app lock (Face ID / passcode, 60 s auto-lock, switcher cover, note key gating) verified on iOS with simulated faces; local reminders scheduled from the prediction (iOS; Android moved to P3-1b) (D-037).
- P2-13 follow-up: security-review fixes for the app lock (iOS background→inactive→active, cover until first decision, fail closed); re-lock after 66 s verified on iOS (D-038).
- P2-14 accessibility: static a11y tests, 150% font-scale shots on iOS and Android, reflow fixes, manual script in docs/accessibility.md (D-039).
- P0-1 monorepo scaffold: pnpm workspaces, SDK 57 app, @sanguine/* packages; app bundles in Expo Go on iOS sim and Android emu (screenshots in docs/screenshots/P0-1).
- P0-2 CI: biome lint, tsc typecheck, vitest incl. Expo Go allow-list and analytics deny-list tests; GitHub workflow.
- P0-3 ui-tokens: §9.2 light/dark, glass, M3 roles, type, radii; automated contrast test (3 plan values corrected, D-008).
- P0-4 brand: tools/brand build renders wordmark and S-with-drop to apps/mobile/assets/brand; app.json splash/icon/adaptive icon; config test. Native splash not visible in Expo Go (D-011).
- P0-5 copy: en-AU, legal, flags, glossary, 24-code symptoms; forbidden-word, fixed-wording and symptom tests (D-012..D-014).
- P0-6 engine types (§4.2 + added) and dependency-free studentTQuantile (real ν, bisection on incomplete beta) tested against SciPy.
- P0-7 fixtures A–I as it.fails tests with SciPy-verified numbers (D-015); strict mode shows NotImplemented failures.
- P0-8 DECISIONS.md: §11.1/§11.2 defaults as applied (C-01..C-11, R-01..R-09), VERIFY table V-01..V-12.
- P0-9 docs/regulatory: requirements (ER-01..42), risk register (RK-01..14), generated soup.md with currency test, engine changelog.
- P0-10 drafted privacy policy, consumer-health-data policy and DPIA via agy (spot-checked, forbidden-word test); contact and controller fields TBD (human).
- P2-15 full Maestro suite green on the iOS simulator and the Android emulator in Expo Go; tag v0.2-expo-go (D-040). Phase 2 complete.
- P3-1 (iOS) prebuild + dev client; full Maestro suite and app-lock script green on the iOS dev client; allow-list job retired, deny-list kept (D-041). Android dev-client run follows the P3-2 rebuild.
- Brand: horned mark, brand red #B8324A, splash with rotating taglines (D-042); splash redesign with the Cinzel wordmark, vignette and bottom tagline from the owner's mock-ups (D-045).
- P3-2 SQLCipher at rest with a device-bound Secure Store key; plain database migrated in place; at-rest check in the suite (D-043).
- P3-3 Liquid Glass quick-log pill with Reduce Transparency and pre-iOS 26 fallbacks; tab bar already system glass (D-044).
- P3-1 (Android) and P3-1b: full Maestro suite green on the Android dev client (API 35 emulator), including Android reminders and the SQLCipher at-rest check; onboarding keyboard fix for edge-to-edge (D-041).
- P3-4 Material 3 Expressive: native Compose floating toolbar through @expo/ui (D-046); shape morph on press is a recorded gap.
- P3-5 iOS widget (small, medium, lock screen) from an App Group snapshot, discreet by default (D-047). P3-6 discreet "Notes" icon and screen protection (D-048); Android Glance widget deferred (P3-5b).
- Needs human: confirm on a phone that screen protection blanks screenshots and the recent-apps picture (the simulators bypass it).
- Brand v2 (client-supplied): the client's emblem and logotype, lock-up splash with six rotating taglines, icons (D-049), then cut back by the owner the same day: blush/plum tokens, Cormorant titles, shapes and watermark reverted to the pre-v2 white/black design, the brand kept on the splash, icon and About band only (D-051); audience wording: women (D-050). Needs human: the client's original emblem.png, logotype.png and client-logo.jpeg (assets were cut from the reference renders).
- Full iOS dev-client suite green on the reverted tree after the date-of-birth change (D-051, D-055): shell, onboarding, age gate, today, splash, logging, calendar, insights, settings, backup, discretion, delete, notifications, export, app lock (simulated Face ID), encrypted at rest. Screenshots in docs/screenshots/D-051-revert-devclient. Android last green earlier the same day (full suite except a transient adb 'device offline'); full Android pass is P3-14.
- P4-1 `packages/health-adapter`: types, pure mapping (§5.5 day attribution, §7.1 table), sync core (echo prevention, duplicates, conflicts, deletions, writes, anchors), fake driver, and the §10 round trip (3 cycles, zero duplicates). 63 tests; D-057.
- P5-3 release readiness (D-058): privacy manifest, EAS profiles, release workflow without OTA, store listing and reviewer notes, Play health declaration draft; `tools/ci/store.test.ts`. AGPL LICENSE, TRADEMARK, SECURITY, CONTRIBUTING added (P5-4 part).
- Needs human (Phase 5): App Store Connect and Play Console accounts, signing credentials, the `EXPO_TOKEN` secret registered in the repository, export-compliance answers (the backup uses XChaCha20-Poly1305 and Argon2id), age-rating questionnaires, the client's permission to publish the brand assets, making the repository public.
- P6-2 (tools part): `tools/ci/i18n.ts` exports 460-odd source strings to `docs/i18n/strings-for-translation.csv` (regulatory rows flagged), validates a returned CSV (keys, placeholders, length) and writes `copy/<locale>.json`; translator brief in `docs/i18n/README.md`. Needs human: translators and a clinician check for de, fr, es, pt-BR.

- P3-8 final icon and splash assets: native iOS icon (light/dark/tinted catalog) installed and seen on the simulator; splash verified earlier; Android adaptive icon built, on-device look deferred to P3-14 (D-059).
- P4-1..P4-4 health sync (D-057, D-060): adapter core, HealthKit and Health Connect drivers, Settings > Health sync, sync wiring. iOS simulator flow `health.yaml` green (import, second pass adds nothing, remote deletion retracts). Needs human: a real Apple Watch check for wrist temperature (P4-5); Android runtime check in P3-14 (also the unverified Health Connect permission strings, D-060 (7)).
- P3-7 cloud copy (D-061): switch, upload, restore from cloud verified on the simulator (`cloud-backup.yaml`) with the local test folder; iCloud Drive module built and linked, Google Drive store written and unit-tested; native Argon2id at the plan's cost. Needs human: an Apple Developer team with the iCloud container `iCloud.app.sanguine.mobile` and a signed-in device to see the iCloud path; a Google Cloud project with the Drive API and an Android OAuth client id in `app.json` `extra.googleDriveClientId`.
- P6-1..P6-3, P5-4 (D-063): locale rules, translation pipeline, consent record and explicit step, in-app policy screens (hidden until the placeholders are filled). Needs human: the controller identity, privacy contact and response times in the policies and DPIA; a GDPR representative; legal review; translators for de, fr, es, pt-BR plus a clinician check of the regulatory rows; the Flo and Clue sample exports (D-062).
- P5-2 under-18 audit (D-064): `fertilityTools` gate on the calendar legend, logging sheet, Insights and Health sync; `teenAudit.test.ts` and `teen.yaml` (green on the iOS simulator).
- P5-5 Store data (D-072): listing with promotional text, URLs and privacy answers; framed store screenshots, Play feature graphic and icon; website with privacy, health-data and support pages.
- D-076 UI pass from the 2026-10-10 review: double top inset removed, one text-button style, estimate title without the repeated range, visible fertile band floor, sparse-chart thresholds, settings subtitles, native dark mode follows the theme. iOS flows green; screenshots in docs/screenshots/D-076-devclient.
- P8-1 drip import: drip's CSV (bleeding, temperature, mucus, cervix, sex, pain, mood, desire, notes) through the shared DailyRow writer; unmapped fields reported (D-078).
- P8-2 Add to someone's calendar: .ics of the 80% period range and an optional fertile range (never one day, teen-gated), stable UIDs; share-calendar.yaml green on iOS (D-079).
