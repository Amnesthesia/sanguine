# Conventions and non-negotiables (one page)

Full text: `CLAUDE.md` and `docs/PLAN.md`. This is the checklist to hold in your head while editing.

## Never change without a human decision

1. **Engine purity.** `packages/engine`: pure TypeScript, no React, no platform APIs, no I/O, no `Date.now()`, no randomness.
   `predict(history, settings, today)` is deterministic. If you change a rule or parameter: update the fixtures, bump
   `docs/regulatory/engine-changelog.md`, run `pnpm engine-hash`, keep `soup.md` and the risk register current.
2. **No network** except the optional client-side-encrypted backup upload to the user's own cloud app folder. No analytics,
   crash reporting, ads or attribution SDKs (CI fails the build).
3. **Symptoms never change a prediction.** Only period dates, BBT, wearable temperature, LH tests, cervical mucus and cervical
   position do.
4. **Ranges, not points.** Every prediction is a range with a confidence grade. Never render a single highlighted "fertile day".
5. **Fixed wording.** The regulatory sentences of PLAN §2.3 are fixed copy. The forbidden-word list (§2.3, §8.7) is enforced by
   `copy/copy.test.ts` over every `copy/*.json`.
6. **Append-only events.** Never UPDATE or DELETE an `event` row; retract instead (a trigger blocks it).
7. **Encryption at rest.** SQLCipher, key in Secure Store; the `Database` interface takes the key.
8. **Teen mode (13–17)** hides fertility language by default; minimum age is 13.
9. **No contraception feature, conception mode, per-day chance-of-pregnancy figure, or flag that names a condition.**

## Decisions without a reviewer

No clinician or regulatory consultant is available. For a new question of that kind: choose the **more conservative** option,
put it behind one constant/string/flag, and record it in `docs/DECISIONS.md` with the alternative you rejected.

## Code style

- Match the surrounding file: comment density, naming, idiom. Comments say **why** (and cite `PLAN §n` / `D-0nn`), not what.
- Pure logic goes in a pure module with a test (examples: `data/cipher.ts`, `features/splash/tagline.ts`,
  `services/widgets.ts#widgetSnapshot`, `features/lock/lockModel.ts`). Screens stay thin.
- Strings come from `copy/*.json` through i18next (`{x}` interpolation). Never hard-code user-facing text in a component.
- Every interactive element has an accessibility label, a 44 pt target, and a `testID` if a flow needs it
  (`a11y.test.ts` checks this statically). Check screens at 150% text size (`fontscale.sh`).
- Meaning is never colour alone (calendar marks use shape + words).
- Animation: the app has none except `BrandSplash` (`a11y.test.ts` allows exactly that file; opacity only; none under Reduce Motion).
- No `any`; Biome must be clean.
- Native modules are **lazy-required** where a platform can lack them; a failing optional feature must never break the app
  (widget sync swallows errors; reminders guard `remindersSupported`).
- Secrets: never log keys, the device secret, recovery words or note text; clear typed passphrases from state; temp files are
  removed after use (`services/tempFiles.ts`).

## Tests

- Engine, data layer and crypto work are **test-first**. A task without a test is not done.
- Data tests use `better-sqlite3` through `data/testDb.ts`; component tests render React Native through react-native-web in
  jsdom (`vitest.config.ts` aliases).
- Property tests (fast-check) guard engine invariants; golden fixtures A–I are asserted from the plan's formulas
  (D-015 explains where plan figures were inconsistent).
- End-to-end: Maestro on both platforms for any screen item; screenshots into `docs/screenshots/<item>/`.

## Docs you must keep current

| When you … | Update |
| --- | --- |
| add/remove/upgrade a dependency | `pnpm soup` (SOUP list), and the allow/deny lists if relevant |
| change an engine rule or parameter | `docs/regulatory/{requirements,risk-register,engine-changelog}.md`, engine hash |
| finish a backlog item | `docs/BACKLOG.md` tick, `docs/PROGRESS.md` line, screenshots |
| decide or deviate | `docs/DECISIONS.md` (append; correct old entries with a new entry) |
| change brand or tokens | `docs/PLAN.md` §9, `docs/brand.html`, `docs/mockups.html`, the brand test |

## Writing for the owner

Short, direct, no filler. State what you did, what you verified (and how), and what you could not verify. Mention gaps
and anything that needs a human (store accounts, legal review, physical-device checks) under "Needs human" in
`docs/PROGRESS.md`.
