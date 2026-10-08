// Seeded RNG for reproducible backtests (mulberry32 + Box-Muller). Tooling only; the engine never uses randomness.
export class Rng {
  private s: number;
  private spare: number | null = null;
  constructor(seed: number) { this.s = seed >>> 0; }
  random(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  normal(mean = 0, sd = 1): number {
    if (this.spare !== null) { const v = this.spare; this.spare = null; return mean + sd * v; }
    let u = 0;
    while (u === 0) u = this.random();
    const v = this.random();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(2 * Math.PI * v);
    return mean + sd * r * Math.cos(2 * Math.PI * v);
  }
  lognormal(mu: number, sigma: number): number { return Math.exp(this.normal(mu, sigma)); }
  uniform(a: number, b: number): number { return a + (b - a) * this.random(); }
}
