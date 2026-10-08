// Student-t and normal distribution helpers. No dependencies, deterministic.

/** log Gamma, Lanczos approximation (g = 7, n = 9), accurate to about 1e-15 for x > 0. */
function lnGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  const xm = x - 1;
  let a = c[0] as number;
  const t = xm + 7.5;
  for (let i = 1; i < 9; i++) a += (c[i] as number) / (xm + i);
  return 0.5 * Math.log(2 * Math.PI) + (xm + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for the incomplete beta function (modified Lentz). */
function betacf(a: number, b: number, x: number): number {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a, b). */
function betainc(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Student-t CDF for real nu > 0. */
export function studentTCdf(t: number, nu: number): number {
  const x = nu / (nu + t * t);
  const tail = 0.5 * betainc(nu / 2, 0.5, x);
  return t > 0 ? 1 - tail : tail;
}

/** Quantile of Student-t with real degrees of freedom nu > 0, p in (0, 1). Matches scipy.stats.t.ppf to about 1e-10. */
export function studentTQuantile(p: number, nu: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError(`p must be in (0,1), got ${p}`);
  if (!(nu > 0)) throw new RangeError(`nu must be > 0, got ${nu}`);
  if (p === 0.5) return 0;
  if (p < 0.5) return -studentTQuantile(1 - p, nu);
  // bracket then bisect: the CDF is monotone, bisection is deterministic and never diverges
  let lo = 0;
  let hi = 1;
  while (studentTCdf(hi, nu) < p) { lo = hi; hi *= 2; if (hi > 1e12) break; }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, nu) < p) lo = mid; else hi = mid;
    if (hi - lo < 1e-13 * Math.max(1, hi)) break;
  }
  return (lo + hi) / 2;
}

/** Standard normal CDF via erfc (W. J. Cody rational approximation, ~1e-15). */
export function normalCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

function erfc(x: number): number {
  // Numerical Recipes erfccheb coefficients (Chebyshev), precision ~1.2e-16
  const cof = [
    -1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2, -9.561514786808631e-3,
    -9.46595344482036e-4, 3.66839497852761e-4, 4.2523324806907e-5, -2.0278578112534e-5,
    -1.624290004647e-6, 1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8,
    6.529054439e-9, 5.059343495e-9, -9.91364156e-10, -2.27365122e-10,
    9.6467911e-11, 2.394038e-12, -6.886027e-12, 8.94487e-13,
    3.13092e-13, -1.12708e-13, 3.81e-16, 7.106e-15,
    -1.523e-15, -9.4e-17, 1.21e-16, -2.8e-17,
  ];
  const z = Math.abs(x);
  const t = 2 / (2 + z);
  const ty = 4 * t - 2;
  let d = 0;
  let dd = 0;
  for (let j = cof.length - 1; j > 0; j--) {
    const tmp = d;
    d = ty * d - dd + (cof[j] as number);
    dd = tmp;
  }
  const r = t * Math.exp(-z * z + 0.5 * (cof[0] as number + ty * d) - dd);
  return x >= 0 ? r : 2 - r;
}
