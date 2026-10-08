# Decisions

Format: ID, date, decision, alternative rejected and why.

## Tooling

- D-001 (2026-10-09) TypeScript 7.0.2 across the workspace (user preference). `expo install --check` expects ~6.0.3; Metro uses Babel so the app bundles fine; type-check uses `tsc` 7. Rejected: pinning 6.0 to silence the Expo warning.
- D-002 (2026-10-09) pnpm with `node-linker=hoisted` (`.npmrc`) so Metro resolves packages without symlink config. Rejected: isolated linker plus custom Metro resolver; more config for no gain.
- D-003 (2026-10-09) All workspace packages scoped `@sanguine/*` (user instruction), including `@sanguine/mobile`.
- D-004 (2026-10-09) Template `expo-glass-effect`, `react-native-web`, `react-dom` removed from `apps/mobile`: glass is Phase 3 (allow-list), web is not a target.
- D-005 (2026-10-09) Dev server ports 8090 (iOS) and 8091 (Android) because 8081 is used by another local project.

## VERIFY items

(filled in P0-8)
