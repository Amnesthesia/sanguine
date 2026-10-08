"""
Sanguine prediction-engine prototype.
Models: (A) naive calendar, (B) weighted (EWMA) average, (C) Normal-Inverse-Gamma Bayesian
with population prior, (D) C + robust (skipped-log) handling.
Synthetic population parameters come from Bull et al. 2019 (npj Digit Med 2:83):
  population mean cycle length 29.3 d, population SD 5.2 d,
  mean per-user SD 2.6 d (SD of that 2.5 d); <1% of cycles > 50 d; 10-90 d accepted.
Sporadic long cycles: Wilcox 2000 (ovulation as late as day 60; 4-6% fertile in 5th week).
"""
import numpy as np
from scipy import stats
rng = np.random.default_rng(20261009)

N_USERS = 4000
N_CYCLES = 14          # history length per user
POP_MEAN, POP_SD = 29.3, 5.2
USER_SD_MEAN, USER_SD_SD = 2.6, 2.5

BETWEEN_SD = 4.5
P_LONG = 0.04
def sample_users(n):
    between_sd = BETWEEN_SD
    mu = rng.normal(POP_MEAN, between_sd, n)
    # per-user SD: lognormal matched to mean 2.6, sd 2.5 (right-skewed, as in Bull Fig 4 CIs)
    s2 = np.log(1 + (USER_SD_SD / USER_SD_MEAN) ** 2)
    sig = rng.lognormal(np.log(USER_SD_MEAN) - s2 / 2, np.sqrt(s2), n)
    sig = np.clip(sig, 0.8, 9.0)
    return mu, sig

def sample_history(mu, sig, n_cycles, p_long=None, p_skip=0.0):
    if p_long is None: p_long = P_LONG
    """Returns observed cycle lengths incl. physiological outliers and (optionally)
    self-tracking artefacts (a skipped period -> two cycles merged)."""
    L = rng.normal(mu, sig, n_cycles)
    # sporadic late ovulation (physiological long cycle)
    long_mask = rng.random(n_cycles) < p_long
    L[long_mask] += rng.uniform(8, 25, long_mask.sum())
    L = np.clip(np.round(L), 15, 90)
    if p_skip > 0:
        out = []
        i = 0
        while i < n_cycles:
            if rng.random() < p_skip and i + 1 < n_cycles:
                out.append(L[i] + L[i + 1]); i += 2      # missed log merges two cycles
            else:
                out.append(L[i]); i += 1
        L = np.array(out)
    return L

# ---------------- models ----------------
def model_naive(hist):
    """Last observed cycle (or 28). Fixed +/-2 d window (common app behaviour)."""
    point = hist[-1] if len(hist) else 28.0
    return point, (point - 2, point + 2), (point - 4, point + 4)

def model_ewma(hist, k=6, decay=0.75):
    """Recency-weighted mean of last k cycles; interval from weighted SD, floor 2.0 d."""
    if len(hist) == 0:
        p = POP_MEAN; sd = POP_SD
    else:
        h = hist[-k:]
        w = decay ** np.arange(len(h))[::-1]
        p = np.sum(w * h) / w.sum()
        if len(h) >= 2:
            sd = np.sqrt(np.sum(w * (h - p) ** 2) / w.sum())
            sd = max(sd, 2.0)
        else:
            sd = 4.0
    z80, z95 = 1.2816, 1.96
    return p, (p - z80 * sd, p + z80 * sd), (p - z95 * sd, p + z95 * sd)

def nig_posterior(hist, m0=POP_MEAN, k0=0.5, a0=2.5, b0=None):
    """Normal-Inverse-Gamma conjugate update. Prior ~ worth k0 cycles for the mean,
    2*a0 pseudo-observations for the variance centred on USER_SD_MEAN^2."""
    if b0 is None:
        b0 = a0 * USER_SD_MEAN ** 2
    n = len(hist)
    if n == 0:
        return m0, k0, a0, b0
    xbar = hist.mean()
    ss = ((hist - xbar) ** 2).sum()
    kn = k0 + n
    mn = (k0 * m0 + n * xbar) / kn
    an = a0 + n / 2
    bn = b0 + 0.5 * ss + (k0 * n * (xbar - m0) ** 2) / (2 * kn)
    return mn, kn, an, bn

def model_bayes(hist, **kw):
    mn, kn, an, bn = nig_posterior(hist, **kw)
    nu = 2 * an
    scale = np.sqrt(bn * (kn + 1) / (an * kn))
    t80 = stats.t.ppf(0.9, nu); t95 = stats.t.ppf(0.975, nu)
    return mn, (mn - t80 * scale, mn + t80 * scale), (mn - t95 * scale, mn + t95 * scale)

def model_bayes_robust(hist, **kw):
    """Down-weight implausible long cycles (likely skipped log or sporadic late ovulation):
    a cycle > median + max(7, 3*MAD) is excluded from the mean/variance update but still
    counted toward 'irregularity'. With <3 cycles no exclusion (can't tell)."""
    if len(hist) >= 3:
        med = np.median(hist)
        mad = 1.4826 * np.median(np.abs(hist - med))
        thr = med + max(7.0, 3 * mad)
        core = hist[hist <= thr]
        if len(core) >= 2:
            hist = core
    return model_bayes(hist, **kw)

MODELS = {"A naive": model_naive, "B ewma": model_ewma,
          "C bayes": model_bayes, "D bayes+robust": model_bayes_robust}

def evaluate(p_skip=0.0, label=""):
    mu, sig = sample_users(N_USERS)
    rows = {m: {h: [] for h in [0, 1, 2, 3, 5, 8, 12]} for m in MODELS}
    for i in range(N_USERS):
        L = sample_history(mu[i], sig[i], N_CYCLES, p_skip=p_skip)
        truth = sample_history(mu[i], sig[i], 1, p_skip=0.0)[0]   # target is always a real cycle
        for h in rows["A naive"]:
            if h > len(L):
                continue
            hist = L[:h]
            for m, f in MODELS.items():
                p, i80, i95 = f(hist)
                rows[m][h].append((abs(p - truth), i80[0] <= truth <= i80[1],
                                   i95[0] <= truth <= i95[1], i80[1] - i80[0]))
    print(f"\n=== {label} (p_skip={p_skip}) ===")
    print(f"{'model':16s} {'hist':>4s} {'MAE':>6s} {'cov80':>6s} {'cov95':>6s} {'w80':>6s}")
    for m in MODELS:
        for h, r in rows[m].items():
            r = np.array(r, dtype=float)
            print(f"{m:16s} {h:4d} {r[:,0].mean():6.2f} {r[:,1].mean():6.2f} "
                  f"{r[:,2].mean():6.2f} {r[:,3].mean():6.1f}")

evaluate(0.0, "clean histories, wide population")
evaluate(0.08, "8% of periods not logged (merged cycles), wide population")
BETWEEN_SD, P_LONG = 3.6, 0.03
evaluate(0.0, "clean histories, tight population (closer to Bull 2019)")
evaluate(0.08, "8% skipped logs, tight population")

# Sanity: population of synthetic cycles vs Bull 2019 reported stats
mu, sig = sample_users(20000)
allL = np.concatenate([sample_history(mu[i], sig[i], 8) for i in range(20000)])
print("\nSynthetic population check: mean %.1f sd %.1f  pct 25-30: %.0f%%  pct 21-35: %.0f%%  pct>50: %.2f%%"
      % (allL.mean(), allL.std(), 100*np.mean((allL>=25)&(allL<=30)),
         100*np.mean((allL>=21)&(allL<=35)), 100*np.mean(allL>50)))