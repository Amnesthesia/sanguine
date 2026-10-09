# Sanguine

A free, on-device menstrual-cycle tracker for iOS and Android (React Native, Expo). No accounts, no servers, no analytics. Plan: `docs/PLAN.md`; working rules: `CLAUDE.md`; decisions and open items: `docs/DECISIONS.md`, `docs/PROGRESS.md`.

## Layout

| Path | What |
| --- | --- |
| `apps/mobile` | Expo app (expo-router), runs in Expo Go until Phase 3 |
| `packages/engine` | `@sanguine/engine`: pure TypeScript prediction engine (MIT) |
| `packages/crypto` | `@sanguine/crypto`: backup.v1 (Argon2id + XChaCha20-Poly1305), recovery code, note encryption |
| `packages/ui-tokens` | colours, type and radii with automated contrast tests |
| `tools/backtest` | seeded synthetic backtest and CSV replay for the engine |
| `tools/brand` | renders the wordmark, glyph, icon and splash assets |
| `tools/ci` | allow-list, deny-list, SOUP and engine-hash checks |
| `copy/` | all user-facing strings, the glossary and the fixed regulatory wording |
| `docs/regulatory` | requirements trace, risk register, SOUP list, engine change log |

## Everyday commands

```sh
pnpm install
pnpm test          # vitest: engine fixtures, properties, data layer, copy, components
pnpm typecheck     # TypeScript 7
pnpm lint          # Biome
pnpm soup          # regenerate docs/regulatory/soup.md after a dependency change
pnpm engine-hash   # regenerate the engine build hash after an engine change
pnpm --filter @sanguine/backtest backtest synthetic   # also: lambda, csv FILE
```

## Running the app (Expo Go)

```sh
cd apps/mobile && npx expo start --port 8090     # keep file watching on (not CI=1)
```

Open the app in Expo Go on a simulator or emulator. Development-only sample data: `exp://<host>:8090/--/dev/seed?scenario=typical` (`empty`, `typical`, `inProgress`, `irregular`, `skippedLog`; add `&theme=dark`, `&lock=1`).

## End-to-end tests (Maestro, iOS first)

```sh
cd apps/mobile
ITEM=P2-15 .maestro/suite.sh ios        # all flows on the iOS simulator
ITEM=P2-15 .maestro/suite.sh android    # all flows on the Android emulator
.maestro/lock-ios.sh                    # app lock with simulated Face ID (iOS only)
.maestro/fontscale.sh ios|android       # screens at ~150% text size
```

Screenshots land in `docs/screenshots/<item>/`.

## Licence

The app is AGPL-3.0 (`LICENSE`); `packages/engine` is MIT. The name and artwork are not licensed for reuse (`TRADEMARK.md`). Contributions: `CONTRIBUTING.md`. Security reports: `SECURITY.md`. Store listing drafts and review notes: `docs/store/`.

## What is enforced, and where

| Claim | Test |
| --- | --- |
| The engine is pure and deterministic | `packages/engine/src/purity.test.ts`, `properties.test.ts` |
| The health sync core is pure | `packages/health-adapter/src/purity.test.ts` |
| Health sync never duplicates over three cycles | `packages/health-adapter/src/roundTrip.test.ts` |
| No analytics or ad packages; Expo Go allow-list | `tools/ci/deny-list.test.ts` |
| No forbidden words in copy | `copy/copy.test.ts` |
| Symptoms never change a prediction | `packages/engine/src/properties.test.ts` |

