# Handoff (state at 2026-10-10 11:50; refresh when you pick this up)

Read `docs/agents/README.md` first. This file is only "what is done, what is open, what bites". It goes stale fast: check
`git log --oneline -15`, `git status` and `docs/BACKLOG.md` before trusting it.

## Where things stand

Phases 0-6 are built, tested and committed, except the items in the table below. Since 2026-10-09: the store data and the
Astro website (P5-5, D-072, D-074), the review fixes and UI pass (D-075, D-076), and Phase 8 P8-1 to P8-8, P8-11 and P8-12 (drip
import, `.ics` export, "How Sanguine estimates", perimenopause and pregnancy views, report for a doctor, sync between the user's own
phones, quick actions, the Today look-back note, the prediction test suite), plus D-088 to D-090 (clearer dots, moon phases,
reminder rules). Plans: `docs/superpowers/plans/2026-10-10-competitive-gaps.md` (Phase 8) and
`2026-10-10-prediction-improvements.md` (P8-13); the 2026-10-09 remaining-work plan is executed.

In flight at 11:50 (uncommitted, other sessions): Calendar month swipe (D-092) and P8-13 engine items 1a, 2 and 4 (calibrated
ranges, per-user recency, as-of long-cycle limit). Item 2 changes a §11.1 default and needs the owner's decision before it ships.

## Open and actionable (no owner, emulator or hardware needed)

| Item | Note |
| --- | --- |
| P8-13 items 5 and 6 | item 6 is a type fix; item 5 (short-cycle question on Today) after item 4 lands |
| P8-14 feedback row (R1-5) | `mailto:` with versions only, GitHub issue template |
| P8-15 backup reminder (R2-5) | one Today card after the second cycle |
| P8-16 threat model (R5-2) | `docs/security/threat-model.md` plus crypto test vectors |
| P8-17 accuracy page (R5-3) | backtest tables on the website, labelled synthetic |
| Release candidate (ROADMAP R1-3) | full `suite.sh ios`, `fontscale.sh ios`, deny-list; the tag and TestFlight upload wait for the owner |

## Blocked

| Item | Why | What it needs |
| --- | --- | --- |
| P3-14 full Android pass (and P4-3 runtime) | owner rule: no Android emulator until one dedicated pass | rebuild the Android dev client; run `suite.sh android`; check the unverified Health Connect permission strings and `getChanges` behaviour (D-060 (7)); schedule the hourly Android background read; retake the Android store screenshots |
| P4-5 wrist temperature | the platform type is read-only, so no sample can be seeded | a real Apple Watch or Health Connect device |
| P5-1 Flo and Clue importers | no documented export format (D-062) | one real export from each app (ROADMAP R1-6) |
| P8-9 Apple Watch app | spike done (D-086) | owner decision on expo-apple-targets |
| P3-5b, P8-10 Android widget and Wear OS tile | expo-widgets has no Android renderer | re-check at Expo SDK 58 |
| P8-8 Siri, App Shortcuts, Control Center | expo-app-intents | Expo SDK 58 |
| P8-13 items 1b, 2, 3 | loosen or replace §11.1 defaults | owner decision, with the measured tables |
| Phase 7 | optional, funded, separate decision | owner |

## Needs the owner (also in `docs/PROGRESS.md`)

Store accounts, signing (the Play upload key mismatch: upload the AAB signed with the current key and remove the old certificate),
`EXPO_TOKEN` secret, export-compliance answers, age-rating questionnaires, GitHub Pages with source "GitHub Actions", the legal operator
name and App Store copyright, the policy placeholders (controller, response times: rerun `pnpm policy` after), a GDPR representative,
legal review, translators and a clinician check for de/fr/es/pt-BR (`docs/i18n/README.md`), an Apple team with the iCloud container
`iCloud.app.sanguine.mobile`, a Google OAuth client id (`extra.googleDriveClientId`), the client's original brand files and permission
to publish them, the trademark check on the taglines, making the repository public, the real-phone checks (screen protection,
VoiceOver and TalkBack, Apple Watch).

## Things that bit earlier sessions (so they do not bite again)

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
- The `agy-bridge` web lookup returned empty twice on 2026-10-09; WebSearch and WebFetch worked.
- Several sessions share this tree. Claim decision ids before writing them: two sessions both took D-092 on 2026-10-10. Run
  `git reset -q` first if the index looks stale, and commit only your own paths.
- Disk is tight: an iOS build failed with ENOSPC. Delete `apps/mobile/ios/build` after installing, and do not create git worktrees.
