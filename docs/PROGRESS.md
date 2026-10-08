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
