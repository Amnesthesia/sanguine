# Sanguine roadmap after v1 (2026-10-10)

This document answers two questions. First, is Sanguine feature-complete against `docs/PLAN.md`? Second, what would make it clearly better than the competition, and in what order should that work happen?

It builds on three documents and does not repeat them: `docs/review/implementation-review.md` and `docs/review/ui-ux-review.md` (both written on 2026-10-10), and `docs/review/action-plan.md` (D-075), which a separate session is working through now. Every proposal here is checked against the non-negotiables in `CLAUDE.md` and the conservative defaults in PLAN.md §11. Each new item that changes product scope needs a decision id before work starts.

---

## Part 1. Is v1 feature-complete?

**Yes, for the Australian v1 that PLAN.md §10 defines.** All Phase 0, 1 and 2 items are done. Phase 3 is 14 of 16, Phase 4 is 3 of 5, Phase 5 is 4 of 5 and Phase 6 is 3 of 3. Every item still open is blocked on hardware, an upstream library or the owner. None of them is blocked on engineering work that could be done today.

### 1.1 Gates on 2026-10-10 (HEAD 983f525 plus the peer's uncommitted D-075 work)

| Gate | Result |
| --- | --- |
| `pnpm test` | 872 passed, 82 files, 0 failed |
| `pnpm typecheck` | green on all projects |
| Maestro (iOS) | last full pass D-051/D-055; settings, onboarding, age gate, splash and logging re-run green on 2026-10-10 |
| Maestro (Android) | full suite green on the dev client earlier (D-041, D-070); the dedicated P3-14 pass is outstanding |

### 1.2 Plan coverage

| Plan area | State | What is left |
| --- | --- | --- |
| §4 Engine | Complete | Fixtures A–I, property tests, backtest and λ gate (λ = 1, D-021) are done. Two documentation items, I-11 and I-12, are open in D-075. |
| §5 Data model | Complete | Event log, projections, retract semantics, SQLCipher at rest (P3-2) |
| §6.3 Encrypted backup | Complete in code | iCloud container and Google OAuth client id belong to the owner (P3-7) |
| §7 Health sync | iOS complete | Android runtime check (P4-3, inside P3-14). Wrist temperature (P4-5) needs a real Apple Watch. |
| §8 UX | Complete | The UI polish items in D-075 (U-1 dead space, U-2/U-3 action styles, U-22 sparse charts and others) are in progress. |
| §8.3 Widgets | iOS complete | Android Glance widget (P3-5b) waits for expo-widgets (D-047). |
| §8.10 Portability | Partial | Sanguine, CSV and Natural Cycles import are done. Flo and Clue import (P5-1) need sample exports (D-062). |
| §9 Design system | Complete | Android dark-mode toolbar contrast is unverified (P3-14). |
| §2.3, §2.4–2.5 Regulatory and privacy | Drafted | Operator legal name, legal review and GDPR representative belong to the owner. |
| §6.4 Localisation | Infrastructure done | de, fr, es and pt-BR need translators plus a clinician check (P6-2). |
| Phase 7 regulated tier | Not started | It contains a conception mode, which `CLAUDE.md` forbids without a human decision. Out of scope until the owner says otherwise. |

### 1.3 Launch blockers (none of them are engineering)

1. D-075 review fixes committed with the suite green (in progress in the peer session).
2. P3-14 Android pass: `suite.sh android`, `fontscale.sh android`, `cloud-backup.yaml` on Android, Health Connect Toolbox import, hourly task, credential-prompt app lock.
3. Owner: store accounts and signing, `EXPO_TOKEN`, export-compliance answers, the Apple team with the iCloud container, the Google OAuth client id, GitHub Pages, operator legal name, legal review of the policies.
4. Owner: a trademark check on the splash taglines that echo Games Workshop phrasing (PROGRESS, D-042/D-045). Do this before any store listing.
5. Owner: VoiceOver and TalkBack script on a real device (`docs/accessibility.md`), and a real-phone check of screen protection.

**Recommendation:** do not start any Part 3 item until steps 1 and 2 are green and tagged `v1.0-rc1`. New features on an unverified Android build make the P3-14 pass harder to read.

---

## Part 2. Competitive position

### 2.1 Market in late 2026

| App | Model | Prediction | Privacy | Notable features | Known criticism |
| --- | --- | --- | --- | --- | --- |
| **Flo** | Freemium, account | Calendar plus symptoms, ML | Cloud. Anonymous Mode since 2022. Mozilla 2026: 7/10 | Partner mode (Oct 2023), pregnancy, perimenopause education, articles, AI assistant | 2021 FTC settlement over sharing with Facebook and Google. Class action with a $59.5M preliminary settlement, final hearing 29 Oct 2026. Repeated wrong forecasts for PCOS and perimenopause users. |
| **Clue** | Freemium (Clue Plus) | Calendar | Cloud account, GDPR, Berlin. Mozilla 2026: 8/10 | Perimenopause mode (Plus), Clue Connect partner sharing (Plus, one person, phases only), Conceive and Pregnancy modes, paid one-off doctor PDF built from the last 6 cycles (US/UK/AU/CA/NZ, English only) | Main features sit behind the paywall. Cloud dependency. |
| **Natural Cycles** | Subscription | BBT plus LH, FDA-cleared contraceptive | Cloud account | NC° Perimenopause mode with early/mid/late staging from cycle, symptoms, temperature and heart rate (Oct 2025). NC° Band, Oura and Apple Watch input. | Price. Not for PCOS. Contraception framing. |
| **Apple Health Cycle Tracking** | Free, built in | Calendar plus wrist temperature | On device, iCloud E2E | Retrospective ovulation estimates (Watch Series 8+), pregnancy with gestational age, deviation notices, Watch app | iOS only. Shallow insights. No explanation of ranges. No export beyond Health XML. |
| **Oura Cycle Insights** | Hardware plus subscription | Temperature | Cloud | Revised algorithm for irregular cycles and perimenopause; hormonal birth control mode | Needs the ring. Not a full tracker. |
| **Stardust** | Freemium | Calendar | Mozilla 2026: 2/10. Symptom data to analytics; ad-partner sharing since May 2026 | Social, moon-phase theming | Privacy record |
| **drip** | Free, open source, non-profit | Sympto-thermal, transparent rules | Local only, password | Bleeding, temperature, mucus, cervix, sex, mood, pain; graphs; import/export | Basic UI, small team, no health sync, no widgets |
| **Euki** | Free, non-profit | Calendar | Local only, PIN, wipe. Mozilla 2026: 10/10 | Reproductive-health resources | Few features, no backup |

Sources: [Mozilla Foundation privacy review 2026](https://www.mozillafoundation.org/en/nothing-personal/period-ovulation-trackers/), [Clue Connect](https://support.helloclue.com/hc/en-us/articles/14582034397597), [Clue doctor report](https://support.helloclue.com/hc/en-us/articles/37230173214237-What-is-the-report-for-my-doctor), [Clue Plus](https://support.helloclue.com/hc/en-us/articles/29048806152605-Premium-features-with-Clue-Plus), [NC° Perimenopause](https://help.naturalcycles.com/hc/en-us/articles/30400959172893), [Apple retrospective ovulation estimates](https://support.apple.com/120357), [Oura Cycle Insights update](https://ouraring.com/blog/oura-cycle-insights-update/), [Flo for Partners](https://flo.health/newsroom/flo-for-partners), [drip](https://f-droid.org/packages/com.drip/), [Euki privacy review](https://www.mozillafoundation.org/en/nothing-personal/euki-privacy-review/), [Bearable 2026 comparison](https://bearable.app/the-best-period-tracker-apps-of-2026/), [Go Go Gaia on Flo litigation](https://www.go-go-gaia.com/blog/flo-vs-clue-vs-glow.html). Feature lists change often. Re-check each app before quoting it in marketing.

### 2.2 Where Sanguine already wins

These are the claims to lead with on the website and in the store listing.

1. **Privacy with good features.** Euki and drip are private but basic. Clue and Flo have the features but keep the data in their cloud. Sanguine stores everything on the device with SQLCipher, has no account and no server, and offers an optional backup that is encrypted before it leaves the phone. Nothing is behind a paywall.
2. **Honest uncertainty.** Every estimate is a range with a confidence word. The calendar draws the 80% and 95% ranges. The accuracy ledger tells the user how often their own ranges were right. No competitor shows a user its own track record.
3. **Explained estimates.** Cycle detail shows which signals dated ovulation and whether they agreed. Apple and Flo are black boxes.
4. **Two-way Apple Health and Health Connect sync** with echo prevention. drip and Euki have no sync. Clue and Flo sync only partly.
5. **Life states in the engine.** Post-contraception warm-up, postpartum, breastfeeding, perimenopause and PCOS change the model itself, not only the labels. This answers the main complaint against Flo from PCOS and perimenopause users.
6. **Leaving another app is easy.** Natural Cycles import already carries temperatures, tests and notes. The export is documented and readable without Sanguine.
7. **Teen mode** with adolescent flag thresholds. No competitor handles 13–17 this carefully.
8. **Open source** (AGPL engine and app), with an engine hash shown in About.

### 2.3 Where Sanguine is behind

| Gap | Who has it | Fits our constraints? |
| --- | --- | --- |
| Report for a doctor | Clue (paid), Flo | Yes. Generate it on the device and send it through the share sheet. |
| Sharing with a partner | Clue Connect, Flo for Partners | Only without a server. See R2-3. |
| Apple Watch / Wear OS app | Apple, Clue, Flo | Yes, but expensive |
| Depth of perimenopause support | NC°, Clue, Oura | Yes, for tracking and description. Staging labels conflict with the "never name a condition" rule. |
| Pregnancy mode (gestational age, weeks) | Apple, Clue, Flo | The life state exists. A small descriptive view fits. |
| Siri, Shortcuts, Control Center, Android shortcuts | Apple | Yes. They are local and cheap. |
| Using more than one device | Clue, Flo (cloud) | Only through the user's own encrypted cloud folder. Needs a decision (PLAN §11.4). |
| Imports from Flo, Clue and others | — | Flo and Clue are blocked on samples. drip and Apple Health history are possible now. |
| Educational content | Flo, Clue | Partly. §8.1 forbids feeds and articles. A small fixed "how this works" reference fits. |
| AI assistant | Flo | No. It needs the network and makes clinical claims. |
| Conception mode, chance-of-pregnancy figures, contraception | NC, Clue Conceive, Flo | **No.** Forbidden by `CLAUDE.md`. |

---

## Part 3. Roadmap

Effort is in agent sessions (about one working day each), with tests and the iOS Maestro flow included. **Decision** means the item needs an entry in `docs/DECISIONS.md` before code. **Owner** means it needs the owner's approval because it touches a non-negotiable or the scope of the product.

### Release 1.0: ship what exists (now → store approval)

| Id | Item | Effort |
| --- | --- | --- |
| R1-1 | Finish D-075: logic fixes, shared UI primitives, screen polish. Re-shoot the store screenshots afterwards because U-1, U-2 and U-22 change every frame. | in progress |
| R1-2 | P3-14 Android pass (Part 1.3, step 2) | 1–2 |
| R1-3 | Release candidate: full `suite.sh ios`, `fontscale.sh ios`, deny-list, tag `v1.0-rc1`, TestFlight and Play internal track | 0.5 |
| R1-4 | Owner checklist (Part 1.3, steps 3–5) | owner |
| R1-5 | Feedback channel without analytics: a GitHub issue template, and a "Send feedback" row in About that opens a `mailto:` with the app and engine versions and **no** user data. Show a line above the button saying that an e-mail reveals the sender's address, and that a GitHub issue under any account name is the more anonymous route. This is the only way to learn what users want, because there is no telemetry and there will be none. | 0.25 |
| R1-6 | Flo and Clue samples (unblocks P5-1): the owner creates throwaway Flo and Clue accounts, logs about 3 synthetic cycles in each, and requests the GDPR data export. The importers then follow the Natural Cycles pattern (D-056). | owner + 2 |

### Release 1.1: low-cost gains that set Sanguine apart (about 8 sessions)

Each item is small, needs no network, and closes a gap that users notice.

**R2-1 Report for a doctor, free (2 sessions). Decision.**
- Why: Clue charges for this, limits it to five countries and English, and uses only 6 cycles. Sanguine can do it free, in every locale, from any date range.
- What: a PDF built on the device through `expo-print`. It contains the cycle-length table (start, length, bleed days, quality chip), the cycle-length chart with the 80% band, the BBT chart with coverlines when temperatures exist, symptom frequency by phase, the current life state, any active flag in its fixed §4.10 wording, the engine version and hash, and the §2.3 intended-purpose sentence. The user picks the cycles and the sections. The file goes out through the share sheet and the temporary file is deleted afterwards, as the export already does (D-036).
- Constraints: it names no condition, gives no risk score and contains no fertility estimate unless the user ticks that section. In teen mode it follows the teen rules. A copy test runs the forbidden-word check over the report template.
- Acceptance: a snapshot test of the rendered HTML for fixtures A, E and I; a teen-mode audit test; the Maestro flow `report.yaml` reaches the share sheet.

**R2-2 Siri, Shortcuts, Control Center and Android app shortcuts (3 sessions, after a half-session spike)**
- Why: logging a period start is the most common action. Apple's own app makes it one tap from the Watch or Control Center.
- What: App Intents for "Log period start" (flow level as a parameter), "Log temperature" and "When is my period likely?". The last one answers with the range, worded discreetly by default and descriptively only when the user has opted in (§8.8). Add an iOS 18+ Control Center control for "Log period". Add Android static app shortcuts for the same two log actions. Every intent writes through the existing event writer and respects the app lock: when the lock is on, the intent opens the app instead of writing in the background.
- Check before building: whether App Intents need a native target outside what Expo config plugins give us, and if so whether the expo-widgets target can host them. Record the outcome as a VERIFY item.

**R2-3 Sharing a cycle with a partner, without a server (1.5 sessions). Approved (D-077, O-1).**
- Why: Clue Connect and Flo for Partners are popular, and both need an account and a server.
- What: an "Add to someone's calendar" action that writes an `.ics` file with the next predicted period as an all-day range (80% interval), and optionally the fertile window as a range, never a single day. The fertile-window option does not exist in teen mode (`fertilityTools` gate; extend `teenAudit.test.ts`). The user sends the file through the share sheet. Event titles are discreet by default ("S"), and the user can change them.
- VERIFY before building: whether Apple Calendar and Google Calendar update an imported event in place when a later `.ics` carries the same `UID` with a higher `SEQUENCE`. Many clients add a duplicate instead, and in-place updates may need a subscribed calendar URL, which the network rule rules out. If imports duplicate, the share text tells the recipient to delete the earlier events. Record the outcome.
- Rejected: live sync to a partner. It needs a server or a shared cloud folder, and both conflict with the network rule.
- Owner (answered, D-077): a user-initiated `.ics` export is allowed. Add one sentence on it to `docs/privacy-policy.md` and the website privacy page in the same change.

**R2-4 drip import (0.5 session)**
- Why: drip is the closest competitor in values. Its users are exactly Sanguine's audience, and its export is a documented CSV.
- What: map drip's CSV onto the shared DailyRow writer (`data/importDaily.ts`): bleeding, temperature (including drip's "exclude" flag, which becomes a disturbance), mucus, cervix, sex, pain and mood mapped to symptom codes, and notes. Report what cannot be mapped, as the Natural Cycles importer does (D-056).
- Acceptance: a fixture file from drip's public repository round-trips with the counts shown to the user.

**R2-5 Backup reminder, once (0.5 session)**
- Why: data lives only on the phone. A user who never turns on the backup loses everything with the phone, and competitors with cloud accounts do not have this failure mode.
- What: after the second logged cycle, if the backup is off, Today shows one quiet card: "Your data is only on this phone. Turn on an encrypted backup?", with "Set up" and "Not now". "Not now" hides it for 6 months. It is never shown again after the backup is set up. One card, no badge and no notification, which keeps to the calm principle of §8.1.

**R2-6 A fixed "How Sanguine estimates" reference (0.5 session)**
- Why: trust. Users of competitors complain that predictions jump without reason.
- What: three short static pages under About: how the range is computed (cycle-length model, recency, priors), what each confidence word means, and which logs narrow the range (temperature, LH, mucus) and which do not (symptoms, by design). This is reference text, not an article feed (§8.1). It goes through the glossary and the forbidden-word test.

### Release 1.2: depth for life stages (about 5 sessions)

**R3-1 Perimenopause view (2.5 sessions). Decision.**
- Why: NC°, Clue and Oura all launched perimenopause features in 2025. It is the fastest-growing part of the market, and Flo's forecasts fail it most.
- What, inside the existing perimenopause life state:
  - Add symptom codes for hot flushes, night sweats, sleep disruption, joint aches, brain fog and heart palpitations to `copy/symptoms.json`. Make them visible by default only in this life state.
  - Add a variability panel in Insights: the spread of cycle lengths per rolling 10 cycles, the count of cycles of 60 days or more, and the days since the last period. Each is shown with the STRAW+10 *criteria as published facts* ("a difference of 7 days or more between consecutive cycles" and "60 days or more without a period"). They are descriptive only.
  - Add a symptom timeline for the vasomotor symptoms (counts per week). They never feed predictions.
  - Show "days since your last period" as a plain count. Add **no** "12 months without a period" milestone: that is the clinical definition of menopause, so a milestone would be a diagnosis by another name. Record this as a rejected alternative.
- Constraint, the conservative default: **no stage label** ("early", "late"). NC° shows one, but a stage is a clinical classification. Record the rejected alternative in DECISIONS and isolate the choice behind one constant, `SHOW_TRANSITION_STAGE = false`.
- Engine: none. The λ = 0.8 perimenopause recency and the variance scale already exist. Re-run the backtest if any parameter changes.

**R3-2 Pregnancy view (1.5 sessions). Decision.**
- Why: Apple shows gestational age. Users who log a pregnancy today see a quiet Today screen and nothing else.
- What: while the life state is pregnant, Today shows "Week N, day D" counted from the last period start, or from a due date the user enters, and an estimated due-date range. Logging switches to a pregnancy symptom subset. HealthKit pregnancy read and write is already mapped (P4-2 VERIFY outcome).
- Constraint: no week-by-week baby content and no articles (§8.1). The due date is shown as a range, because Naegele's rule is a point estimate with roughly ±2 weeks of real spread, and §4.1 asks for ranges.

**R3-4 Per-cycle accuracy list (0.5 session)**
- The U-25 item from the UI review: predicted range against the actual start, one row per closed cycle, from `prediction_score`. It is small, and it is the clearest proof of claim 2.2.2.

### Release 1.3: platform reach (about 12 sessions)

**R4-1 Apple Watch app (8 sessions after a 1-session spike). Decision.**
- Why: logging from the wrist is the main reason people stay with Apple Cycle Tracking.
- What: a watchOS app with three screens: today's headline (range plus confidence), a two-tap period log, and a one-tap symptom log for the user's top 4 symptoms. Watch complications reuse the widget snapshot from the App Group.
- How: a native SwiftUI target added through a config plugin, next to the existing widget target. Writes go to the phone through WatchConnectivity as events, and the phone's event writer stays the only writer. The engine does not run on the watch; the watch reads the phone's snapshot.
- Risk: Expo support for watch targets, and the Swift work itself. Spike for one session first. If the config-plugin route is unworkable, defer the item and record why.

**R4-2 Android Glance widget (1 session) and Wear OS tile (2 sessions)**
- Glance remains P3-5b and waits for expo-widgets. Re-check its Android renderer at each Expo SDK release (SDK 58 is the next).
- A Wear OS tile that shows the headline and offers a log action, through the Data Layer API. Wear OS has a smaller share of users, so this comes after the Glance widget.

**R4-3 Translations (owner and translators)**
- The P6-2 pipeline is ready. Priority order by market fit for a privacy-first, free app: de (strong privacy demand, Clue's home market), fr, es, pt-BR. Each locale needs a clinician read of the regulatory rows before release.

### Release 2.0: bigger bets (each one needs an owner decision first)

**R5-1 Sync between the user's own devices, end-to-end encrypted. Approved (D-077, O-2).**
- PLAN §11.4 leaves this open. The event log makes it simpler than usual: events are append-only with ids, retractions are events too, and a merge is a union followed by a projection rebuild. Transport is the same encrypted file in the user's iCloud Drive or Drive app folder that the backup already uses: one encrypted segment file per device, and each device reads the others' segments.
- Owner (answered, D-077): approved. It widens what the network rule calls "backup" into ongoing sync, so the same change updates the network rule in `CLAUDE.md`, the privacy policy, the consumer-health-data policy, the DPIA, the store privacy answers and the website. The data never touches a Sanguine server.
- Effort: about 5 sessions, plus a property test over random event interleavings.

**R5-2 Public trust signals (1 session). No audit, no F-Droid (D-077, O-3, O-4).**
- No paid audit. Publish a threat model (`docs/security/threat-model.md`: what an attacker with the phone, the cloud folder or the backup file can and cannot read) and the crypto test vectors already in `packages/crypto`, linked from `SECURITY.md` and the website.
- Submit the app to Mozilla's *Privacy Not Included* review. Euki's 10/10 is its main marketing asset, and Sanguine should score as well.
- No F-Droid build flavour (owner decision). The GitHub source and the AGPL licence stay the openness claim.

**R5-3 Accuracy published per engine version (2 sessions).**
- `tools/backtest` already reproduces §4.13. Publish its coverage and MAE tables on the website for each engine release, under the heading "engine validation on synthetic cycles". Synthetic cycles are not real users, and the page must say so in its first sentence. The tables show that the engine does what it claims on known inputs; they are not proof of accuracy for any one user. The per-user accuracy ledger (R3-4) is the real-world evidence, and it stays on the device.
- An optional donated-scores programme (§11.4) stays rejected until the owner decides. It is the only way to measure accuracy on real users, but it needs a server.

**R5-4 Regulated tier (PLAN Phase 7).** Out of scope. It contains a conception mode that `CLAUDE.md` forbids, and it needs funding and a second person. Revisit only by owner decision.

### Not doing, and why

| Idea | Reason |
| --- | --- |
| AI chat or assistant | Needs the network; makes clinical claims; hallucination risk on health content |
| Conception mode, "chance of pregnancy today", highlighted single fertile day | Forbidden by `CLAUDE.md` and the §2.3 regulatory strategy |
| Contraception mode, pill reminders, a bleeding-pattern view for hormonal contraception | Forbidden by `CLAUDE.md` ("never add a contraception feature"). A view built only for users on hormonal methods is a contraception feature, even though Oura ships one. Logging during the existing `hormonal_contraception` life state keeps working as today. |
| A "12 months without a period" milestone, perimenopause stage labels | They act as a diagnosis (R3-1) |
| Articles, a content feed, streaks, badges | §8.1 calm-by-default principle |
| Symptom-based prediction adjustments | Non-negotiable: symptoms never change a prediction |
| Analytics, crash reporting, A/B tests | Non-negotiable; CI deny-list. OS vitals (App Store Connect, Play Console) are the only crash signal. |
| Social or community features | Needs a server; privacy risk; outside the product's purpose |
| Live partner sync through a server | Network rule; R2-3 covers the need offline |

---

## Part 4. Order and dependencies

```text
R1 (1.0) ── R1-1 D-075 ─┬─ R1-2 Android pass ── R1-3 RC ── store
                        └─ R1-5 feedback row
R2 (1.1) ── R2-1 report ─┐
            R2-2 intents ├─ independent; any order; R2-4 drip import first (cheapest)
            R2-3 .ics ───┤   (owner sign-off needed first)
            R2-5 backup reminder ; R2-6 how-it-works
R3 (1.2) ── R3-4 accuracy list ── R3-1 perimenopause ── R3-2 pregnancy
R4 (1.3) ── R4-1 watch spike ── watch app ; R4-2 at each Expo SDK release
R5 (2.0) ── R5-1 sync (approved) ; R5-2 threat model ; R5-3 accuracy page
```

Suggested first week after store approval: R2-4, then R2-6, then R2-5, then R2-1. They are the cheapest, they need no owner decision except the D-id for R2-1, and they make the strongest store-listing claims ("free report for your doctor", "move from drip").

## Part 5. How to know it is working, without analytics

- Store ratings and review text, read weekly. Tag each review against the R-items.
- GitHub issues and feedback e-mails from R1-5.
- OS vitals: crash-free sessions of 99.5% or more (PLAN §10 Phase 5 acceptance criterion). App Store Connect reports crashes only from users who share diagnostics with developers, and Play vitals only from users who opted into usage and diagnostics. Treat the figure as a trend line on a biased sample, not an exact rate.
- The backtest and the accuracy tables from R5-3, run per engine release.
- No in-app measurement of any kind. Feature usage is not counted, by design. Say so on the website; it is part of the pitch.

## Part 6. Owner decisions

Answered by the owner on 2026-10-10 and recorded as D-077.

| # | Question | Answer |
| --- | --- | --- |
| O-1 | Is a user-initiated `.ics` export allowed under the privacy wording (R2-3)? | **Yes.** Build R2-3. The privacy policy gains one sentence on user-initiated calendar export when the feature ships. |
| O-2 | May the backup channel become sync between the user's own devices (R5-1)? | **Yes.** R5-1 is approved, through the user's own iCloud Drive or Drive app folder only, end-to-end encrypted, never through a Sanguine server. |
| O-3 | Budget for an independent security audit (R5-2)? | **No.** Publish the threat model and the crypto test vectors instead. |
| O-4 | F-Droid build flavour without `expo-updates` and Google sign-in (R5-2)? | **No.** No F-Droid flavour and no investigation. |
| O-5 | Taglines trademark check (Part 1.3, step 4) | Open. Until answered: ship the splash without the two taglines that echo Warhammer phrasing. |
