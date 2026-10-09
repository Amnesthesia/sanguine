// EAS Update on top of app.json (D-069, D-071). Over-the-air updates carry JavaScript fixes only. The runtime version is a
// hash of the app version, the resolved versions of the app's runtime dependency closure from the lockfile (every native
// dependency; the website, tools and dev dependencies are left out, D-080), app.json (plugins and native config) and the prediction
// engine's sources, the local native module (`modules/`) and config plugins (`plugins/`): any engine edit or dependency change yields a runtime version no installed build accepts, so those ship
// only as store builds (PLAN.md §6.6, RK-13). It is computed from tracked files only, so a developer machine and EAS get the
// same value; the fingerprint policy also hashed local native build output in node_modules and the two never matched.
// Every build, production included, checks for an update on launch (owner's decision, D-069).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { parse } from 'yaml';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const ROOT = join(__dirname, '..', '..');
// dot-files (.DS_Store) and local build output differ between a developer machine and EAS, so they are not hashed
const SKIP = new Set(['build', 'node_modules', '.cxx']);
const files = (dir: string): string[] =>
  readdirSync(dir).sort().filter((n) => !n.startsWith('.') && !SKIP.has(n))
    .flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));

type Deps = Record<string, string | { version: string }>;
interface Lock { importers: Record<string, { dependencies?: Deps; optionalDependencies?: Deps }>; snapshots?: Record<string, { dependencies?: Deps; optionalDependencies?: Deps }> }

/** `name@version` of every package the app ships, from pnpm-lock.yaml: apps/mobile's dependencies (not devDependencies), through
 *  workspace links, transitively. A website or tools change no longer changes the app's runtime version (D-080). Exported for CI. */
export function mobileDependencies(): string[] {
  const lock = parse(readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8')) as Lock;
  const seen = new Set<string>();
  const importers = new Set<string>();
  const each = (deps: { dependencies?: Deps; optionalDependencies?: Deps } | undefined, from: string) => {
    for (const [name, d] of Object.entries({ ...deps?.dependencies, ...deps?.optionalDependencies })) visit(name, typeof d === 'string' ? d : d.version, from);
  };
  const importer = (path: string) => { if (!importers.has(path)) { importers.add(path); each(lock.importers[path], path); } };
  function visit(name: string, version: string, from: string) {
    if (version.startsWith('link:')) { importer(posix.normalize(posix.join(from, version.slice(5)))); return; }
    const key = `${name}@${version}`;
    if (seen.has(key)) return;
    seen.add(key);
    const snapshot = lock.snapshots?.[key];
    // a missing entry (alias, override, new lockfile format) would silently drop a subtree from the hash: fail instead
    if (!snapshot) throw new Error(`runtime version: ${key} not found in pnpm-lock.yaml snapshots`);
    each(snapshot, from);
  }
  importer('apps/mobile');
  return [...seen].sort();
}

/** Runtime version: `<version>-<12 hex>`; exported for the CI test. */
export function runtimeVersionFor(version: string): string {
  const h = createHash('sha256').update(version).update(mobileDependencies().join('\n'));
  // app.json, the local native module and config plugins (native code that is not in the lockfile), and the engine
  const inputs = [join(__dirname, 'app.json'), ...files(join(__dirname, 'modules')), ...files(join(__dirname, 'plugins')), ...files(join(ROOT, 'packages', 'engine', 'src'))];
  for (const f of inputs) h.update(f.slice(ROOT.length).replaceAll('\\', '/')).update(readFileSync(f));
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
