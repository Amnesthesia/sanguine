// Usage: pnpm --filter @sanguine/backtest backtest <synthetic|lambda|csv FILE> [--users N] [--seed S]
import { runCsv } from './csv';
import { evaluate, format, stepScenario } from './evaluate';
import { bayes, engineModel, ewma, naive } from './models';
import { TIGHT, WIDE } from './synth';

const args = process.argv.slice(2);
const flag = (name: string, d: number) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : d; };
const users = flag('users', 4000);
const seed = flag('seed', 20261009);
const cmd = args[0] ?? 'synthetic';

if (cmd === 'synthetic') {
  const models = { 'A naive': naive, 'B ewma': ewma, 'C bayes': bayes, 'D engine (λ=1)': engineModel(1), 'D engine (λ=.92)': engineModel(0.92) };
  console.log(format('clean histories, wide population', evaluate(models, WIDE, 0, users, seed)));
  console.log(format('8% of periods not logged, wide population', evaluate(models, WIDE, 0.08, users, seed + 1)));
  console.log(format('clean histories, tight population', evaluate(models, TIGHT, 0, users, seed + 2)));
  console.log(format('8% skipped logs, tight population', evaluate(models, TIGHT, 0.08, users, seed + 3)));
} else if (cmd === 'lambda') {
  const a = engineModel(1);
  const b = engineModel(0.92);
  const shift = flag('shift', 7);
  const stepA = stepScenario(a, WIDE, users, seed, shift);
  const stepB = stepScenario(b, WIDE, users, seed, shift);
  const cleanA = stepScenario(a, WIDE, users, seed + 7, null);
  const cleanB = stepScenario(b, WIDE, users, seed + 7, null);
  console.log(`step change +${shift} d after cycle 8, MAE over cycles 9-14: λ=1 ${stepA.toFixed(3)}  λ=0.92 ${stepB.toFixed(3)}  gain ${(100 * (1 - stepB / stepA)).toFixed(1)}%`);
  console.log(`clean histories, MAE over cycles 9-14:               λ=1 ${cleanA.toFixed(3)}  λ=0.92 ${cleanB.toFixed(3)}  change ${(100 * (cleanB / cleanA - 1)).toFixed(1)}%`);
} else if (cmd === 'csv') {
  console.log(JSON.stringify(runCsv(args[1] as string, flag('lambda', 0.92)), null, 2));
} else {
  console.error('usage: backtest <synthetic|lambda|csv FILE>');
  process.exit(1);
}
