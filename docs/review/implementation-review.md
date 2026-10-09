# Implementation review against PLAN.md (2026-10-10)

Scope: the working tree at commit 8a76069 plus the uncommitted changes (D-073 date picker, app-lock default, P5-5 store assets). Method: unit suite, type-check and lint run locally; delegated file analysis (Gemini) of the engine, data layer and screens, each finding then checked by hand at the cited line; 47 iOS screenshots from `docs/screenshots/suite-p4-devclient` reviewed against §8 and §9. Findings that did not survive the hand check are listed at the end so nobody re-chases them.

## 1. Where the project stands

| Area | Plan | State |
| --- | --- | --- |
| Phase 0 foundations | §10 | Done (10/10 items) |
| Phase 1 engine | §4 | Done (9/9); 869 unit tests, fixtures A–I green, property tests, backtest CLI |
| Phase 2 core app (Expo Go) | §8, §9 | Done (15/15); full Maestro suite was green on both platforms at v0.2-expo-go |
| Phase 3 native build | §10 | 14 of 16: P3-5b (Android Glance widget) blocked on expo-widgets; P3-14 (dedicated Android pass) partly done per D-070 |
| Phase 4 health sync | §7 | Core, iOS driver and settings done; P4-3 Android runtime check and P4-5 wearable temperature need hardware |
| Phase 5 launch | §10 | Release config, store text, graphics, website, policies done; P5-1 Flo/Clue importers blocked on sample exports; everything else is the owner's (accounts, signing, legal name, legal review, GitHub Pages) |
| Phase 6 international | §6.4 | Infrastructure done; translations need translators and a clinician |

Verdict: feature-complete for an Australian v1 as the plan defines it. What remains is either hardware-gated, owner-gated, or the clean-up below.

## 2. Gates as of this review

| Gate | Result |
| --- | --- |
| `pnpm test` | 867 passed, **2 failed** (see 3.1) |
| `pnpm typecheck` | green, all 7 projects |
| `pnpm lint` | green, 7 warnings (unused biome suppression in `tools/ci/store.test.ts:8`, and six others) |
| Maestro | not re-run here; last full iOS pass recorded at D-051/D-055, `settings.yaml` re-run green at 01:38 today |

The tree is not committable as it stands: the owner's rule is never to leave the suite red.

## 3. Defects

Severity: **A** blocks a build or a release, **B** wrong behaviour a user can hit, **C** deviation from the plan or hygiene.

### 3.1 Uncommitted work (fix before the next commit)

| # | Sev | Where | What | Fix |
| --- | --- | --- | --- | --- |
| 1 | A | `apps/mobile/app.json:228-243` | The iCloud entitlement arrays each list their value twice (`iCloud.app.sanguine.mobile` ×2, `CloudDocuments` ×2). HEAD had 3 occurrences, the tree has 5, so this came in with today's edits. Duplicate entitlement values fail provisioning-profile validation. | Dedupe the three arrays. Add an assertion to `tools/ci/store.test.ts` that entitlement arrays have unique values. |
| 2 | A | `apps/mobile/app.json:180-208` | The first `NSPrivacyAccessedAPITypes` entry has two `NSPrivacyAccessedAPIType` keys (FileTimestamp, then DiskSpace) in one object. JSON keeps the last, so the FileTimestamp declaration with reason E174.1 is silently dropped and the object carries a DiskSpace reason. | Split into two objects (FileTimestamp C617.1 / E174.1 as needed, DiskSpace E174.1). Add a uniqueness check for the key in the store test. |
| 3 | A | `tools/ci/easignore.test.ts:22` | Fails: the `build:*` scripts in `apps/mobile/package.json:77-83` no longer start with `EAS_NO_VCS=1`, but `.easignore` and the test still assume no-VCS mode. Either the 170 MB upload problem (D-069) returns or the test is stale. | Decide one way: put `EAS_NO_VCS=1` back in the scripts, or move it into `eas.json` `build.base.env` and update the test and the `.easignore` header comment to match. |
| 4 | A | `tools/ci/i18n.test.ts:27` | Fails: `docs/i18n/strings-for-translation.csv` is behind `copy/en-AU.json` (the new `date.*` strings). | Run `pnpm i18n:extract` and commit the CSV. |
| 5 | B | `apps/mobile/src/ui/DateField.tsx:38` | `onValueChange={(_e, d) => pick(d)}`: on Android a dismissed dialog fires with `d === undefined`, and `dateToIso` then throws on `getFullYear`. iOS is unaffected. | `if (d) pick(d)`. Add a unit test for the dismissed case. |
| 6 | B | `copy/en-AU.json` onboarding step 5 | The privacy step still says Sanguine locks after a minute and unlocks with Face ID (screenshot `ios-step5-privacy.png`), but `prefs.ts:47` now defaults `appLock` to false (D-073). The sentence is now untrue on first launch. | Reword to "You can turn on an app lock in Settings, Privacy and data" or drop the sentence; update `onboarding.yaml` if it asserts the text. |
| 7 | C | `/app.json` (repository root) | Untracked stray file with an EAS `projectId`, created by an `eas init` run from the wrong directory. | Delete it. |
| 8 | C | `apps/mobile/.maestro/settings.yaml:106` | `scrollUntilVisible: element: ".*admin@dothings.lol.*"` uses the string shorthand where the other steps use `{ id: ... }`. It passed on the simulator at 01:38, so keep it, but make the form consistent. | Use `element: { text: ".*admin@dothings.lol.*" }`. |
| 9 | C | `apps/mobile/.maestro/onboarding-agegate.yaml` | The new wheel-scroll step taps fixed coordinates to move two years. Fragile across simulator sizes and font scales, and iOS-only; the Android pass (P3-14) will need its own branch. | Prefer `setDate`/typed input if `@expo/ui` exposes a testID path; otherwise document the iOS-only assumption in the flow header. |

### 3.2 Engine (`packages/engine`)

| # | Sev | Where | What | Fix |
| --- | --- | --- | --- | --- |
| 10 | B | `flags.ts:125-128` `defaultUpper95` | The missed-period threshold is fitted from all valid cycles with `cyclePrior()` called with no arguments: no age band, no perimenopause variance scale, no life-state cycle weights (`gate.cycleWeight`). A 42-year-old or a post-contraception user gets a threshold from the population prior while her prediction uses the age-banded, gated one. §4.10 says flags are age-aware. | Pass `settings.birthYear`, `today` and the gate into `defaultUpper95`, reuse the weighted fit from `predict.ts`. Fixture: post-contraception user with 3 old regular cycles must not raise `missed_period` from the ungated fit. Record in `engine-changelog.md`. |
| 11 | C | `predict.ts:20-22`, `combine.ts:9`, `lifestate.ts:14-19`, `flags.ts:10-18`, `bbt.ts:8-12` | About twenty clinical constants live as module-level constants in five files. They are isolated (one constant each, as §11.1 asks) but the DECISIONS C-table points at files, not names, so a reviewer has to hunt. | Move them into `params.ts` with the C-xx id in a comment, or add the constant names to the C-table in DECISIONS.md. No behaviour change. |
| 12 | C | `cycleLength.ts:15`, `params.ts:14-17` | `AGE_BAND_MEANS` ends at 45; age 46+ falls back to `POPULATION_MEAN` 29.3, a step up from the 45-band 27.4. Bull 2019 has no band above 45, so this is a judgement call, but it is undocumented. | Either extend the last band to `Infinity` (conservative: shorter mean widens nothing) or record the fallback in DECISIONS.md as a C-item. |

### 3.3 Data layer and state (`apps/mobile/src`)

| # | Sev | Where | What | Fix |
| --- | --- | --- | --- | --- |
| 13 | B | `state/app.ts:205-211` `updatePrefs` | Reads `prefs` with `get()`, awaits `savePrefs`, then `set({ prefs: next })`. Two quick toggles in a row (two switches on the Privacy screen, or the Tracking symptom list) race: the second call's merge is based on the first call's stale `prefs`, so the first change is lost both in state and on disk. | Serialise through a small promise queue, or compute `next` inside `set((s) => ...)` and persist what was set. Unit test with two overlapping calls. |
| 14 | B | `app/day/[date].tsx:55` | Per-event "Delete" retracts immediately with no confirmation and no undo. The event log keeps the row (retract semantics), but the UI offers no way back. | Confirm, or better: snackbar with Undo that calls a retract-of-the-retract (append the same payload again). |
| 15 | C | `data/store.ts:55-66` `batch` | Projections rebuild after `fn()` returns, outside any transaction, so a reader between the event commit and the rebuild sees stale `cycle`/`daily_log` rows. Harmless today because the only readers are the zustand `refresh()` that batch triggers, but a Health sync or widget read could land in the window. | Document the invariant, or rebuild inside the same `db.transaction`. |
| 16 | C | `data/importDaily.ts:59` | Notes imported without a notes key are counted in `notesDropped` and the import succeeds. Correct per the docstring, but check that every caller (Natural Cycles, Sanguine import) shows the count to the user; otherwise notes vanish silently. | Grep callers; surface `notesDropped` in the import result sheet. |
| 17 | C | `data/project.ts:48` | `HHMM = /T(\d{2}:\d{2})/` takes the wall-clock part of `measured_at` as the local time. Fine for manual and daily-import rows (written as `${day}T${hh:mm}:00`), wrong if a HealthKit row ever carries a `Z` or offset. | Assert the format in `healthSink.ts`, or normalise to local there. |

### 3.4 Screens

| # | Sev | Where | What | Fix |
| --- | --- | --- | --- | --- |
| 18 | B | `app/cycle/[id].tsx:46-51` | Cycle detail prints the ovulation date, basis and luteal length for every user. The History list gates these behind `fertilityTools` (`insights.tsx:63`) and `teenAudit.test.ts` covers Today, Calendar, logging and Insights, but not this route. A teen tapping "Cycle details" sees the fertility language §8.6 hides. | Gate the ovulation card on `fertilityTools`; add the route to `teenAudit.test.ts` and `teen.yaml`. |
| 19 | C | `features/today/todayModel.ts`, `insights.tsx` | Loading and error states are not modelled anywhere: every tab renders from the zustand snapshot and relies on the root layout to hold the splash until the DB opens. §9.7 asks for every error and empty state. The DB-open failure path (bad SQLCipher key, corrupt file) has no screen. | One `DbErrorScreen` in `_layout.tsx` with "export what can be read / delete and start again", wired to the `open()` rejection. |
| 20 | C | `features/onboarding/OnboardingFlow.tsx:64` | In an EU/UK region the Finish button is disabled until both checkboxes are ticked, with no text saying why. | Add a one-line hint under the button when `explicit && !explicitOk`. |

## 4. What the plan asks for that is not there

- **Flo and Clue import** (§8.10, P5-1): blocked on sample exports (D-062). Nothing to do until the owner supplies files.
- **Android Glance widget** (P3-5b): blocked on expo-widgets (D-047).
- **Lock-screen widget Period deep link** (§8.4): the medium widget has the button; the flow is unverified on a device (simulators cannot run widgets to the lock screen).
- **Haptics** (§8.9 "optional and never the only feedback"): no haptics anywhere. Acceptable, but the setting the plan implies does not exist either.
- **Translations** (P6-2): pipeline only.
- **Clinician and legal review**: none exists; every default is in DECISIONS.md as the plan requires.

## 5. Plan from here

Ordered; each step ends with its tests green. Estimated effort is for one agent session.

1. **Make the tree green and commit the D-073 / P5-5 work** (half a session). Items 1–9 above. Run `store.test.ts`, `easignore.test.ts`, `i18n.test.ts`, then `onboarding.yaml` and `settings.yaml` on the iOS simulator. Commit as "D-073 date picker, app-lock default off; P5-5 store data (fixes app.json duplicates)".
2. **Teen gate on cycle detail** (quarter session). Item 18. Extend `teenAudit.test.ts` and `teen.yaml`.
3. **Delete with Undo on day detail** (half a session). Item 14. Reuse the existing `Button kind="text"` and the toast pattern if one exists; otherwise a 5-second inline "Deleted · Undo" row in the card's place.
4. **Prefs write serialisation** (quarter session). Item 13 with a two-call unit test.
5. **Engine flag threshold uses the gated fit** (half a session). Item 10, plus `engine-changelog.md`, `risk-register.md` and a fixture. This is an engine rule change: bump the engine version, do not ship over the air (D-069).
6. **Constants into `params.ts` and the C-table** (quarter session). Items 11–12, no behaviour change, engine hash changes so note it in the changelog.
7. **DB-open error screen** (half a session). Item 19.
8. **UI/UX pass** from `docs/review/ui-ux-review.md`, in its priority order (two sessions).
9. **Owner-gated**: GitHub Pages switch, legal name, export-compliance answers, store accounts, Apple Developer team for the iCloud container, Google OAuth client id, trademark check on the taglines, Flo/Clue sample exports, translators, device checks (Apple Watch temperature, Android credential lock, screen protection on a real phone).
10. **Android pass (P3-14)** when the owner schedules it: rebuild the dev client, `suite.sh android`, `fontscale.sh android`, `cloud-backup.yaml`, Health Connect Toolbox, hourly task.

## 6. Findings checked and rejected

Listed so they are not raised again.

- *Provenance factor multiplies SD not variance* (`lh.ts:19`): §4.7 says "multiplier on the signal's SD". Matches the plan.
- *Three-day "ovulatory" phase* (`predict.ts:121`): `OVULATORY_HALF_WINDOW_DAYS = 1` is deliberate; the phase label is not a prediction and no single fertile day is rendered.
- *BBT gap check over the whole 9-reading window* (`bbt.ts:77`): a single excluded day is a 2-day gap and passes; only 3+ calendar days between neighbours breaks the run, as §4.6 says.
- *`wipe.ts` drops the `event` table*: this is "Delete everything", the one sanctioned deletion (§8.2, secure_delete + VACUUM).
- *Ledger re-scores with the current engine* (`ledger.ts:19-22`): `forecastFor` predicts as of the cycle start with history truncated to that day, so it is hindsight-free; the engine version is recorded per row.
- *`shouldLock` returns false when `backgroundedAt` is undefined* (`lockModel.ts:17`): that branch is only reached after an unlock this session with no background since; failing closed there would lock the app while it is in use.
- *Descriptive notification ignores discreet mode* (`notifications.ts:50`): `descriptive` is the §8.8 opt-in toggle; the title still follows the discreet name.
- *"contraception" in life-state labels* (`en-AU.json:77,78,401,402`): exempted under D-012 for exactly those keys; the test enforces the exemption scope.
- *`insightsModel.ts:38` NaN when `nu` is 0*: `model` comes from the engine posterior, `nu > 0` by construction.
- *`PhaseRing` hard-coded 48pt*: RN scales `fontSize` with the system setting, and the ring collapses to a text header above 150% (`PhaseRing.tsx:19-22`).
- *`tools/site/build.ts` missing*: the root `site` script filters `@sanguine/site`, which is the untracked `site/` package. Present.
