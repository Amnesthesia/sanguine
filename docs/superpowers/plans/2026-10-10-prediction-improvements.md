# Prediction improvements from the P8-12 test suite (D-091)

For the owner (decisions) and whoever implements them. Every item below comes from a measured result in the P8-12 suite, has a test that already pins today's behaviour (so the change shows up as a deliberate test edit), and lists what it costs in the engine's regulatory paperwork.

## Where we are

| Data | Engine error (regular cycles) | Next period inside the 80% range | Best simple rule |
|---|---|---|---|
| Owner's Natural Cycles export, 60 forecasts | 1.42 d | 95% (target 80%) | 3.47 d (mean of last 3) |
| Planned sample, regular, 21 forecasts | 1.19 d | 95% | 1.24 d |
| Planned sample, very irregular (SD 6 d), 10 forecasts | 5.4 d | 60% | 6.4 d |
| Synthetic, no event, 2,400 forecasts | 1.98 d | 90% | 2.70 d (last length) |
| Synthetic, +5 d lasting change, 2,400 | 3.81 d | 75% | 2.91 d |

The engine already beats every simple rule and every learned model on real data. The gaps are in the ranges (too wide for regular users, too narrow for irregular ones), in adapting to a lasting change, and in a few edge rules.

## Learned models: the verdict

Owner question: "could a small ML model trained on the user's data do better, or in combination?" Five deterministic models were built in `tools/backtest/src/ml.ts` and scored next to the engine. None ships.

| Model | Real export | Planned regular | Planned irregular | Synthetic, no event | Synthetic, +5 d change |
|---|---|---|---|---|---|
| Engine (today) | **1.42** | 1.19 | **5.4** | **1.98** | 3.81 |
| Ridge regression on her own past cycles (needs 8) | 1.53 | 1.29 | 7.8 | 2.48 | 3.32 |
| Ridge regression trained on 1,200 synthetic users | 1.75 | 1.19 | 6.2 | 2.30 | 2.68 |
| Neural network 6-8-1 trained on the same users | 1.70 | **1.14** | 6.3 | 2.29 | **2.39** |
| Engine and network averaged | 1.52 | **1.14** | 5.9 | 2.07 | 2.75 |
| Engine point, range from her own past errors (conformal) | **1.42** | 1.19 | **5.4** | **1.98** | 3.81 |

Mean absolute error in days. Reading it:

- **A model trained on one user's data loses everywhere.** A user has 12-70 cycles; the ridge model has 6 parameters to fit and overfits (5.67-7.8 d on irregular users). The engine's Bayesian model already "learns from her data", with the right amount of shrinkage.
- **The population-trained models win only where they were trained to.** The synthetic training set contained the +5 d step and split-bleed events, so they learned to follow a step (2.39 vs 3.81 d). On the real export, which they never saw, they are 0.3 d worse. That is in-distribution memorisation, not a better model, and training them on real users would need data the app must never collect.
- **Averaging the engine with the network** costs 0.1 d on the real export and gains 0.05 d on the planned regular user. Not worth an opaque component.
- **The useful "learned" piece is calibration, not the point:** the engine's own past forecast errors for this user, used to size her range (split-conformal). It does not touch the point, so the error is unchanged, but it fixes both range problems. That is item 1.

Regulatory note: a model that retrains itself is an adaptive algorithm, a heavier path under TGA/FDA (a predetermined change control plan for the learning). Conformal calibration is a closed-form rule over her own data, like the existing posterior, and stays a locked algorithm.

## Plan, in order

Each item is one engine change with its own `ENGINE_VERSION` bump, `engine-changelog.md` entry, `requirements.md` row, a re-run of the §4.15 gate (`tools/backtest/acceptance.test.ts`), the golden fixtures (any plan figure that moves gets a D-number note as in D-015), and a re-run of the P8-12 suite with the new figures recorded in D-091. Items marked **owner decision** change a §11.1 conservative default and must not be done without one.

### 1. Ranges sized from her own forecast errors

- **Problem:** findings (a) and (k). 80% ranges hold 95% of real periods for a regular user (5.9 d wide where ~4.5 d would do) and 60% for a very irregular one.
- **Change:** once she has 8 kept cycles with a forecast before them, compute her absolute one-step errors over the last 12 (cycles the engine kept only: a skipped log or a pregnancy is not forecast error), and use their conformal 80% and 95% quantiles.
  - **1a (no owner decision):** the range is the wider of the model's and the conformal one. Fixes the irregular user (60% to 70% held, 13.6 to 15.8 d wide) and the user whose cycles just changed (synthetic +5 d step: 75% to 88% held, 9.3 to 12.6 d wide); leaves regular users as they are.
  - **1b (owner decision):** use the conformal range in both directions. Real export: 95% to 90% held, 5.9 to 5.2 d wide. A narrower range for regular users is a loosening, hence the decision.
- **Limit:** with 8-12 past errors the conformal quantile is coarse, so on 16-cycle synthetic users it does not narrow (90% to 91% held); it narrows only on long histories like the real export (64 cycles). Narrowing is therefore a benefit for long-time users only.
- **Where:** `engine/predict.ts` (after `predictiveInterval`), a new pure helper `calibratedInterval(history, settings)`; constants `CONFORMAL_MIN_CYCLES = 8`, `CONFORMAL_WINDOW = 12` in `params.ts`.
- **Tests that flip:** `tools/backtest/scenarios.test.ts` "ranges cover at least nominal" (tighten to ±7 points of 80%), `naturalCyclesBacktest.test.ts` coverage thresholds; new property: the calibrated range always contains the point and the 95% contains the 80%.
- **Confidence grade:** keep D-020 thresholds on the final half-width so a calibrated narrow range can reach "high" only with 6+ cycles.

### 2. Per-user recency weight

- **Problem:** finding (d). λ = 1 (D-021) follows a lasting change slowly: 3.81 d vs 1.98 d without one.
- **Change:** with 6+ kept cycles, pick λ from {0.8, 0.9, 0.92, 1} and the prior strength κ₀ from {0.5, 1, 2} by her own leave-future-out error (each cycle forecast from the cycles before it only); λ = 1 below 6 cycles. This is what D-021 wanted from 0.92 but per user, so the 15% gate is met where it matters and not paid where it does not.
- **Evidence:** step change 3.81 to 3.13 d (18%, above the §4.15 15% bar); no-event and real export unchanged (1.98 vs 2.02, 1.42 vs 1.42).
- **Owner decision:** yes, it replaces the §11.1 recency default. Recommended.
- **Where:** `engine/cycleLength.ts` (`selectRecency(lengths)`), `predict.ts`; `params.ts` grids.
- **Tests:** the λ acceptance test in `acceptance.test.ts` is rewritten for per-user selection; `scenarios.test.ts` "per-user lambda does better" becomes the engine's own row.

### 3. Softer warm-up after a pregnancy loss (owner decision)

- **Problem:** finding (c). After a marked loss the engine forecasts from the population prior only for three cycles, ignoring years of her own cycles. Real export: 1.52 vs 1.42 d.
- **Change:** after a loss (not a birth, not stopping contraception), cycles from before the pregnancy count at weight 0.5 during the warm-up instead of 0; confidence stays capped at low.
- **Risk:** on synthetic users the range then held only 53% around the loss (70% today). Do this only together with item 1a, which widens a range that has been wrong lately, and re-measure; ship only if coverage around the loss stays at or above 70%.
- **Where:** `engine/lifestate.ts` `cycleWeight` (postpartum with `after: 'loss'` needs to reach the engine: today the outcome lives only in the app's `life_state` detail, D-053).

### 4. A cycle once kept is not dropped by a later one

- **Problem:** finding (e). The long-cycle limit is median + 3 MAD over all kept cycles, so logging a period one day later can tighten the limit and drop two older 34-day cycles, moving the next forecast earlier.
- **Change:** compute each cycle's long-cycle test from the cycles before it plus itself (as of when it closed), not from the whole history; the user's exclude and confirm still override.
- **Evidence to collect:** re-run the fast-check property in `scenarios.test.ts` without its precondition; it must pass, and the §4.15 gate and real export must not get worse.
- **Owner decision:** no (no clinical default changes), but it is an engine rule change.

### 5. Ask about a short "cycle" instead of averaging it

- **Problem:** finding (f). A mid-cycle bleed logged as a period leaves a 15-19 d cycle that counts as valid (synthetic: 2.76 vs 1.98 d two cycles later, range 12 vs 7 d).
- **Change (app, not engine):** when a newly closed cycle is under 21 d and at least 7 d shorter than her median, show the existing day-detail actions ("not a period", "mark as spotting") as a one-time question on Today. No automatic exclusion: a real short cycle must stay.
- **Where:** `features/today`, copy in `copy/en-AU.json`; Maestro flow for the prompt.

### 6. Small fixes

- Add `post_pregnancy` to the engine's `DailyLog.flowKind` type (finding i); remove the cast in `scenarios.test.ts`. Type-only, no version bump.
- Late period (finding g): the Today screen already says "late". If a dated range is wanted after the forecast passes, show the conditional range ("given it has not started by today"), computed from the same posterior truncated at today. UI decision first.

### Not doing

- **Next period from a confirmed ovulation plus her luteal length** (finding b): 40% better on synthetic users with clean LH tests, but worse on the real export (1.52-1.63 vs 1.42-1.52 d at days 14 and 21). Revisit with more real exports that carry LH tests.
- **AR(1) on cycle lengths** (finding j): no gain (1.45 vs 1.42 d).
- **Any learned point model**, per user or population: see the verdict above.
- **A stronger or weaker luteal prior** (finding h): it is a §11.1 default backed by Bull 2019; one five-cycle example is not evidence.

## Order and gates

1. Item 6 type fix (minutes).
2. Item 1a with its tests, then item 2. Re-run the whole P8-12 suite and the §4.15 gate after each; record the before/after table in D-091's successor decision.
3. Owner decisions on 1b, 2 and 3, presented with the measured tables from step 2.
4. Item 4, then item 5 (app).

Done means: engine version bumped per item, changelog and requirements rows written, golden fixtures pass or have a documented D-note, P8-12 suite green with updated thresholds, real-export backtest re-run locally and its aggregates recorded.
