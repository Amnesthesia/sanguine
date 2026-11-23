// Renders the splash transition prototype (index.html) to PNG frames and one contact sheet per option, into frames/.
// Run from the repo root: node docs/design/splash-transition/render.mjs
// Needs Playwright with Chromium: either resolvable as 'playwright', or in the npx cache (npx playwright install chromium).
import { execSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const out = join(here, 'frames');

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch {}
  const hit = execSync('find ~/.npm/_npx -maxdepth 4 -path "*node_modules/playwright/package.json" 2>/dev/null | head -1').toString().trim();
  if (!hit) throw new Error('Playwright not found: run `npx playwright install chromium` first');
  return require(dirname(hit));
}
const { chromium } = loadPlaywright();

// A static server over the repo, so the page can load data.js, the lock-up PNGs and the app screenshots.
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };
const server = createServer((req, res) => {
  const p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !existsSync(p)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' });
  createReadStream(p).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}/${relative(root, here)}/index.html`;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
await page.goto(`${base}?t=0`);
const tl = await page.evaluate(() => window.TIMELINE);

// Nine moments per option: the hold, the logo becoming the moon (4), the zoom (3), the app.
const moments = (v) => {
  const { START, VARIANTS } = tl;
  const { len, zoomAt } = VARIANTS[v];
  return [
    ['1-hold', START - 0.3],
    ['2-change-25', START + len * 0.25], ['3-change-50', START + len * 0.5], ['4-change-75', START + len * 0.75], ['5-moon', zoomAt - 0.05],
    ['6-zoom-25', zoomAt + 0.85 * 0.25], ['7-zoom-50', zoomAt + 0.85 * 0.5], ['8-zoom-75', zoomAt + 0.85 * 0.75], ['9-app', zoomAt + 0.85 + 0.1],
  ];
};
const shots = [];
for (const v of Object.keys(tl.VARIANTS)) {
  for (const scheme of ['light', 'dark']) {
    for (const [name, t] of moments(v)) {
      if (scheme === 'dark' && !['1-hold', '3-change-50', '5-moon', '7-zoom-50'].includes(name)) continue;
      const file = `${v}-${scheme}-${name}.png`;
      await page.goto(`${base}?only=${v}&scheme=${scheme}&t=${t.toFixed(3)}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => [...document.images].every((i) => i.complete));
      await page.screenshot({ path: join(out, file) });
      shots.push(file);
    }
  }
}

// Contact sheets: one row per option, light, every moment.
const sheet = await browser.newPage({ viewport: { width: 9 * 200 + 10 * 12, height: 3 * (434 + 40) + 20 }, deviceScaleFactor: 1 });
const frameUrl = (f) => `${base.replace('index.html', 'frames/')}${f}`;
const rows = Object.keys(tl.VARIANTS).map((v) => `<h2>${tl.VARIANTS[v].title}</h2><div class="row">${moments(v).map(([n]) => `<figure><img src="${frameUrl(`${v}-light-${n}.png`)}"><figcaption>${n.slice(2)}</figcaption></figure>`).join('')}</div>`).join('');
await sheet.setContent(`<style>body{margin:0;padding:10px 12px;font:13px -apple-system,sans-serif;background:#fff}h2{font-size:14px;margin:4px 0}
.row{display:flex;gap:12px}figure{margin:0}img{width:200px;height:434px;display:block;border-radius:14px;border:1px solid #ddd}figcaption{color:#6b6165;text-align:center;margin-top:2px}</style>${rows}`);
await sheet.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
await sheet.screenshot({ path: join(out, 'contact-sheet-light.png'), fullPage: true });

await browser.close();
server.close();
console.log(`${readdirSync(out).length} files in ${relative(root, out)}`);
