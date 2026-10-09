# Action plan for the 2026-10-10 reviews

Every finding in `implementation-review.md` (I-n) and `ui-ux-review.md` (U-n) has one disposition here. Re-checked against HEAD 8ed1221 before planning; the peer session that committed D-073 had already fixed several. Decision id for this work: **D-075**.

**Status (2026-10-10, checked against HEAD eb99705): complete.** Batch 1 is D-075 (776b492). Batches 2 and 3 are D-076 (331063e, 09a2f41, ff5985f), including the P3 items U-16, U-20, U-24 and U-25. U-33 is done: the engine hash is selectable in About. I-7 is done: the stray root `app.json` is gone.

## Already fixed before this plan (verified at the cited line)

| Id | Finding | Where it was fixed |
| --- | --- | --- |
| I-1, I-2 | Duplicate iCloud entitlements, double `NSPrivacyAccessedAPIType` key | `apps/mobile/app.json` is clean (peer, staged) |
| I-3 | Build scripts without `EAS_NO_VCS=1` | `apps/mobile/package.json:77-83` restored |
| I-4 | Stale translation CSV | regenerated; `i18n.test.ts` green |
| I-5 | Android date dialog dismissed with no date | `DateField.tsx:38` guards `if (d)` |
| I-6, U-26 | Onboarding said the app locks by default | `lock.explain` reworded to point at Settings |
| I-8, I-9 | Maestro selector form; age-gate wheel taps | `settings.yaml:105` uses `text:`; `onboarding-agegate.yaml` loops on the visible year and documents the iOS-only path |

## Rejected after a closer look (no change)

| Id | Why |
| --- | --- |
| I-10 | `predict.ts:124-127` always passes `upper95` from the gated, age-banded fit; the ungated fallback in `flags.ts:125` only runs when a test calls `evaluateFlags` directly. |
| I-15 | `EventStore.batch` rebuilds after `fn()`; every reader of the projections is the `refresh()` that follows the batch. Documented in a comment instead of a code change. |
| I-17 | All `measured_at` values are written as local wall-clock strings (`actions.ts:113`, `importDaily.ts:50`); the health mapping carries `start`/`end`, never `measured_at`. Nothing writes an offset. |
| U-6 | 09:41 with a full battery is Apple's marketing status bar, set through `simctl status_bar`; it is wanted in store shots. |
| U-12 | The amber edge is the `flag` role in `ui-tokens`, covered by the contrast test. |
| U-17 | Day detail already shows "Not a period" and "Mark as spotting" only on a period day (`day/[date].tsx:61`). |
| U-21 | The calendar header already follows the device first weekday (`calendar.tsx:45`, P6-1). |
| U-28 | On iOS the compact picker *is* the system date button; wrapping a native control in a fake chip would fight the platform (PLAN §9.1). |
| U-31 | "No consent is recorded" only appears in the dev-seeded screenshot; onboarding always records consent (`data/consent.ts`). |
| U-32 | Tagline wording is the owner's decision (PROGRESS, trademark check). |
| §4 haptics claim | Wrong: the quick-log row uses `expo-haptics` (`QuickLogRow.tsx:45`). Corrected in the review. |

## Split between sessions

Two sessions shared the checkout. `sanguine-1f` took the implementation items (D-075); `sanguine-83` took the UI review (D-076), plus I-16 because its fix is one line in `settings/privacy.tsx`, which sits in that session's scope.

## Done under D-075

- **I-13** `updatePrefs` serialised (`state/serial.ts`, unit test).
- **I-14** day detail asks before deleting an entry (`logging.yaml` covers Cancel and Delete).
- **I-15** invariant documented on `EventStore.batch`.
- **I-18** cycle detail hides the ovulation card under 18 (`teenAudit.test.ts`, `teen.yaml`).
- **I-19** open-failed screen localised with "Try again".
- **I-20** onboarding hint when Finish waits for consent (`onboarding.yaml`).
- **I-11, I-12** C-table names the constants; 46+ fallback recorded.

## Original order (UI part handed to D-076)


Batch 1, logic and docs (unit tests first):
1. **I-13** `updatePrefs` race: serialise writes in `state/app.ts`; test with two overlapping calls.
2. **I-16** Natural Cycles notes dropped without a key are counted but never shown: add the count to the import message in `settings/privacy.tsx` with a new copy key. *(privacy.tsx is not the peer's file; backup.tsx and health.tsx are.)*
3. **I-18** Cycle detail shows ovulation basis and luteal length to teens: gate on `fertilityTools`; extend `teenAudit.test.ts`.
4. **I-19** Generic DB-open error screen is hard-coded English with no action: localise, add "Try again".
5. **I-11, I-12** Name the clinical constants in the DECISIONS C-table; record the 46+ age-band fallback (population mean, same rule as under 18). Docs only, engine untouched.
6. **I-15** comment on `batch`. **I-7** stray root `app.json`: ask the peer, then delete.

Batch 2, shared UI primitives:
7. **U-1** double top inset on iOS (`Screen.tsx`: `contentInsetAdjustmentBehavior="automatic"` plus `insets.top`).
8. **U-2, U-3, U-27** text buttons in the accent colour; disabled buttons dimmed; Back with a chevron.
9. **U-5** app theme override reaches native views (`Appearance.setColorScheme`), so the tab bar and system pickers follow it.

Batch 3, screens:
10. **Today** U-4 (legend line only on Calendar), U-7 (estimate title without the range), U-8 (date range under the headline), U-9 (stacked quick-log buttons get a container), U-10 (fertile opacity floor), U-11 (tonal confidence chip).
11. **Logging and day detail** I-14/U-13 (confirm before delete), U-14 (sheet chevrons), U-15 (dots scale, long-press hint), U-16 (one card, one row per entry).
12. **Calendar** U-18 (ovulation legend hidden when uncertain), U-19 (thicker rounded underline, same opacity floor), U-20 (card opens details, one Log action).
13. **Insights** U-22 (thresholds for sparse charts), U-23 (open-cycle wording, chips), U-24 (rows tap to detail), U-25 (per-cycle accuracy list).
14. **Onboarding** I-20/U-27 (hint when Finish is disabled), U-29 ("I don't know" as a secondary button).
15. **Settings** U-30 (row subtitles), U-33 (selectable engine hash).

Verification: affected unit tests and type-check after each batch; iOS Maestro flows for the changed screens on the second simulator (`IOS_UDID=ACAC445C-…`, Metro 8091); screenshots to `docs/screenshots/D-075/`; full unit suite, lint and deny-list once before the commit.
