// EAS Update on top of app.json (D-069, D-071). Over-the-air updates carry JavaScript fixes only. The runtime version is a
// hash of the app version, the lockfile (every native dependency), app.json (plugins and native config) and the prediction
// engine's sources: any engine edit or dependency change yields a runtime version no installed build accepts, so those ship
// only as store builds (PLAN.md §6.6, RK-13). It is computed from tracked files only, so a developer machine and EAS get the
// same value; the fingerprint policy also hashed local native build output in node_modules and the two never matched.
// Every build, production included, checks for an update on launch (owner's decision, D-069).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const ROOT = join(__dirname, '..', '..');
const files = (dir: string): string[] =>
  readdirSync(dir).sort().flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));

/** Runtime version: `<version>-<12 hex>`; exported for the CI test. */
export function runtimeVersionFor(version: string): string {
  const h = createHash('sha256').update(version);
  const inputs = [join(ROOT, 'pnpm-lock.yaml'), join(__dirname, 'app.json'), ...files(join(ROOT, 'packages', 'engine', 'src'))];
  for (const f of inputs) h.update(f.slice(ROOT.length)).update(readFileSync(f));
  return `${version}-${h.digest('hex').slice(0, 12)}`;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = (config.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) throw new Error('app.json extra.eas.projectId is missing');
  return {
    ...(config as ExpoConfig),
    runtimeVersion: runtimeVersionFor(config.version ?? '0.0.0'),
    updates: {
      url: `https://u.expo.dev/${projectId}`,
      enabled: true,
      checkAutomatically: 'ON_LOAD',
      // never block launch on the network: a downloaded update applies on the next cold start
      fallbackToCacheTimeout: 0,
    },
  };
};
