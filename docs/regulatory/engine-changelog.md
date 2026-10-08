# Engine change log

Every change to an engine rule or parameter gets an entry: what changed, why, the source, and the backtest or fixture result before and after. Engine parameters ship only in versioned builds, never over the air (PLAN.md §6.6).

| Version | Date | Change | Reason and source | Fixture / backtest result |
| --- | --- | --- | --- | --- |
| 0.1.0 | 2026-10-09 | Initial parameters and types (`params.ts`, `types.ts`, `studentTQuantile`) | PLAN.md §3, §4.3, §4.5, §4.6 | Fixtures A–I written, pending implementation (P1); `studentTQuantile` matches SciPy to 1e-8 |
| 0.1.1 | 2026-10-09 | `fitCycleLength`, `predictiveInterval`, `cyclePrior` (age bands; population prior under 18) | PLAN §4.3 | Posteriors for fixtures A–E and F-luteal match to 0.05 d; fixture predict tests still pending |
| 0.1.2 | 2026-10-09 | `classifyCycles`: bounds 15–90, MAD exclusion (median + max(7, 3·1.4826·MAD); floor 14 for known irregular), user exclusion, confirm_long, life-state overlap | PLAN §4.4, §4.9 | Fixture B (56 → suspect_skip, threshold 35.5) and D (threshold 58, none excluded) |
| 0.1.3 | 2026-10-09 | Luteal model (`fitLuteal`, `lutealLengths`), calendar ovulation estimate, confidence grade, 80% ovulation interval, `fertileDayProbabilities` | PLAN §4.5, §4.8; Wilcox 1995 | Fixture A fertile table reproduced to 0.01; F luteal 12.23/ν13/2.22 |
| 0.1.4 | 2026-10-09 | BBT three-over-six (+0.2 °C), CUSUM secondary (slack 0.05 °C, threshold 0.5 °C-days, SD 2.5/low on >2 d disagreement), exclusions (disturbed, 35.0–37.5, ±60 min of median, 2-day gap, 50% coverage), wearable series (0.3 °C, SD 2.0), provenance SD factor (untimed 1.3, imported 1.5) | PLAN §4.6, §4.7 | Unit tests in `bbt.test.ts`; fixture H pending combine (P1-5) |
| 0.1.5 | 2026-10-09 | LH, mucus, cervix detectors; `combineOvulation` (inverse-variance, one temperature series, temporal gate −1/+4 d, >3 d disagreement → most precise signal, cervix weight ≤ 25% of others, confidence cap) | PLAN §4.6–4.8 | Unit tests; fixture H pending predict (P1-9) |
