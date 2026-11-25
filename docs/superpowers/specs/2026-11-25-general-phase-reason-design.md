# Say why a day can't be placed in a phase (P8-43)

Approved by the owner, 2026-11-25.

## Intent
A user with a long imported Clue history saw "Any day of the cycle" on the guidance card and could not tell why. The owner cannot look at a user's data, so the reason has to be visible in the app: the user understands her own estimate, and a screenshot is enough for the owner to diagnose a report.

## Goals
- When `phaseOn` returns `general`, the guidance card names the specific reason, with her own numbers where they help.
- The Insights accuracy count reflects the engine version that is running now.

## Non-goals
- No change to when a day is `general` (D-098, D-115 rules stand).
- No diagnostics screen.
- No change to the Today ovulation card: it already says "Based on your cycle lengths." under the confidence word.

## Anti-goals
- Wording that implies a fertile or safe day, names a condition, or uses a word on the §2.3/§8.7 forbidden list.
- Fertility words (ovulation, fertile) in any reason a teen can see, or when the ovulation estimate is switched off.

## Approaches
1. **Reason returned by `phaseOn`, shown as the card's first sentence (chosen).** One pure function already decides `general`; it returns which branch fired, so the words can never disagree with the rule.
2. A separate diagnostics screen in Settings: rejected; it serves the owner, not her, and she would never open it.
3. Recompute the reason inside the card: rejected; duplicates `phaseOn`'s rules and drifts.

## Design
- `GuideDay` gains `reason?: GeneralReason` when `phase === 'general'`:
  - `{ kind: 'late', by: ISODate }`: open cycle, date past the next period's 80% upper bound (`by` = that bound).
  - `{ kind: 'wide', min, max, width }`: open cycle, ovulation estimate uncertain (80% range over 12 days). `min`/`max` = shortest and longest valid closed cycle among the last `WINDOW_CYCLES` kept cycles; `width` = the ovulation 80% range in days.
  - `{ kind: 'paused' }`: open cycle, a next period but no ovulation estimate (a life state stops the calendar estimate: hormonal IUD, perimenopause, breastfeeding without biomarkers).
  - `{ kind: 'setAside', quality }`: a past day in a closed cycle that is not `valid` (`suspect_skip`, `suspect_short`, `user_excluded`).
  - No reason when there is no next period at all (rare): the card keeps today's generic sentence.
- `BodyCard`: for `general`, the body is the reason sentence followed by "These notes hold for any day of the cycle."; the compact day sheet shows the reason sentence. For `paused`, the card names the life state(s) she set that stop the estimate, read from the app's current settings, using the existing life-state labels.
- Copy (en-AU, addresses women, no fertility words in any reason so the same text is safe in teen mode):
  - late: "Your period is later than the range Sanguine expected (by {date}), so it can't place this day in a phase."
  - wide: "Your cycle lengths have varied from {min} to {max} days, so the middle of your cycle can only be narrowed to {width} days. That is too wide to place this day in a phase."
  - paused: "While {state} is set, Sanguine doesn't estimate the middle of the cycle, so it can't place this day in a phase."
  - setAside: "This cycle was left out of estimates ({quality word}), so its days aren't placed in a phase." (quality words: existing `insights.quality.*`)
- Accuracy ledger (`data/ledger.ts`): a stored record whose `engine_version` differs from the running `ENGINE_VERSION` is re-scored, still from the history as of that cycle's start (no hindsight).

## Left to the builder
Type names, where the min/max helper lives, the exact `{date}` format (use the app's existing short date formatter), tests.
