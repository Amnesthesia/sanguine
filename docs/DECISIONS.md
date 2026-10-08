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
- D-006 (2026-10-09) Lint with Biome (`biome lint .`), not ESLint: typescript-eslint refuses TypeScript 7 ("does not support TS 7.0"). Rejected: downgrading to TS 6 (conflicts with D-001) and `expo lint` (pulls ESLint).
- D-007 (2026-10-09) Allow-list (`tools/ci/lists.ts`) adds the Expo Go built-ins the SDK 57 template needs (expo-constants, expo-device, expo-image, expo-linking, expo-splash-screen, expo-status-bar, expo-symbols, expo-system-ui, expo-web-browser, safe-area-context, worklets) and `react-i18next`; all are bundled in Expo Go. Rejected: stripping them (template and expo-router depend on them).
- D-008 (2026-10-09) Contrast test (P0-3) found three plan values below AA. Fixes: (a) iOS `glassAccent` light alpha 0.72 → 0.80 (white label 4.12 → 4.91:1 over `bg`); (b) dark `glassAccent` label #FFFFFF instead of onPrimary-style #3A0A14 (2.9:1 → 5.85:1); (c) accent text is only used on `bg` and `surface`; dark accent on `surface2` is 4.21:1, so chips on `surface2` use `textPrimary`. Rejected: changing the accent colour itself (brand-adjacent, plan-fixed).
- D-009 (2026-10-09) Brand build (P0-4): `opentype.js` `toPathData` emits `NaN` for multi-glyph paths and `letterSpacing` option is unreliable, so the build serialises paths itself and omits the -1% letter-spacing (render difference is under 1% of width). Rejected: another font-to-path library (more dependencies for a sub-1% effect).
- D-010 (2026-10-09) The "S with drop" glyph is the Dancing Script 700 S outline plus a generated teardrop (13% of glyph height) at its lower-left stroke terminal, so it reads as a ball terminal. It is a build-script placeholder for a hand-drawn master; replace in P3-8 (final native assets). Rejected: hand-authoring SVG paths without a way to review them visually.
- D-011 (2026-10-09) Expo Go shows its own launch screen, not the `expo-splash-screen` config, so the wine splash cannot be seen in Expo Go. P0-4 verifies the config by test and by rendering the assets (docs/screenshots/P0-4-preview.png); the native splash is confirmed on the dev client at P3-8. Rejected: a fake in-app splash screen that would diverge from the real one.
