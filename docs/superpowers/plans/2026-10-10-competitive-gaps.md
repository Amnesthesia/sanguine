# Competitive gaps implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gaps listed in `docs/ROADMAP.md` §2.3 ("Where Sanguine is behind") that fit the project's constraints.

**Architecture:** Each gap is its own task with its own tests and its own decision id. Pure logic goes in `apps/mobile/src/data/` or `apps/mobile/src/features/<area>/*Model.ts` with vitest tests. Screens stay thin. Nothing touches `packages/engine` unless a task says so. Native work (App Intents, the Watch app, the Wear OS tile) starts with a timed spike whose outcome is recorded before any code.

**Tech Stack:** Expo SDK 57 dev client, expo-router, TypeScript, vitest, Maestro (iOS simulator only), the existing `fflate`, `expo-sharing`, `expo-file-system` and `expo-document-picker`. One new dependency: `expo-print` (Task 6).

**Spec:** `docs/ROADMAP.md` §2.3 and Part 3 (R2-1 … R5-1), and the owner decisions D-077.

## Global Constraints

- The only network calls are the encrypted backup to the user's own iCloud Drive / Google Drive app folder and the EAS Update check. Device sync (Task 8) uses the same channel only (D-077).
- No contraception feature, no conception mode, no per-day chance-of-pregnancy figure, no flag that names a condition (`CLAUDE.md`).
- Every prediction is a range with a confidence grade. Never a single highlighted fertile day.
- Symptoms never change a prediction.
- Teen mode (13–17) hides fertility language: every new surface goes through `fertilityTools` and is added to `features/teen/teenAudit.test.ts`.
- All copy lives in `copy/en-AU.json` and passes the forbidden-word test (`copy/copy.test.ts`). After adding keys, run `pnpm i18n:extract`.
- Event rows are append-only. Imports write through `data/importDaily.ts` with `provenance: 'imported'` and stable `external_id`s.
- Testing order (owner's rule): edits first; then affected vitest files plus `pnpm typecheck`; then the Maestro flow for the changed screen on the iOS simulator only; full suite, lint and deny-list once before the commit.
- Commits contain only this session's hunks (peer sessions share the checkout; see the side-by-side memory). Commit messages name the decision id.

## Out of scope here (with reason)

| Gap | Why not in this plan |
| --- | --- |
| Flo and Clue import | Blocked on sample exports from the owner (D-062, roadmap R1-6) |
| Apple Health cycle history import | Already done: Health sync imports menstrual flow (P4-2) |
| AI assistant, conception mode | Forbidden (roadmap "Not doing") |
| Backup reminder (R2-5) | Not a competitive gap; it stays in the roadmap |

## Review Focus

1. A drip CSV from an older drip schema (fewer columns) must import what it has and not reject the file. Test: `parseDrip` with only `date,bleeding.value,bleeding.exclude`.
2. A drip export lowercases and quotes every string containing `.`, `,` or `'` (its `csvify`). Notes with commas must survive. Test: a quoted note with a comma and a doubled quote.
3. An `.ics` sent twice must not create overlapping events in a calendar that honours UID. Test: same input, same UIDs; changed prediction, same UIDs, higher SEQUENCE.
4. Teen mode must never get the fertile-window option in the `.ics` export or the doctor report. Test in `teenAudit.test.ts`.
5. A pregnancy with no last-period date and no due date must not show a week count. Test: `pregnancyModel` returns `undefined`.

---

### Task 1: drip import (R2-4, D-078)

**Files:**
- Create: `apps/mobile/src/data/importDrip.ts`
- Create: `apps/mobile/src/data/importDrip.test.ts`
- Modify: `apps/mobile/src/data/importDaily.ts` (add `cervix` to `DailyRow` and write it)
- Modify: `apps/mobile/src/data/importDaily.test.ts` (cervix case)
- Modify: `apps/mobile/src/services/exportImport.ts` (detect drip before the period-CSV fallback)
- Modify: `apps/mobile/src/app/settings/privacy.tsx` (result message for `kind: 'drip'`)
- Modify: `copy/en-AU.json` (`settings.privacy.importDesc` names drip)
- Modify: `docs/DECISIONS.md` (D-078), `docs/BACKLOG.md`, `docs/PROGRESS.md`

**Format (verified against drip's source, `db/schemas/4.js`, `lib/import-export/*`, `components/helpers/labels.js`, main branch 2026-10-10):**
- Header: dotted object paths from the `CycleDay` schema, for example `date,temperature.value,temperature.exclude,temperature.time,temperature.note,bleeding.value,bleeding.exclude,mucus.feeling,mucus.texture,mucus.value,mucus.exclude,cervix.opening,cervix.firmness,cervix.position,cervix.exclude,note.value,desire.value,sex.solo,sex.partner,sex.condom,…,pain.cramps,…,mood.happy,…`.
- Booleans are `true`/`false`; empty means null. Strings are lowercased, and quoted when they contain `\n \t , ; . '`.
- Codes: bleeding 0–3 = spotting/light/medium/heavy; mucus feeling 0–3 = dry/nothing/wet/slippery; texture 0–2 = nothing/creamy/eggWhite; cervix opening 0–2 = closed/medium/open, firmness 0–1 = hard/soft, position 0–2 = low/medium/high; desire 0–2 = low/medium/high.

**Mapping (conservative choices recorded in D-078):**

| drip | Sanguine |
| --- | --- |
| `bleeding.value` 0–3 | `flow` spotting/light/medium/heavy |
| `bleeding.exclude=true` | `flowKind: 'intermenstrual'` (drip's "exclude" means it does not start a cycle) |
| `temperature.value` (°C), `.time`, `.exclude` | `tempC`, `tempTime`, `tempExcluded` |
| mucus feeling/texture | the higher of feeling {dry→dry, nothing→dry, wet→watery, slippery→eggwhite} and texture {nothing→none, creamy→creamy, eggWhite→eggwhite} |
| `mucus.exclude=true` | not imported, counted in problems |
| cervix opening/firmness/position | `cervix` {closed/partial/open, firm/soft, low/mid/high}; needs all three; `exclude` → not imported, counted |
| `desire.value` 0 / 2 | `low_libido` / `high_libido` symptom; 1 is not a symptom |
| `sex.partner=true` | `sex { protected: sex.condom === true }` (Sanguine's flag means "condom used"); solo only is not imported, counted |
| pain cramps, ovulationPain, headache, migraine, backache, nausea, tenderBreasts, other | cramps, mid_cycle_pain, headache, headache, back_pain, nausea, breast_tenderness, other_pain |
| mood happy, sad, stressed, balanced, anxious, energetic, fatigue, angry | happy, mood_low, stressed, calm, anxiety, energetic, fatigue, irritability; `fine` and `other` counted as not imported |
| `note.value` plus `temperature.note`, `pain.note`, `mood.note`, `sex.note` | one note, labelled lines ("Temperature: …") |
| contraceptive columns (`sex.pill`, `sex.iud`, …) | not imported, counted (no contraception feature) |

- [ ] **Step 1: Write the failing tests** in `importDrip.test.ts`: full mapping, older schema subset, quoted note with comma and doubled quote, excluded mucus/cervix reported, detection (`readDrip` returns null for a Natural Cycles CSV and for a period CSV).
- [ ] **Step 2: Run** `pnpm vitest run apps/mobile/src/data/importDrip.test.ts`. Expected: fails, module not found.
- [ ] **Step 3: Implement** `parseDrip(table: string[][]): { rows: DailyRow[]; problems: string[] }` and `readDrip(bytes: Uint8Array): ReturnType<typeof parseDrip> | null`, reusing `parseCsv` from `data/csv.ts`.
- [ ] **Step 4: Add the cervix field to `DailyRow`** (`cervix?: { position: 'low'|'mid'|'high'; firmness: 'firm'|'medium'|'soft'; opening: 'closed'|'partial'|'open' }`) and write it as a `biomarker` event of type `cervix` with `source: 'app'`, external id field `cervix`. Add the case to `importDaily.test.ts`.
- [ ] **Step 5: Wire** `pickAndImport`: after Natural Cycles, before the period CSV, try `readDrip`; return `{ kind: 'drip', result, problems, symptoms }`. In `privacy.tsx`, treat `drip` like `natural_cycles` (counts, notes dropped, first 5 problems, newly seen symptoms made visible).
- [ ] **Step 6: Run** the affected tests and `pnpm typecheck`. Expected: pass.
- [ ] **Step 7: Docs and commit:** D-078, BACKLOG item P8-1 ticked, PROGRESS line. `git commit -m "P8-1 drip import (D-078)"`.

### Task 2: calendar export for a partner (R2-3, D-079)

**Files:**
- Create: `apps/mobile/src/features/share/ics.ts`, `ics.test.ts`
- Create: `apps/mobile/src/services/shareCalendar.ts`
- Modify: `apps/mobile/src/app/settings/privacy.tsx` (row "Add to someone's calendar"), or a new `settings/share.tsx` if the row needs options
- Modify: `copy/en-AU.json`, `docs/privacy-policy.md`, `apps/site` privacy page, `features/teen/teenAudit.test.ts`
- Create: `apps/mobile/.maestro/share-calendar.yaml`

**Interfaces:**
- Produces: `buildIcs(p: { period: { from: ISODate; to: ISODate }; fertile?: { from: ISODate; to: ISODate }; title: string; fertileTitle?: string; installId: string; sequence: number; now: string }): string`
- Consumes: `Prediction.nextPeriod.interval80` and the fertile-window range from the engine (no single day).

Rules: all-day events (`DTSTART;VALUE=DATE`, `DTEND` exclusive = last day + 1); UID `sanguine-period-<installId>@local` and `sanguine-fertile-<installId>@local` so a resend replaces the event in calendars that honour UID; `SEQUENCE` increments per export (kept in prefs); CRLF line endings; lines folded at 75 octets; text escaped (`\\`, `;`, `,`, newline). Title defaults to "S", editable. Fertile option hidden when `!fertilityTools` and absent when the engine gives no fertile range. VERIFY first: how Apple Calendar and Google Calendar treat a re-imported UID (record in D-079); if they duplicate, the share text says to delete the earlier event.

- [ ] Tests first (`ics.test.ts`): exact output for one fixture, DTEND exclusivity, escaping, folding, same UID across exports, no fertile VEVENT when absent.
- [ ] Implement, wire, teen audit, Maestro flow to the share sheet, policy sentence, D-079, commit `P8-2`.

### Task 3: "How Sanguine estimates" reference (R2-6)

**Files:** `apps/mobile/src/app/settings/how.tsx`, About row, `copy/en-AU.json` (`how.*`), `copy/copy.test.ts` already covers forbidden words.

Three sections, static text: how the range is computed; what each confidence word means; what narrows the range (temperature, LH, mucus, cervix) and what does not (symptoms, by design). Teen mode drops the fertility sentences (`fertilityTools`). Maestro: open from About, scroll to the end.

### Task 4: perimenopause view (R3-1)

**Files:** `features/insights/perimenopauseModel.ts` + test; `app/(tabs)/insights.tsx` section; `features/settings/lifeState.ts` (default-visible symptoms per life state); `copy/en-AU.json`; DECISIONS.

- `perimenopauseSummary(cycles, logs, today)` → `{ daysSinceLastPeriod: number; longCycles60: number; consecutiveDiff7: boolean; spread: { min: number; max: number } | undefined; vasomotorByWeek: Array<{ weekStart: ISODate; hotFlushes: number; nightSweats: number; insomnia: number }> }`, rolling 10 closed cycles.
- Shown only while the life state is `perimenopause`. Text quotes the published criteria as facts ("a difference of 7 days or more between consecutive cycles", "60 days or more without a period"); no stage label (`SHOW_TRANSITION_STAGE = false`), no 12-month milestone.
- In this life state `hot_flushes`, `night_sweats` and `insomnia` become default-visible in the logging sheet (the codes already exist).

### Task 5: pregnancy view (R3-2)

**Files:** `features/today/pregnancyModel.ts` + test; Today headline branch; `settings/lifestate.tsx` (optional due date); copy; DECISIONS.

- `pregnancyModel(state, lastPeriodStart?, dueDate?, today)` → `{ week: number; day: number; dueRange: { from: ISODate; to: ISODate } } | undefined`. Gestational age from the due date when given (due − 280 d), else from the last period start. Due range = point ± 14 d (shown as a range, §4.1). `undefined` without either date.

### Task 6: report for a doctor (R2-1)

**Files:** `features/report/reportModel.ts` + test (pure: sections from cycles, logs, flags, life state); `features/report/reportHtml.ts` + snapshot test; `services/report.ts` (`expo-print` `printToFileAsync`, share, delete); `settings/report.tsx` (cycle range and section picker); `apps/mobile/package.json` (+`expo-print`, then `pnpm soup`); copy; teen audit; Maestro `report.yaml`.

- Needs a dev-client rebuild for `expo-print`: schedule with the simulator owner; do not boot a second build while a peer is building.
- Report text names no condition; active flags use their fixed §4.10 wording; the fertile-window section is opt-in and absent in teen mode; the §2.3 intended-purpose sentence and the engine hash are in the footer.

### Task 7: Siri, Shortcuts, Control Center, Android shortcuts (R2-2) — spike first

- Spike (0.5 session): can an Expo config plugin add an App Intents extension, or can the existing expo-widgets target host the intents? Can Android static shortcuts deep-link to `sanguine://log?flow=1`? Record the outcome as a VERIFY row in DECISIONS.
- Then: deep-link route `log?flow=…` (shared by every platform surface), app-lock check before writing, intents/shortcuts. Maestro: `openLink` to the deep link.

### Task 8: sync between the user's own devices (R5-1) — core first

- `data/syncMerge.ts` + property test: given two event logs with disjoint device ids, `merge(a, b)` is commutative, associative and idempotent, and the projection rebuilt from the union equals the projection of the events in any interleaving order (fast-check, 1000 runs).
- Segment format: one encrypted file per device (`backup.v1` envelope from `packages/crypto`), containing events after the last exported seq.
- Transport and UI after the core passes; update `CLAUDE.md` network rule, policies, DPIA, store answers and website in the same commit (D-077).

### Task 9: Apple Watch app (R4-1) — spike first

- Spike (1 session): a watchOS target through a config plugin next to the widget target; WatchConnectivity message from watch to phone; phone writes the event. Record the outcome. If not workable, stop and record why.

### Task 10: Android Glance widget and Wear OS tile (R4-2)

- Re-check expo-widgets' Android renderer at SDK 58 (P3-5b). Wear OS tile after Glance.

## Order

1 → 2 → 3 → 4 → 5 → 6 → 8 (core) → 7 (spike) → 9 (spike) → 10. Tasks 1–5 need no new dependency or native build; 6 needs one rebuild; 7, 9 and 10 begin with spikes.
