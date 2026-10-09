// CLAUDE.md non-negotiable: no network calls except the optional encrypted backup to the user's own cloud account.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = join(__dirname, '..', '..');
const ALLOWED = ['apps', 'mobile', 'src', 'services', 'cloud'].join(sep);
function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'ios' || name === 'android' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* sources(p);
    else if (/\.(ts|tsx|js)$/.test(name) && !/\.test\./.test(name)) yield p;
  }
}

describe('network calls', () => {
  it('appear only in the cloud backup code', () => {
    const offenders: string[] = [];
    for (const top of ['apps/mobile/src', 'packages']) {
      for (const f of sources(join(root, top))) {
        const rel = relative(root, f);
        const src = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        if (/\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|EventSource\s*\(|navigator\.sendBeacon/.test(src) && !rel.startsWith(ALLOWED)) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
  it('the cloud folder is the only place that names a remote host', () => {
    for (const f of sources(join(root, 'apps/mobile/src'))) {
      const rel = relative(root, f);
      if (rel.startsWith(ALLOWED)) continue;
      expect(readFileSync(f, 'utf8').replace(/\/\/.*$/gm, ''), rel).not.toMatch(/https?:\/\/(?!localhost|127\.0\.0\.1)[a-z0-9.-]+\.(com|net|org|io|app|dev)\b/i);
    }
  });
});
