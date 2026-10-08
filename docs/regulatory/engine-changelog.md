# Engine change log

Every change to an engine rule or parameter gets an entry: what changed, why, the source, and the backtest or fixture result before and after. Engine parameters ship only in versioned builds, never over the air (PLAN.md §6.6).

| Version | Date | Change | Reason and source | Fixture / backtest result |
| --- | --- | --- | --- | --- |
| 0.1.0 | 2026-10-09 | Initial parameters and types (`params.ts`, `types.ts`, `studentTQuantile`) | PLAN.md §3, §4.3, §4.5, §4.6 | Fixtures A–I written, pending implementation (P1); `studentTQuantile` matches SciPy to 1e-8 |
