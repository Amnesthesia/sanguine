# Engine requirements trace

IEC 62304-style traceability: each engine rule has an id, a source and the test that proves it. Keep this table current whenever a rule or parameter changes (and add a line to `engine-changelog.md`). Test paths are relative to `packages/engine/src/`; `fixtures.test.ts` references fixtures A–I of PLAN.md §4.12.

| ID | Rule | Source | Test | Status |
| --- | --- | --- | --- | --- |
| ER-01 | `predict` is deterministic: same inputs give identical output; no clock, randomness or I/O in the package | PLAN §4.1 | `properties.test.ts` (determinism), `purity.test.ts` | done P1-8 |
| ER-02 | Every number is a distribution: point, 80% interval, 95% interval, confidence grade | PLAN §4.1 | `fixtures.test.ts` A–E | done P1-9 |
| ER-03 | Symptoms never change `nextPeriod` or `ovulation` | PLAN §4.1, §11.1 C-10 | `properties.test.ts` (symptom permutation) | done P1-8 |
| ER-04 | Cycle length ~ Student-t from a Normal-Inverse-Gamma posterior; prior m₀ by age band, κ₀ 0.5, α₀ 2.5, β₀ 16.9 | PLAN §4.3; Bull 2019 | `cycleLength.test.ts`, fixtures A–E | done P1-1|
| ER-05 | Recency weights w = λ^(n−i); window 12 valid cycles. With ≥ 6 kept cycles λ ∈ {1, 0.92, 0.9, 0.8} (never above the settings/life-state cap) and κ₀ ∈ {0.5, 1, 2} are chosen per user by her own leave-future-out error, defaults winning ties; below 6, λ = 1 (0.92 as a fixed default failed acceptance, D-021) | PLAN §4.3 (VERIFY V-05); D-094 | `cycleLength.test.ts` (selectRecency), `scenarios.test.ts` (lasting change), backtest λ acceptance | done P1-1; per-user P8-13 |
| ER-06 | `studentTQuantile` matches SciPy to 1e-8 for real ν | PLAN §4.11 | `studentT.test.ts` | done P0-6 |
| ER-07 | Cold start: 0 cycles with a last period uses the prior; no last period predicts nothing; a usual cycle length counts as one observation of weight 0.5 | PLAN §4.3 | fixture C, `cycleLength.test.ts` | done P1-1|
| ER-08 | Length < 15 d is `suspect_short`; > 90 d is `suspect_skip`; both excluded from the update | PLAN §4.4 | `classify.test.ts` | done P1-2 |
| ER-09 | With ≥ 3 cycles a length above median + max(7, 3·1.4826·MAD) is `suspect_skip`, excluded from mean/variance. From 6 pooled cycles each cycle is judged by the limit as of its own closure (earlier ones by the limit when the sixth closed), so a later cycle never drops a kept one | PLAN §4.4; Li 2020/2022; D-094 | fixture B, `classify.test.ts`, `scenarios.test.ts` (monotone property) | done P1-2; as-of-closure P8-13 |
| ER-10 | `user_excluded` and life-state cycles are removed from the update and from flags; `confirm_long` re-admits a cycle | PLAN §4.4 | `classify.test.ts` | done P1-2 |
| ER-11 | Full-history recomputation: no cached state; back-dated entries give the same result as entering in order | PLAN §4.4 | `properties.test.ts` | done P1-8 |
| ER-12 | Ovulation = predicted cycle length − luteal length; SD = √(Var L + Var luteal); luteal prior 12.4 ± 2.4 | PLAN §4.5; Bull 2019 (C-01) | fixtures A, F | done |
| ER-13 | Luteal posterior updates from biomarker-dated luteal phases; luteal length = nextStart − ovulation − 1 | PLAN §4.5 | fixture F | done |
| ER-14 | Fertile probability p(d) = Φ((d+5.5−E[O])/SD) − Φ((d−0.5−E[O])/SD) | PLAN §4.8; Wilcox 1995 | fixtures A–D, G | done |
| ER-15 | Confidence grade by SD[O]: ≤ 1.5 high, ≤ 3 medium, else low; none when suspended | PLAN §4.8 | `ovulation.test.ts` | done |
| ER-16 | BBT shift: three-over-six, third high ≥ 0.2 °C above the six-day maximum; ovulation = day before first high; SD 1.5 | PLAN §4.6 (C-05) | `bbt.test.ts` | done P1-4 |
| ER-17 | CUSUM secondary detector; if it disagrees by > 2 d the shift has SD 2.5 and confidence low | PLAN §4.6 | `bbt.test.ts` | done P1-4 |
| ER-18 | Disturbed, out-of-range (35.0–37.5 °C) and > 60 min off-median readings are excluded; one excluded day does not break the count, two consecutive do | PLAN §4.6 (V-06) | `bbt.test.ts` | done P1-4 |
| ER-19 | Detection needs valid temperatures on ≥ 50% of cycle days to date | PLAN §4.6; Bull 2019 | `bbt.test.ts` | done P1-4 |
| ER-20 | Wearable temperatures form a separate series with a 0.3 °C threshold and SD 2.0; never mixed with oral | PLAN §4.6 (C-05); Zhu 2021 | `bbt.test.ts` | done P1-4 |
| ER-21 | LH: first positive after ≥ 1 negative → ovulation = day + 1, SD 1.0; no prior negative within 2 d → SD 1.5; > 3 days of positives → indeterminate, SD 2.5, no override | PLAN §4.6 (C-03) | `lh.test.ts`, fixture G | done |
| ER-22 | Mucus peak = last eggwhite/watery day before a 3-day change; ovulation = peak, SD 1.5 | PLAN §4.6 (C-04) | `mucus.test.ts` | done |
| ER-23 | Cervical position: high/soft/open ≥ 2 d then low/firm/closed → last high day, SD 2.5, weight capped | PLAN §4.6 (V-07) | `cervix.test.ts` | done |
| ER-24 | Combination: inverse-variance weighted mean of kept signals; one temperature series only | PLAN §4.6, S5 | `combine.test.ts` | done |
| ER-25 | Temporal gate: a temperature shift is discarded unless −1 to +4 d from the LH/mucus estimate; conflict recorded | PLAN §4.6 (C-06) | fixture H | done |
| ER-26 | If two kept signals differ by > 3 d, use the most precise one, confidence low, flag the conflict | PLAN §4.6 | `combine.test.ts` | done |
| ER-27 | Provenance multipliers on signal SD (manual/imported/sensor) | PLAN §4.7 | each detector test | done |
| ER-28 | Hormonal contraception (any method) suspends prediction; withdrawal bleeds are never cycle starts | PLAN §4.9 | fixture I | done |
| ER-29 | Post-contraception and after a birth: 3 cycles prior-only at weight 0.5, confidence low. After a pregnancy loss the cycles from before it keep weight 0.5 during the warm-up, and the range is never narrower than the post-loss-only range | PLAN §4.9 (C-08); D-094 | `lifestate.test.ts`, `scenarios.test.ts` (pregnancy loss), `tools/backtest/scenarios.test.ts` (marked loss) | done; loss P8-13 |
| ER-30 | Pregnant: suspended; postpartum: suspended until first period, breastfeeding adds 3 low-confidence cycles and no band without a biomarker | PLAN §4.9 (C-09) | `lifestate.test.ts` | done |
| ER-31 | Perimenopause: λ = 0.8, variance prior doubled, band only with biomarkers, 60-day gap flag | PLAN §4.9 | `lifestate.test.ts` | done |
| ER-32 | Known irregular: exclusion threshold median + max(14, 3·MAD), confidence capped at medium | PLAN §4.9 | `lifestate.test.ts` | done |
| ER-33 | Short-cycle flag: 2 of last 3 valid < 24 d (adult), < 21 d (1–3 y post-menarche) | PLAN §4.10 (C-07); FIGO 2018 | `flags.test.ts` | done |
| ER-34 | Long-cycle flag: 2 of last 3 > 38 d (adult), > 45 d (1–3 y); any > 90 d after 1 y | PLAN §4.10 (C-07) | `flags.test.ts` | done |
| ER-35 | Variability flag: range over last 6 valid cycles > 9 d (18–25, 42–45) or > 7 d (26–41); none in year 1 post-menarche | PLAN §4.10 | fixture D, `flags.test.ts` | done |
| ER-36 | Heavy-bleeding, prolonged-bleeding and intermenstrual flags | PLAN §4.10 | `flags.test.ts` | done |
| ER-37 | Missed-period flag: open cycle > max(90, upper95 + 14) d; > 60 d at age ≥ 40 | PLAN §4.10 | `flags.test.ts`, `scenarios.test.ts` (late period, P8-12) | done |
| ER-38 | Short-luteal insight only, never a flag | PLAN §4.10 (C-02) | `flags.test.ts` | done |
| ER-39 | Each flag fires at most once per 90 days and can be muted; flag wording is never produced by the engine | PLAN §4.1, §4.10 | `flags.test.ts` | done |
| ER-40 | Property: intervals contain the point; 95% contains 80%; an identical extra cycle never widens the interval; shifting dates by k shifts outputs by k | PLAN §4.15 | `properties.test.ts` | done P1-8 |
| ER-41 | Backtest: coverage within ±5 points of nominal; MAE ≤ 2.8 d at 8 cycles | PLAN §4.15, §10 | `tools/backtest`; life events and challengers `tools/backtest/scenarios.test.ts`; NC export round trip `apps/mobile/src/data/naturalCyclesRoundtrip.test.ts` (P8-12, D-091) | done P1-8 |
| ER-42 | The engine package has no runtime dependencies and no platform imports | PLAN §4.1 | `tools/ci/soup.test.ts`, `purity.test.ts` | done P1-8 |
| ER-43 | Cycle boundaries (app projection feeding the engine): period days up to 7 apart are one period unless ≥ 2 no-flow days lie between or the user split it | PLAN §5.4; D-052 | `store.test.ts` (cycles from flow), `actions.test.ts` (splitAt) | done P3-9 |
| ER-44 | Pregnancy outcome: ending `pregnant` records birth or loss; a loss sets the postpartum rule (suspend until the first period, then warm-up); a marked past pregnancy pauses the long cycle and the one its ending bleed starts | PLAN §4.9; D-053 | `lifeState.test.ts` (pregnancy outcome), `events.test.ts`, engine `lifestate.test.ts` (paused cycles are not periods), `scenarios.test.ts` (loss before and after the first period, P8-12) | done P3-12 |
| ER-45 | Bleeding within 14 days of a loss or 42 days of a birth defaults to post-pregnancy bleeding, which never starts a cycle | PLAN §11.1; D-053 | `actions.test.ts` (bleeding after a pregnancy) | done P3-12 |
| ER-46 | Health sync never re-imports what Sanguine wrote: records from our own source, with our event id, or matching a content hash we wrote in the last 48 h are dropped | PLAN §7.3; D-057 | `health-adapter/src/sync.test.ts` (echo prevention), `roundTrip.test.ts` (zero duplicates over 3 cycles) | done P4-1 |
| ER-47 | Health sync conflicts: a manual entry wins over an import, among imports the latest platform modification wins, the loser is kept as a retracted event; a period start within one day of ours is agreement | PLAN §7.3; D-057 | `sync.test.ts` (duplicates and conflicts) | done P4-1 |
| ER-48 | Health sync deletions: a platform deletion retracts the imported event, asks before retracting a manual one; a retract in Sanguine deletes the platform record; wrist temperature and symptoms are never written | PLAN §7.1, §7.3; D-057 | `sync.test.ts` (deletions, writes), `mapping.test.ts` (never written) | done P4-1 |
| ER-49 | A backup (uploaded or shared) contains no event imported from HealthKit and no derived CSV; a restore leaves nothing dangling | PLAN §7.6; D-061 | `healthBackup.test.ts` | done P3-7 (part) |
| ER-50 | Platform records are mapped without guessing: unknown flow counts as medium, an estrogen surge is not an LH result, sexual activity without a protection flag and non-Celsius temperatures are skipped and reported, wrist temperature is never written | PLAN §7.1; D-060 | `healthkitMapping.test.ts`, `healthConnectMapping.test.ts`, `sync.test.ts` (records a driver cannot map) | done P4-2, P4-3 (mapping) |
| ER-51 | Next-period ranges from her own errors: with ≥ 8 one-step errors on the last 12 kept cycles, the 80%/95% half-widths are their split-conformal quantiles (≥ 1 d); they replace the model's range when no life state shapes the model and only widen it otherwise; the confidence grade uses the final range | PLAN §4.3, §4.15; D-094 | `cycleLength.test.ts` (conformalHalfWidths), `predict.test.ts` (ranges from her own errors), `tools/backtest/scenarios.test.ts` (learning over time) | done P8-13 |
| ER-52 | App: a cycle of ≤ 20 d and ≥ 7 d below her median (3+ cycles) is asked about once on Today; "not a period" re-marks its bleeding as between periods; nothing is set aside without her answer | D-094 (app rule feeding the engine's cycle boundaries) | `features/today/shortCycle.test.ts`, `.maestro/short-cycle.yaml` | done P8-13 |
