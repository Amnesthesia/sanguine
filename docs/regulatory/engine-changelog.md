# Engine change log

Every change to an engine rule or parameter gets an entry: what changed, why, the source, and the backtest or fixture result before and after. Engine parameters ship only in versioned builds, never over the air (PLAN.md §6.6).

| Version | Date | Change | Reason and source | Fixture / backtest result |
| --- | --- | --- | --- | --- |
| 0.1.0 | 2026-10-09 | Initial parameters and types (`params.ts`, `types.ts`, `studentTQuantile`) | PLAN.md §3, §4.3, §4.5, §4.6 | Fixtures A–I written, pending implementation (P1); `studentTQuantile` matches SciPy to 1e-8 |
| 0.1.1 | 2026-10-09 | `fitCycleLength`, `predictiveInterval`, `cyclePrior` (age bands; population prior under 18) | PLAN §4.3 | Posteriors for fixtures A–E and F-luteal match to 0.05 d; fixture predict tests still pending |
| 0.1.2 | 2026-10-09 | `classifyCycles`: bounds 15–90, MAD exclusion (median + max(7, 3·1.4826·MAD); floor 14 for known irregular), user exclusion, confirm_long, life-state overlap | PLAN §4.4, §4.9 | Fixture B (56 → suspect_skip, threshold 35.5) and D (threshold 58, none excluded) |
