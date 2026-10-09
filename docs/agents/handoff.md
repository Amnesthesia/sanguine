# Handoff (state at 2026-10-09 13:45; refresh when you pick this up)

Read `docs/agents/README.md` first. This file is only "what was in flight and what comes next". It goes stale fast: check
`git log --oneline -15`, `git status`, and `docs/BACKLOG.md` before trusting it.

## In flight when this was written

- A full **iOS Maestro suite** was running on the reverted tree (brand v2 cut back by D-051, plus the date-of-birth change D-055):
  `CLIENT=dev ITEM=D-051-revert apps/mobile/.maestro/suite.sh ios`, output in `/private/tmp/claude-501/suite-ios-dev.txt`
  (may be gone). Screenshots go to `docs/screenshots/D-051-revert-devclient/` (not yet committed).
  A screen recording of it was also running (`xcrun simctl io … recordVideo`, `/private/tmp/claude-501/suite-ios.mp4`); stop
  it with `pkill -f recordVideo` if still running.
- If the suite is not green or was cut off: rerun it (or only the failing flows) on the iPhone 17 Pro Max, then commit the
  screenshots by explicit path. Everything else from this session is committed (last commits: 83b3540 P3-14 backlog,
  c66fdee P3-13 importer). Unit tests: 632 pass, typecheck and lint clean.

## Ground rules that changed today (owner decisions)

- **iOS simulator only** for device testing (iPhone 17 Pro Max `1C4C0CE9-4A7A-441F-8FCA-5EDBD373D757`). Never boot the Android
  emulator: memory is exhausted. A full Android check and fix-up is backlog **P3-14**, to be run later as one pass.
- One simulator, one Maestro run at a time across all sessions; Metro on **8090** only; no app-source edits while a suite runs
  (a save reloads the app under it). Other sessions share this checkout: stage by explicit path, ask before editing files
  someone else has modified, announce new decision ids (next free is **D-057**; check `grep -n "^- D-0" docs/DECISIONS.md`).
- Brand: logo, splash, taglines, icons and the About band are the client's v2 assets; the in-app palette and fonts are the
  pre-v2 white/black design (D-051). The emblem/logotype PNGs were cut from reference renders because the originals were
  not delivered (D-049): needs the client's files.
- Copy addresses women (D-050). Onboarding asks for a date of birth (D-055).

## Next steps, in order

1. Close out the iOS verification above; commit `docs/screenshots/D-051-revert-devclient/`; tell the other sessions the
   simulator is free.
2. **P3-7** cloud backup upload (iCloud Drive container entitlement; Google Drive appDataFolder via expo-auth-session);
   restore E2E; move Argon2 back to 64 MiB × 3 with native libsodium (D-034). Needs a native build and entitlements: plan it
   and record any step that needs the owner (Apple/Google accounts).
3. **P3-8** final native icon and splash assets (Icon Composer layers, adaptive icon) and a check on the iOS home screen.
4. **P3-13** Natural Cycles importer (another session was working on it; check git log before starting).
5. **Phase 4 health sync**: P4-1 `packages/health-adapter` core with a fake driver (pure, test-first), then P4-2 iOS
   HealthKit driver, P4-3 Android Health Connect driver, P4-4 settings and permission UX, P4-5 wearable temperature.
6. **P3-14** full Android pass; **P3-5b** Android widget when expo-widgets' Android renderer exists.
7. Phase 5+ needs the owner (store accounts, signing, legal review).

## Needs a human (also in `docs/PROGRESS.md`)

Client's original emblem.png / logotype.png / client-logo.jpeg; real-phone check that screen protection blanks screenshots;
the VoiceOver/TalkBack script in `docs/accessibility.md`; legal review of the three policy drafts; trademark check on the
six taglines; Natural Cycles sample export for the importer (if still missing).
