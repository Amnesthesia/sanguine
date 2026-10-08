# Progress

One line per finished backlog item.

## Needs human

(none yet)

## Log
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

## Needs human
- Controller/operator identity, privacy contact and email in `docs/privacy-policy.md`, `docs/consumer-health-data-policy.md`, `docs/dpia.md` (marked TBD (human)); legal review of all three drafts before publication.
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
