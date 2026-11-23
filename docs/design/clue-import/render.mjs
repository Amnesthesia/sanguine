// Rewrites frames/*.html from frames.mjs, then renders each to frames/<name>.png at 2x (880 px wide = 440 pt).
// Run from the repo root: node docs/design/clue-import/render.mjs
// Needs Playwright with Chromium: either resolvable as 'playwright', or in the npx cache (npx playwright install chromium).
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { frames } from './frames.mjs';

const out = join(dirname(fileURLToPath(import.meta.url)), 'frames');

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch {}
  const hit = execSync('find ~/.npm/_npx -maxdepth 4 -path "*node_modules/playwright/package.json" 2>/dev/null | head -1').toString().trim();
  if (!hit) throw new Error('Playwright not found: run `npx playwright install chromium` first');
  return require(dirname(hit));
}
const { chromium } = loadPlaywright();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 2 });
for (const [name] of frames) {
  // the frames load nothing, so a file:// URL is enough
  await page.goto(pathToFileURL(join(out, `${name}.html`)).href);
  await page.locator('.phone').screenshot({ path: join(out, `${name}.png`) });
}
await browser.close();
console.log(`${frames.length} PNGs in ${out}`);
