// Renders brand assets (PLAN.md §9.9, D-042): the horned brush mark, and the Dancing Script 700 wordmark. Run: pnpm --filter @sanguine/brand build
import opentype from 'opentype.js';
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WINE = '#B8324A';
export const WINE_EDGE = '#962439';
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

type Pt = [number, number];

/** Catmull-Rom through the points, sampled `per` times per segment. */
function spline(pts: Pt[], per = 24): Pt[] {
  const out: Pt[] = [];
  const at = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))] as Pt;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts.at(-1) as Pt);
  return out;
}

/** A brush stroke: the centreline widened to `w(t)` and closed as one filled outline. */
function brush(pts: Pt[], w: (t: number) => number): string {
  const c = spline(pts);
  const left: Pt[] = [], right: Pt[] = [];
  c.forEach(([x, y], i) => {
    const [ax, ay] = c[Math.max(0, i - 1)] as Pt, [bx, by] = c[Math.min(c.length - 1, i + 1)] as Pt;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / len, ny = (bx - ax) / len, h = w(i / (c.length - 1)) / 2;
    left.push([x + nx * h, y + ny * h]);
    right.push([x - nx * h, y - ny * h]);
  });
  const n = (v: number) => +v.toFixed(1);
  return `M${[...left, ...right.reverse()].map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`;
}

/** Width that grows from a fine tip to `max` over the first `rise` of the stroke and eases to `end`. */
const taper = (tip: number, max: number, end: number, rise = 0.35) => (t: number) =>
  t < rise ? tip + (max - tip) * Math.sin((t / rise) * Math.PI / 2) : max + (end - max) * ((t - rise) / (1 - rise)) ** 2;
const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [1024 - x, y]);

/** The mark on a 1024 canvas: two pairs of horns cupping a T, over a chevron. */
export function markPaths(): string[] {
  const outer: Pt[] = [[120, 118], [188, 168], [230, 255], [234, 365], [212, 475], [214, 585], [254, 690], [312, 762]];
  const inner: Pt[] = [[300, 340], [280, 420], [276, 500], [298, 580], [356, 638], [420, 662]];
  const hook: Pt[] = [[424, 658], [384, 696], [338, 744]];
  // brush ends finish slightly narrowed, the way a lifted brush does
  const lift = (f: (t: number) => number) => (t: number) => f(t) * (t > 0.92 ? 1 - (t - 0.92) * 4 : 1);
  return [
    brush(outer, lift(taper(4, 46, 40))), brush(mirror(outer), lift(taper(4, 46, 40))),
    brush(inner, lift(taper(4, 42, 36, 0.3))), brush(mirror(inner), lift(taper(4, 42, 36, 0.3))),
    brush(hook, lift(() => 36)), brush(mirror(hook), lift(() => 36)),
    brush([[344, 318], [440, 322], [560, 318], [650, 314], [682, 340]], lift(taper(26, 44, 40, 0.15))), // crossbar
    brush([[344, 312], [362, 340], [388, 358]], taper(22, 30, 16, 0.5)), // left serif
    brush([[512, 336], [510, 470], [512, 634]], (t) => 50 * (1 - t ** 3) + 2), // stem to a point
    brush([[336, 824], [420, 862], [510, 912]], taper(14, 38, 34, 0.3)), // chevron, two strokes meeting in a point
    brush([[490, 912], [592, 854], [682, 800]], lift(taper(34, 38, 30, 0.3))),
  ];
}

/** The mark scaled so its 784-unit extent fills `box`, centred on a 1024 canvas. */
export function glyphGroup(box: number): string {
  const s = box / 790; // the mark spans x 120..904, y 118..906
  const tx = 512 - 512 * s, ty = 512 - 512 * s;
  return `<g transform="translate(${tx} ${ty}) scale(${s})" fill="#FFFFFF">${markPaths().map((d) => `<path d="${d}"/>`).join('')}</g>`;
}

const vignette = `<defs><radialGradient id="v" cx="50%" cy="35%" r="75%"><stop offset="0.6" stop-color="${WINE}"/><stop offset="1" stop-color="${WINE_EDGE}"/></radialGradient></defs>`;
const svg1024 = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${inner}</svg>`;

/** Discreet alternate icon "Notes" (PLAN.md §8.8, P3-6): a white leaf on neutral grey #6B6165, no brand colour. */
export const NOTES_GREY = '#6B6165';
export function leafGroup(box: number): string {
  // leaf on a 1024 canvas: a pointed blade with a midrib cut back to the field colour
  const s = box / 720;
  const tx = 512 - 512 * s, ty = 512 - 512 * s;
  const blade = 'M512 152 C296 300 236 620 512 872 C788 620 728 300 512 152Z';
  const rib = 'M512 212 C500 420 500 640 512 836';
  return `<g transform="translate(${tx} ${ty}) scale(${s}) rotate(-22 512 512)"><path d="${blade}" fill="#FFFFFF"/><path d="${rib}" fill="none" stroke="${NOTES_GREY}" stroke-width="26" stroke-linecap="round"/></g>`;
}

export function build(): void {
  mkdirSync(out, { recursive: true });
  const wm = wordmarkSvg();
  writeFileSync(join(out, 'wordmark.svg'), wm.svg);
  const glyph = glyphGroup(0.66 * 1024);
  writeFileSync(join(out, 'splash-mark.png'), png(svg1024(glyphGroup(1024)), 600)); // 3x of imageWidth 200
  writeFileSync(join(out, 'glyph.svg'), svg1024(glyph));
  writeFileSync(join(out, 'icon.png'), png(svg1024(`${vignette}<rect width="1024" height="1024" fill="url(#v)"/>${glyph}`)));
  // Android adaptive: 108dp canvas, 66dp safe zone -> glyph box inside ~61% of canvas minus 20% padding
  const adaptive = glyphGroup(0.44 * 1024); // horn tips stay inside the 66dp safe circle
  writeFileSync(join(out, 'android-icon-foreground.png'), png(svg1024(adaptive)));
  writeFileSync(join(out, 'android-icon-monochrome.png'), png(svg1024(adaptive)));
  writeFileSync(join(out, 'android-icon-background.png'), png(svg1024(`<rect width="1024" height="1024" fill="${WINE}"/>`)));
  // alternate icon "Notes" (P3-6)
  writeFileSync(join(out, 'notes-icon.png'), png(svg1024(`<rect width="1024" height="1024" fill="${NOTES_GREY}"/>${leafGroup(0.62 * 1024)}`)));
  writeFileSync(join(out, 'notes-android-foreground.png'), png(svg1024(leafGroup(0.44 * 1024))));
  writeFileSync(join(out, 'notes-android-background.png'), png(svg1024(`<rect width="1024" height="1024" fill="${NOTES_GREY}"/>`)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) build();
