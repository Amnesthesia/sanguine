# Contributing

Read `CLAUDE.md` (the rules every change follows) and `docs/PLAN.md` sections 4, 5 and 6 before you start. In short:

- The prediction engine (`packages/engine`) and the health sync core (`packages/health-adapter`) are pure TypeScript: no React, no platform APIs, no I/O, no clock, no randomness.
- No network calls, no analytics, crash-reporting, advertising or attribution packages. CI fails the build if one appears (`tools/ci`). The one exception is the optional backup to the user's own iCloud Drive or Google Drive.
- Symptoms never change a prediction. Every prediction is a range with a confidence grade.
- Event rows are append-only: retract, never update or delete.
- The wording in PLAN.md §2.3 is fixed, and the forbidden-word list is enforced by `copy/copy.test.ts`. Never add a contraception feature, a conception mode, a per-day chance-of-pregnancy figure or a flag that names a condition.
- Tests first for engine and data-layer work. `pnpm test`, `pnpm typecheck` and `pnpm lint` must pass.
- Record any deviation or new decision in `docs/DECISIONS.md` and update the regulatory files in `docs/regulatory/` when an engine rule, a dependency or a parameter changes.

By contributing you agree your contribution is licensed under the AGPL-3.0 (the engine package under MIT). The brand assets are not covered: see `TRADEMARK.md`.
