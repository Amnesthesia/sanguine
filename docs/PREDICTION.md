# Prediction in Sanguine

How Sanguine forecasts periods and ovulation, how the forecasts are tested, what the testing found, and what changed because of it. Written for engineers working on the engine and for the owner deciding on its defaults.

The specification is [PLAN.md §4](PLAN.md#4-prediction-engine-specification). Decisions are in [DECISIONS.md](DECISIONS.md), mainly D-020, D-021, D-052, D-053, D-091 and D-094. The regulatory trace is in [regulatory/requirements.md](regulatory/requirements.md) and [regulatory/engine-changelog.md](regulatory/engine-changelog.md). This document describes engine version **0.2.0**.

## Contents

1. [What the engine promises](#1-what-the-engine-promises)
2. [How it is built](#2-how-it-is-built)
3. [Cycle length: the model](#3-cycle-length-the-model)
4. [Which cycles count](#4-which-cycles-count)
5. [Ranges and confidence](#5-ranges-and-confidence)
6. [Ovulation and the fertile window](#6-ovulation-and-the-fertile-window)
7. [Life states](#7-life-states)
8. [Health flags](#8-health-flags)
9. [App rules that shape the engine's input](#9-app-rules-that-shape-the-engines-input)
10. [How prediction is tested](#10-how-prediction-is-tested)
11. [What the testing found](#11-what-the-testing-found)
12. [Improvements in 0.2.0](#12-improvements-in-020)
13. [Learned models: compared, not shipped](#13-learned-models-compared-not-shipped)
14. [Research behind the life-event rules](#14-research-behind-the-life-event-rules)
15. [Known limits and open items](#15-known-limits-and-open-items)
16. [Changing the engine](#16-changing-the-engine)

## 1. What the engine promises

- **Pure and deterministic.** `predict(history, settings, today)` in `packages/engine` uses no clock, no randomness, no I/O and no platform API. The same inputs always give the same output. `purity.test.ts` enforces this, and the build records a hash of the engine (`buildInfo.ts`, `pnpm engine-hash`).
- **Every forecast is a range with a confidence grade.** The engine gives a most likely day, an 80% range and a 95% range, graded `high`, `medium`, `low` or `none`. Sanguine never shows a single "fertile day".
- **Symptoms never change a forecast.** Only period dates, temperatures (oral or wearable), LH tests, cervical mucus and cervical position do. A property test shuffles symptoms and checks that the output does not change.
- **Each forecast is computed from the full history.** Nothing is cached, so a back-dated entry or a correction gives the same result as entering everything in order.
- **The engine writes no wording.** It returns structured fields and codes. The app writes every word, so regulatory text lives in one place (`copy/en-AU.json`).

## 2. How it is built

```
Natural Cycles / Apple Health / manual logging
        │
        ▼
event log (append-only, SQLCipher)                     apps/mobile/src/data/store.ts
        │  project(): daily log, cycles, life states   apps/mobile/src/data/project.ts
        ▼
History + EngineSettings                               EventStore.engineInputs()
        │
        ▼
predict(history, settings, today)                      packages/engine/src/predict.ts
  1. classify cycles (valid / suspect / excluded / paused)        classify.ts
  2. retrospective ovulation on every closed cycle                 lh, mucus, cervix, bbt, combine
  3. life-state gate (suspend, warm-up, caps)                      lifestate.ts
  4. per-user recency, then the NIG posterior for cycle length     cycleLength.ts
  5. next period: point, 80%/95% (model or her own errors), grade  predict.ts
  6. ovulation: biomarkers this cycle, else calendar               ovulation.ts, combine.ts
  7. fertile-day probabilities, phase, flags                       fertile.ts, flags.ts
        │
        ▼
Prediction  ──► Today, Calendar, Insights, reminders, report
```

| File | Role |
| --- | --- |
| `types.ts` | `History`, `CycleRecord`, `DailyLog`, `LifeState`, `EngineSettings`, `Prediction` |
| `params.ts` | Every clinical and statistical constant, with its source. `ENGINE_VERSION` |
| `classify.ts` | Cycle lengths, bounds, long-cycle (MAD) rule, user exclusions, life-state overlap |
| `cycleLength.ts` | Prior, conjugate update, Student-t intervals, `selectRecency`, `conformalHalfWidths` |
| `lifestate.ts` | Turns life states into a gate: suspension, warm-up weights, caps, `steady` |
| `lh.ts`, `mucus.ts`, `cervix.ts`, `bbt.ts` | Ovulation detectors per signal |
| `combine.ts` | Inverse-variance combination with a temporal gate and conflict rules |
| `ovulation.ts`, `fertile.ts` | Luteal model, calendar ovulation, fertile-day probabilities |
| `flags.ts` | Health flags (never name a condition) |
| `predict.ts` | Wires the above together; `analyzeCycles` exposes the classified cycles |

## 3. Cycle length: the model

The length of her next cycle follows a Normal-Inverse-Gamma (NIG) posterior over her kept cycles. The forecast range comes from its Student-t predictive distribution (PLAN §4.3).

- **Prior.** Mean m₀ = 29.3 d, or by age band from 18 (Bull 2019: 30.3, 29.9, 29.2, 28.2, 27.4 d for ≤24, 25–29, 30–34, 35–39 and 40–45). κ₀ = 0.5, α₀ = 2.5, β₀ = α₀·2.6² = 16.9. Under 18 (teen mode) the population mean applies.
- **Update.** Weighted conjugate update over the last 12 kept cycles (`WINDOW_CYCLES`). A cycle's weight is recency λ^(n−1−i) times its life-state weight (§7). A "usual cycle length" from onboarding counts as one observation at weight 0.5.
- **Per-user recency (0.2.0).** With 6 or more kept cycles, the engine picks λ from {1, 0.92, 0.9, 0.8} and κ₀ from {0.5, 1, 2}: the pair that best forecast her own past cycles, each from the cycles before it only (leave-future-out). The defaults come first in each grid, so a tie keeps them. λ never goes above the settings or life-state cap, so perimenopause stays at 0.8. Below 6 cycles the defaults apply (λ = 1, κ₀ = 0.5). A fixed λ = 0.92 was rejected in D-021 because it gained 4.9% against the 15% bar.
- **Output.** `cycleLength = { mean, sd, nu, scale, nCyclesUsed }`. The next-period point is the open cycle's start + mean, rounded to a day.

## 4. Which cycles count

`classifyDetailed` gives every cycle a quality. Only `valid` cycles feed the model.

| Quality | When |
| --- | --- |
| `life_state` | The cycle overlaps hormonal contraception or a pregnancy, or spans a delivery or loss day |
| `user_excluded` | She excluded it |
| `suspect_short` | Under 15 days |
| `suspect_skip` | Over 90 days, or above the long-cycle limit (unless she confirmed it as a real long cycle) |
| `valid` | Everything else, including the open cycle |

**Long-cycle limit:** median + max(7, 3 × 1.4826 × MAD) over in-range, non-excluded cycles. The floor is 14 when she has marked herself as known irregular. It needs 3 cycles.

**As of closure (0.2.0).** Once 6 cycles are pooled, each cycle is judged by the limit as it stood when that cycle closed. Cycles that closed earlier are judged by the limit at the moment the sixth closed. Under 6 cycles, the limit over all of them applies, as before. A later cycle therefore never drops a cycle that was kept, so logging a period a day later can no longer pull the forecast earlier (finding e). This is not applied from 3 cycles because it would permanently set aside an early 36-day cycle among 28s, which a fuller history keeps.

**A short cycle is never set aside on its own**, because a real short cycle has to count. The app asks about it instead (§9).

## 5. Ranges and confidence

**Model range.** The 80% and 95% ranges are Student-t predictive intervals around the posterior mean, with ν = 2α.

**Her own errors (0.2.0).** Once she has 8 one-step forecast errors on her last 12 kept cycles (each cycle forecast from at least 3 before it, with recency chosen as it would have been then), the half-widths become the split-conformal quantiles of those errors. Index ⌈(n+1)·level⌉, never under 1 day. With 8–9 errors, both levels take the largest error, which is the honest finite-sample answer.

- When she is **steady** (no warm-up, breastfeeding, perimenopause or known-irregular state), her own range replaces the model's range. It can narrow or widen.
- Otherwise it can **only widen** the model's range.
- After a **pregnancy loss**, the range is also floored at the range from the post-loss cycles alone (§7).
- The missed-period flag keeps using the model's 95% bound, so this change does not alter flags.

**Confidence (D-020)**, on the final 80% half-width:

| Grade | Rule |
| --- | --- |
| `low` | Fewer than 2 cycles, or half-width over 5 d |
| `high` | 6 or more cycles and half-width 3 d or less |
| `medium` | Otherwise |

A life state can cap the grade: `low` during a warm-up, `medium` for known irregular, `none` when suspended.

**Phase.** `menstrual` until the period's end (or day 5). Then `follicular`, `ovulatory` (ovulation ± 1 d) or `luteal`. `late` once today is past the top of the 80% range. The point does not move as days pass; only a logged period moves it.

## 6. Ovulation and the fertile window

- **Biomarkers first.** Each signal gives an estimate with an SD:
  - LH: first positive after a negative, ovulation +1 d, SD 1.0.
  - Mucus peak: SD 1.5.
  - BBT three-over-six (+0.2 °C): SD 1.5.
  - Wearable temperature shift (+0.3 °C): SD 2.0.
  - Cervical position: SD 2.5.

  `combineOvulation` takes an inverse-variance mean of the kept signals. A temperature shift is kept only if it falls −1 to +4 d from the LH or mucus estimate. If two kept signals disagree by more than 3 d, the most precise one wins, confidence is `low` and the conflict is flagged. Imported and untimed readings get wider SDs (provenance multipliers).
- **Calendar otherwise.** Ovulation = start + cycle-length mean − luteal length. Luteal prior: 12.4 ± 2.4 d (Bull 2019) at weight 10. It updates from her biomarker-dated cycles (luteal = next start − ovulation − 1). SD = √(Var L + Var luteal).
- **Fertile days.** Each day d gets the probability that it lies inside the Wilcox six-day window: Φ((d+5.5−E[O])/SD) − Φ((d−0.5−E[O])/SD). The app draws this as a graded band.
- **Ovulation grade.** By SD: ≤ 1.5 `high`, ≤ 3 `medium`, else `low`.
- **A dated ovulation does not move the next-period forecast.** This is deliberate; see finding (b).

## 7. Life states

| State | Effect |
| --- | --- |
| Hormonal contraception | Suspended. Withdrawal bleeds never start a cycle |
| Pregnant | Suspended; no flags |
| Postpartum after a birth | Suspended until the first period. Then 3 warm-up cycles: earlier cycles weight 0, post-birth cycles weight 0.5, confidence `low` |
| Breastfeeding | As after a birth, plus no calendar fertile band until a biomarker confirms an ovulation. Her own-error range only widens |
| After a pregnancy loss (0.2.0) | Suspended until the first period. Then 3 warm-up cycles in which the cycles before the pregnancy keep weight 0.5. The range is floored at the post-loss-only range, confidence `low` |
| After stopping contraception | 3 warm-up cycles as after a birth |
| Perimenopause | λ capped at 0.8, variance prior doubled, fertile band only from biomarkers, missed-period gap 60 d |
| Known irregular (PCOS or other) | Long-cycle floor 14, confidence capped at `medium` |

A cycle paused by a life state is not a period for suspension or warm-up counting (D-053 follow-up). The app records whether a pregnancy ended in a birth or a loss, and passes it to the engine as `postpartum.after`.

## 8. Health flags

These are computed from valid cycles only, are age-aware, never name a condition, fire at most once per 90 days and can be muted:

- short cycles
- long cycles
- high variability
- heavy bleeding
- prolonged bleeding
- bleeding between periods
- missed period: open cycle longer than max(90 d, 95% upper bound + 14 d), or 60 d in perimenopause
- short luteal phase, shown as an insight only

Thresholds and wording are in PLAN §4.10.

## 9. App rules that shape the engine's input

The engine only sees what `project()` builds. These app rules decide where cycles start:

- **Period joining (D-052).** Period days up to 7 days apart form one period, unless at least 2 no-flow days lie between them or she split the period.
- **Bleeding after a pregnancy (D-053).** Bleeding within 14 days of a loss (42 after a birth) defaults to post-pregnancy bleeding (`flowKind: 'post_pregnancy'`), which never starts a cycle. Natural Cycles' `MISCARRIAGE_BLEEDING` imports as this.
- **"Was this a period?" (0.2.0, item 5).** Today asks once, within 7 days of the bleed, when:
  - the cycle that bleed ended was 20 days or shorter (FIGO lower bound), and
  - that cycle was at least 7 days below her median of 3 or more earlier cycles.

  "No" re-marks each bleeding day as bleeding between periods (the same action as the day screen). Answers are kept in the `shortCycleAnswered` setting. Bleeding logged within 7 days after an answer does not ask again. Code: `features/today/shortCycle.ts`; dev scenario `shortCycle`; flow `.maestro/short-cycle.yaml`.

## 10. How prediction is tested

| Layer | File | What it checks |
| --- | --- | --- |
| Unit | `packages/engine/src/*.test.ts` | Every rule and detector; fixtures A–I from PLAN §4.12 to 0.05 d |
| Properties | `properties.test.ts`, `scenarios.test.ts` | Determinism; symptoms never matter; intervals contain the point; shifting dates shifts outputs. A period logged later never gives an earlier forecast (from 6 cycles, while the just-closed cycle keeps its quality); the next forecast is always at least 15 d after a newly logged period |
| Forecast dynamics | `packages/engine/src/scenarios.test.ts` | Period logged early, on time or late; learning cycle by cycle; late and missed periods; missed logs; short bleeds; pregnancy and loss, marked or not; breastfeeding; contraception; perimenopause; LH and BBT; following a lasting change |
| Release gate (§4.15) | `tools/backtest/acceptance.test.ts` | 1,500 seeded synthetic users: MAE ≤ 2.8 d at 8 cycles; coverage within 5 points of nominal; robust exclusion; per-user recency against fixed λ = 1 |
| Life events | `tools/backtest/scenarios.test.ts` | 400 seeded users per event (none, missed log, long anovulatory cycle, short bleed, unmarked or marked loss, +5 d step), scored before, around and after the event. Also learning over time, and challenger and learned models |
| Natural Cycles round trip | `apps/mobile/src/data/naturalCyclesRoundtrip.test.ts` | 18 fake NC exports written from a known timeline (`ncFixture.ts`) through the real importer: starts, loss bleed, ovulation ± 1 d, same forecast as from the truth |
| Real export | `apps/mobile/src/data/naturalCyclesBacktest.test.ts` | The owner's export, cut off at every cycle (and days 7, 14 and 21), forecast against the real next start. Runs only where the file exists |
| Generated samples | same file, `tools/sample/` | Owner-generated and planned NC exports (`generate_logs.py`, with `.truth.json`): import robustness and accuracy against a known timeline |
| App | `features/today/shortCycle.test.ts`, `features/dev/scenarios.test.ts` | The short-cycle question and its answers |

The real export (`NaturalCycles-daily-entries.xlsx`) is personal health data. It is gitignored and never committed. Tests and docs carry only aggregates, never dates.

```sh
npx vitest run packages/engine                           # engine unit, property and scenario tests
BACKTEST_REPORT=1 npx vitest run tools/backtest          # synthetic gate and life events, with tables
BACKTEST_REPORT=1 npx vitest run apps/mobile/src/data/naturalCyclesBacktest.test.ts   # real export (NC_XLSX=path to override)
python tools/sample/generate_logs.py --days 365 --irregular-cycles --missed-periods --pregnancy-loss --no-llm --seed 3 --output x.xlsx
```

**Scoring.** MAE is the mean absolute error in days between the forecast point and the real start. Coverage is how often the real start falls inside the 80% or 95% range. Width is the mean width of the 80% range. "Regular targets" leave out forecasts whose target cycle was set aside (a skipped log or a pregnancy). Synthetic users follow Bull 2019: per-user mean ~N(29.3, 4.5), per-user SD log-normal around 2.6 d, and 4% late-ovulation cycles.

## 11. What the testing found

These are the P8-12 findings (D-091). Each is pinned by a test, so any fix shows up as a deliberate test change.

| | Finding | Status in 0.2.0 |
| --- | --- | --- |
| a | 80% range too wide for regular users: holds 90% (synthetic) and 95% (real export) | **Fixed** by ranges from her own errors: real export 90% held |
| b | A dated ovulation never moves the next-period forecast. "Ovulation + her luteal length" is 40% better on synthetic users with clean LH tests but worse on the real export (1.52–1.63 vs 1.42–1.52 d) | **Kept as is.** Revisit with more real exports that have LH tests |
| c | After a marked loss the warm-up ignored all earlier cycles (real export 1.52 vs 1.42 d) | **Fixed**: earlier cycles at weight 0.5, with a range floor |
| d | Fixed λ = 1 follows a lasting change slowly (3.81 vs 1.98 d without one) | **Fixed** by per-user recency: 3.17 d |
| e | The long-cycle limit is a hard cut: logging a day later could drop two older cycles and pull the forecast earlier | **Fixed** by judging each cycle as of its closure, from 6 cycles |
| f | A mid-cycle bleed logged as a period leaves a 15–19 d "cycle" that counts | **Addressed in the app** by the short-cycle question |
| g | Once a late period passes the forecast, the point stays in the past (Today shows "late") | **Open**: a dated range then needs a UI decision |
| h | The luteal prior (weight 10) holds a measured short luteal back: five 9-day lutea move the estimate by 1 d | **Kept**: a §11.1 default backed by Bull 2019 |
| i | `post_pregnancy` missing from the engine's `flowKind` type | **Fixed** |
| j | Lag-1 autoregression on cycle lengths: no gain (1.45 vs 1.42 d) | Not adopted |
| k | Very irregular users (SD 6 d): 80% range holds only 60% | **Partly**: her own errors widen the range once she has 11+ kept cycles; the 14-cycle sample is still at 60% |

Other results from the suite:

- A late unlogged period turns the phase to `late` and raises `missed` only after 90 d (60 d in perimenopause).
- A 56-day missed log costs nothing.
- An unmarked loss is set aside as a long cycle, and forecasts recover two cycles later.
- Imported NC exports land exactly: starts equal the logged starts, and ovulation is dated within 1 d (synthetic) or within 2 d in at least 70% of cycles (planned samples).

## 12. Improvements in 0.2.0

D-094 records the owner's decision ("action the plan"). The plan is [superpowers/plans/2026-10-10-prediction-improvements.md](superpowers/plans/2026-10-10-prediction-improvements.md). Each change sits behind one constant in `params.ts` or `lifestate.ts`.

| Scenario | Before (0.1.10) | After (0.2.0) |
| --- | --- | --- |
| Real export, regular targets (n = 60): MAE | 1.42 d | 1.42 d |
| Real export: 80% range holds / width | 95% / 5.9 d | 90% / 5.5 d |
| Real export, losses marked: MAE | 1.52 d | 1.42 d |
| Real export, every target, losses marked | 4.19 d | 4.14 d |
| Synthetic +5 d lasting change: MAE / 80% held | 3.81 d / 75% | 3.17 d / 89% |
| Synthetic marked loss, around it: MAE / 80% held | 5.68 d / 70% | 4.44 d / 84% (13.5 d wide) |
| Synthetic, no event: MAE / 80% held | 1.98 d / 90% | 2.02 d / 90% |
| Synthetic short bleed, two or more cycles on: MAE / width | 2.76 d / 12 d | 2.79 d / 17 d |
| §4.15 gate: MAE at 8 cycles | ≤ 2.8 | 2.80 (limit 2.8) |
| Recency vs fixed λ = 1 on the gate's +7 d step / clean histories | n/a | −9.3% / +0.7% |
| Planned samples, MAE: regular / loss / missed / very irregular | 1.19 / 1.86 / 1.14 / 5.4 d | 1.24 / 2.0 / 1.14 / 5.4 d |

**Paths not taken, measured:**

- **A margin before replacing the default recency.** It kept the 8-cycle gate further from its limit but gave back most of the gain after a change: 9% at margin 0, 4% at 5%, 1% at 20%.
- **The loss warm-up without a range floor.** The range held 60% around the loss, under the 70% bar.
- **The long-cycle limit as of closure from 3 cycles.** It set aside an early 36-day cycle for good.
- **"Kept under either limit".** It was more lenient and gave MAE 2.81 at 8 cycles, over the gate.

**Learning over time**, now tested on stable synthetic users:

| Cycles logged | Gap to her true mean | Forecast MAE | 80% width | 80% held |
| --- | --- | --- | --- | --- |
| 0–1 | 2.9 d | 3.64 d | 11.5 d | 84% |
| 2–3 | 1.4 d | 2.42 d | 8.8 d | 88% |
| 4–6 | 1.1 d | 2.34 d | 8.1 d | 87% |
| 7–10 | 0.9 d | 2.38 d | 7.9 d | 88% |
| 11–15 | 0.8 d | 2.30 d | 8.5 d | 89% |

After about 4 cycles, error is dominated by her own cycle-to-cycle variation (SD ~2.6 d), so it falls slowly. The estimate of her own length keeps improving. After a +5 d lasting change, the error falls each cycle: 5.5, 4.4, 4.3, 3.5, 3.2, 2.8, 2.5 d. On the real export the error stays within 2 d at every history length but does not fall steadily: her later years include the losses and vary more.

**Cost:** 8.7 ms per `predict` with 80 cycles (Node). The app predicts once per refresh, and the score ledger once per newly closed cycle.

## 13. Learned models: compared, not shipped

The owner asked whether a small ML model trained on her own data could do better, alone or combined with the engine. Five deterministic models were built in `tools/backtest/src/ml.ts` (closed-form ridge, and a 6-8-1 tanh network trained with a seeded RNG). All use the engine's outlier rules in front.

| Model | Real export | Planned regular | Planned irregular | Synthetic, no event | Synthetic, +5 d step |
| --- | --- | --- | --- | --- | --- |
| Engine (0.1.10) | **1.42** | 1.19 | **5.4** | **1.98** | 3.81 |
| Ridge on her own cycles (needs 8) | 1.53 | 1.29 | 7.8 | 2.48 | 3.32 |
| Ridge on 1,200 synthetic users | 1.75 | 1.19 | 6.2 | 2.30 | 2.68 |
| Network on the same users | 1.70 | **1.14** | 6.3 | 2.29 | **2.39** |
| Engine and network averaged | 1.52 | **1.14** | 5.9 | 2.07 | 2.75 |

Each figure is the mean absolute error in days.

- **Trained on one user:** too little data (12–70 cycles), so it overfits. The engine's Bayesian model already learns from her cycles, with the right amount of shrinkage.
- **Trained on a population:** these win only on the synthetic events they were trained on. Training on real users would need data the app must never collect.
- **What did work** was calibration, not the point: sizing her range from her own past errors. That shipped in 0.2.0 as a closed-form rule (§5), not a model that retrains itself. A model that retrains itself is an adaptive algorithm with a heavier regulatory path (TGA/FDA change-control plan).

## 14. Research behind the life-event rules

These sources set the synthetic generators and the expected direction of forecasts. They did not change engine parameters.

- **Early pregnancy loss.**
  - Ovulation can return about 2 weeks after the loss, and the first period usually comes 4–6 weeks after it (ACOG, via [Healthline](https://www.healthline.com/health/pregnancy/ovulation-after-miscarriage) and [Medical News Today](https://www.medicalnewstoday.com/articles/325642)).
  - About 25% of hCG-detected pregnancies end in bleeding that is taken for a period ([NIEHS Early Pregnancy Study](https://www.niehs.nih.gov/research/atniehs/labs/epi/studies/eps)).
  - No published median time to first ovulation was found.
- **Cycle phases.** Luteal 12.4 d (95%: 7–17), follicular 16.9 d (10–30) ([Bull 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6710244)).
- **After a birth without breastfeeding.** First ovulation at mean day 45–94 ([systematic review](https://rrmacademy.org/library/return-of-ovulation-and-menses-in-postpartum-nonlactating-women-a-systematic-rev-lrudv46h/)).
- **After the pill.** A short delay of about three cycles (Yland 2021, [Mansour 2009](https://pubmed.ncbi.nlm.nih.gov/19268187/)).
- **Definitions.**
  - Cycles under 24 d or over 38 d are outside the typical range for adults (FIGO 2018).
  - Absence of periods for 90 days counts as amenorrhoea (PCOS guideline 2023).
  - Early perimenopause is two or more cycle-to-cycle differences of 7 d or more (STRAW+10).

## 15. Known limits and open items

- **Late period (finding g).** No dated range is shown once the forecast has passed. The conditional range ("given it has not started by today") is the candidate, but it needs a UI decision first.
- **Confirmed ovulation (finding b).** It does not inform the next period. Revisit with more real exports that carry LH tests.
- **Very irregular users.** Their range is calibrated only after 11 or more kept cycles. Before that it can be too narrow (60% held on the 14-cycle sample).
- **Short-bleed users.** Until she answers the short-cycle question, the 15–19 d cycle counts and widens her range (17 d on synthetic users).
- **Approximations in the new rules.** Recency selection and the error-based range use her kept lengths without warm-up weights. A warm-up only ever widens the range, so this errs on the wide side.
- **Release gate.** MAE at 8 cycles is at its 2.8 d limit. Any change that adds noise for users with few cycles will trip it.
- **Real-data evidence.** It comes from one person's export (68 cycles, 3 losses). The generated samples test import robustness and known timelines, not population accuracy.

## 16. Changing the engine

1. Write the test first. Pin current behaviour, then change it deliberately.
2. Put any new constant in `params.ts` (or one named constant next to its rule), with its source.
3. Bump `ENGINE_VERSION`. Add a row to `regulatory/engine-changelog.md` with before/after figures, and update `regulatory/requirements.md`. Run `pnpm engine-hash`.
4. Run the fixtures, the §4.15 gate (`tools/backtest/acceptance.test.ts`), the life-event backtest, and the real-export backtest locally. Record the aggregates in DECISIONS.md.
5. A change to a §11.1 conservative default needs the owner's decision. Never loosen one without it.
6. Engine changes ship only in versioned builds, never over the air (PLAN §6.6).
