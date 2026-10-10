// Clinical and statistical parameters. Every value traces to PLAN.md §3 / §4.3 / §4.5 / §11.1.
// A change here is an engine change: update docs/regulatory/engine-changelog.md and requirements.md.
import type { NigPrior } from './types';

export const ENGINE_VERSION = '0.2.1';

/** Cycle-length prior (§4.3): population mean 29.3 d by age band, per-person SD 2.6 d. */
export const CYCLE_PRIOR_KAPPA0 = 0.5;
export const CYCLE_PRIOR_ALPHA0 = 2.5;
export const CYCLE_PRIOR_SD = 2.6;
export const CYCLE_PRIOR_BETA0 = CYCLE_PRIOR_ALPHA0 * CYCLE_PRIOR_SD ** 2; // 16.9
export const POPULATION_MEAN = 29.3;
/** Age band upper bound (inclusive) -> prior mean (Bull 2019 Table 2). */
export const AGE_BAND_MEANS: Array<{ maxAge: number; mean: number }> = [
  { maxAge: 24, mean: 30.3 }, { maxAge: 29, mean: 29.9 }, { maxAge: 34, mean: 29.2 },
  { maxAge: 39, mean: 28.2 }, { maxAge: 45, mean: 27.4 },
];
/** Default recency weight. PLAN.md §4.3 proposed 0.92 but the §4.15 acceptance test (tools/backtest/acceptance.test.ts)
 *  measured a gain of ~5% against the required 15%, so the fallback λ = 1 ships (D-021, V-05). */
export const RECENCY_LAMBDA = 1;
export const WINDOW_CYCLES = 12;
/** Per-user recency (D-094, P8-13 item 2): with this many kept cycles, λ and κ0 are chosen per user from these grids by her
 *  own leave-future-out error; RECENCY_LAMBDA and CYCLE_PRIOR_KAPPA0 apply below it. */
export const RECENCY_SELECT_MIN_CYCLES = 6;
export const RECENCY_LAMBDA_GRID = [1, 0.92, 0.9, 0.8];
export const RECENCY_KAPPA0_GRID = [CYCLE_PRIOR_KAPPA0, 1, 2];
/** Ranges from her own forecast errors (D-094, P8-13 item 1): split-conformal over the last CONFORMAL_WINDOW kept cycles,
 *  once CONFORMAL_MIN_ERRORS of them have a forecast from at least CONFORMAL_MIN_HISTORY cycles before them. The range
 *  never gets narrower than +/- CONFORMAL_MIN_HALFWIDTH days, and narrows only when no life state is shaping the model. */
export const CONFORMAL_MIN_ERRORS = 8;
export const CONFORMAL_WINDOW = 12;
export const CONFORMAL_MIN_HISTORY = 3;
export const CONFORMAL_MIN_HALFWIDTH = 1;
export const MIN_VALID_LENGTH = 15;
export const MAX_VALID_LENGTH = 90;

/** Luteal prior (§4.5, §11.1 LUTEAL_PRIOR): 12.4 +/- 2.4 d (Bull 2019), not the 14 d textbook value. */
export const LUTEAL_PRIOR: NigPrior = { m0: 12.4, kappa0: 10, alpha0: 5, beta0: 5 * 2.4 ** 2 };

/** §11.1 LH_OFFSET, MUCUS_SD and signal SDs (§4.6). */
export const LH_OFFSET_DAYS = 1;
export const LH_SD = 1.0;
export const LH_SD_NO_PRIOR_NEGATIVE = 1.5;
export const LH_SD_LONG_RUN = 2.5;
export const MUCUS_SD = 1.5;
export const BBT_SD = 1.5;
export const BBT_CUSUM_DISAGREE_SD = 2.5;
export const WEARABLE_SD = 2.0;
export const CERVIX_SD = 2.5;
export const BBT_MIN_RISE_C = 0.2;
export const WEARABLE_MIN_RISE_C = 0.3;
export const TEMP_TIME_EXCLUSION_MIN = 60;
export const TEMP_MIN_COVERAGE = 0.5;
/** §4.6 temporal gate: a temperature shift is kept only if it falls this far around the LH/mucus estimate. */
export const SHIFT_GATE_BEFORE_DAYS = 1;
export const SHIFT_GATE_AFTER_DAYS = 4;
export const SIGNAL_CONFLICT_DAYS = 3;

/** §4.8: Wilcox window is ovulation - 5 .. ovulation. */
export const FERTILE_WINDOW_DAYS = 5;
/** Confidence thresholds on SD[O] (§4.8). */
export const CONFIDENCE_HIGH_SD = 1.5;
export const CONFIDENCE_MEDIUM_SD = 3;

/** z for the 80% and 95% normal approximations used for the ovulation interval. */
export const Z80 = 1.2815515655446004;
export const Z95 = 1.959963984540054;
