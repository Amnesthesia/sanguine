// Renders brand assets from Dancing Script 700 (PLAN.md §9.9). Run: pnpm --filter @sanguine/brand build
import opentype from 'opentype.js';
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WINE = '#6A1220';
export const WINE_EDGE = '#4E0C17';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'apps', 'mobile', 'assets', 'brand');

const buf = readFileSync(require.resolve('@expo-google-fonts/dancing-script/700Bold/DancingScript_700Bold.ttf'));
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);

const png = (svg: string, width?: number) =>
  new Resvg(svg, width ? { fitTo: { mode: 'width', value: width } } : {}).render().asPng();

// opentype.js toPathData emits NaN for some multi-glyph paths, so serialise ourselves.
function pathData(cmds: opentype.PathCommand[]): string {
  const n = (v: number) => +v.toFixed(2);
  return cmds.map((c) => {
    if (c.type === 'M' || c.type === 'L') return `${c.type}${n(c.x)} ${n(c.y)}`;
    if (c.type === 'Q') return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
    if (c.type === 'C') return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
    return 'Z';
  }).join('');
}

/** Wordmark: "Sanguine", white on transparent. */
export function wordmarkSvg(): { svg: string; w: number; h: number } {
  const p = font.getPath('Sanguine', 0, 0, 200);
  const b = p.getBoundingBox();
  const pad = 12;
  const w = Math.ceil(b.x2 - b.x1 + pad * 2);
  const h = Math.ceil(b.y2 - b.y1 + pad * 2);
  p.commands.forEach((c) => {
    for (const k of ['x', 'x1', 'x2'] as const) if (typeof (c as any)[k] === 'number') (c as any)[k] += pad - b.x1;
    for (const k of ['y', 'y1', 'y2'] as const) if (typeof (c as any)[k] === 'number') (c as any)[k] += pad - b.y1;
  });
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${pathData(p.commands)}" fill="#FFFFFF"/></svg>`, w, h };
}

/** Teardrop with its tip at (0,0), pointing along +x, length L, round end radius r. */
function drop(L: number, r: number): string {
  const a = (L - 2 * r) * 0.45;
  return `M0 0 C${a} ${-r * 0.12} ${L - 2.1 * r} ${-r} ${L - r} ${-r} A${r} ${r} 0 0 1 ${L - r} ${r} C${L - 2.1 * r} ${r} ${a} ${r * 0.12} 0 0Z`;
}

/** Glyph = the S from the wordmark whose lower-left terminal ends in a drop. Returns an SVG fragment on a 1024 canvas. */
export function glyphGroup(box: number, shiftX = -0.03 * 1024): string {
  const raw = font.charToGlyph('S').getPath(0, 0, 1000); // y-down units, S height ~807
  const b = raw.getBoundingBox();
  const sH = b.y2 - b.y1;
  const dropL = 0.13 * sH, dropR = dropL * 0.38; // drop is 12% of glyph height
  // stroke terminal of the lower bowl: centre (≈150,-229), heading right and slightly up
  const tx = 150, ty = -230, ang = -10; // degrees
  const sPath = raw.toPathData(2);
  const combinedW = Math.max(b.x2 - b.x1, 1) , combinedH = sH;
  const s = box / Math.max(combinedW, combinedH);
  const cx = 512 + shiftX - ((b.x1 + b.x2) / 2) * s;
  const cy = 512 - ((b.y1 + b.y2) / 2) * s;
  return `<g transform="translate(${cx} ${cy}) scale(${s})" fill="#FFFFFF"><path d="${sPath}"/><path transform="translate(${tx} ${ty}) rotate(${ang})" d="${drop(dropL, dropR)}"/></g>`;
}

const vignette = `<defs><radialGradient id="v" cx="50%" cy="35%" r="75%"><stop offset="0.6" stop-color="${WINE}"/><stop offset="1" stop-color="${WINE_EDGE}"/></radialGradient></defs>`;
const svg1024 = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${inner}</svg>`;

export function build(): void {
  mkdirSync(out, { recursive: true });
  const wm = wordmarkSvg();
  writeFileSync(join(out, 'wordmark.svg'), wm.svg);
  writeFileSync(join(out, 'splash-wordmark.png'), png(wm.svg, 660)); // 3x of imageWidth 220
  const glyph = glyphGroup(0.6 * 1024);
  writeFileSync(join(out, 'glyph.svg'), svg1024(glyph));
  writeFileSync(join(out, 'icon.png'), png(svg1024(`${vignette}<rect width="1024" height="1024" fill="url(#v)"/>${glyph}`)));
  // Android adaptive: 108dp canvas, 66dp safe zone -> glyph box inside ~61% of canvas minus 20% padding
  const adaptive = glyphGroup(0.6 * 1024 * 0.8, -0.03 * 1024 * 0.8);
  writeFileSync(join(out, 'android-icon-foreground.png'), png(svg1024(adaptive)));
  writeFileSync(join(out, 'android-icon-monochrome.png'), png(svg1024(adaptive)));
  writeFileSync(join(out, 'android-icon-background.png'), png(svg1024(`<rect width="1024" height="1024" fill="${WINE}"/>`)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) build();
