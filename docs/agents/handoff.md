# Handoff (state at 2026-10-09 15:10; refresh when you pick this up)

Read `docs/agents/README.md` first. This file is only "what is done, what is open, what bites". It goes stale fast: check
`git log --oneline -15`, `git status` and `docs/BACKLOG.md` before trusting it.

## Where things stand

Everything in `docs/BACKLOG.md` that does not need a person, an Android emulator or hardware is built, tested and committed:
Phase 4 health sync (core, HealthKit and Health Connect drivers, settings), P3-7 cloud backup, P3-8 icons, Phase 5 release
readiness, open-source files, under-18 audit, Phase 6 locale rules, translation pipeline and GDPR consent. Decisions D-057 to D-064
record the choices; the implementation plan that was followed is `docs/superpowers/plans/2026-10-09-remaining-work.md`.

A full iOS Maestro suite (`CLIENT=dev ITEM=suite-p4 apps/mobile/.maestro/suite.sh ios`, output in
`/private/tmp/claude-501/suite-ios-p4.txt`) was started on the finished tree: look at its result before anything else.

## Still open

| Item | Why | What it needs |
| --- | --- | --- |
| P3-14 full Android pass (and P4-3 runtime, P3-5b) | owner rule: no Android emulator until one dedicated pass | rebuild the Android dev client; run `suite.sh android`; check the unverified Health Connect permission strings and `getChanges` behaviour (D-060 (7)); schedule the hourly Android background read |
| P4-5 wrist temperature | the platform type is read-only, so no sample can be seeded | a real Apple Watch or Health Connect device |
| P5-1 Flo and Clue importers | no documented export format (D-062) | one real export from each app |
| Phase 7 | optional, funded, separate decision | owner |

## Needs the owner (also in `docs/PROGRESS.md`)

Store accounts, signing, `EXPO_TOKEN` secret, export-compliance answers, age-rating questionnaires, privacy-policy URL and the policy
placeholders (controller, contact, response times: the in-app policy screens stay hidden until they are filled and `pnpm policy`
is rerun), a GDPR representative, legal review, translators and a clinician check for de/fr/es/pt-BR (`docs/i18n/README.md`), an Apple
team with the iCloud container `iCloud.app.sanguine.mobile`, a Google OAuth client id (`extra.googleDriveClientId`), the client's
original brand files and permission to publish them, the trademark check on the taglines, making the repository public, the real-phone
checks (screen protection, VoiceOver and TalkBack, Apple Watch).

## Things that bit this session (so they do not bite again)

- **Never `git stash` on this shared tree.** Other sessions have uncommitted work in it. Stage by explicit path; check
  `git diff --cached --name-only` before every commit.
- `pnpm install` prunes and re-adds packages (it prints "-123"): harmless, but run it only when a dependency changed. Use
  `--ignore-scripts`. `pnpm typecheck` (not `-s`) shows the real output; also run `npx tsc --noEmit -p .` in `apps/mobile`.
- Generated files that tests keep current: `pnpm soup` (SOUP list), `pnpm i18n:extract` (strings CSV), `pnpm i18n:index`,
  `pnpm policy` (in-app policies). A copy, dependency or policy change needs the matching command.
- HealthKit raises an uncatchable native exception (the app dies) for a menstrual flow sample without the cycle-start key or one that
  lasts a full day; it returns some booleans as 1 and 0. See D-060.
- Network calls are allowed only in `apps/mobile/src/services/cloud/` (`tools/ci/network.test.ts`).
- A native rebuild (new native module, plugin or entitlement) is `npx expo prebuild --platform ios --no-install` then
  `npx expo run:ios --device <udid> --no-bundler` (about 25 minutes cold); tell other sessions first, it replaces the installed app.
- On the simulator, deep links that replace the route leave the previous screen behind: Maestro flows navigate by deep link
  (`sanguine://settings/health`) instead of `back`.
- The `agy-bridge` web lookup returned empty twice this session; WebSearch and WebFetch worked.
