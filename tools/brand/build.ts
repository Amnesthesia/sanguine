// Renders the v2 brand assets (PLAN.md §9.9, D-049): tints the client's emblem and logotype (white on transparent, docs/brand-v2/)
// and composes the lock-up, splash, icons. Nothing is redrawn or re-typeset. Run: pnpm --filter @sanguine/brand build
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BLUSH = '#F5E8E2';
export const PLUM = '#2A1518';
export const INK = '#73393B';
/** Discreet alternate icon "Notes" (PLAN.md §8.8, P3-6): a white leaf on neutral grey, no brand colour. */
export const NOTES_GREY = '#6B6165';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const src = join(root, 'docs', 'brand-v2');
const out = join(root, 'apps', 'mobile', 'assets', 'brand');

export const emblemPng = readFileSync(join(src, 'emblem.png'));
export const logotypePng = readFileSync(join(src, 'logotype.png'));
/** Width and height from the PNG header (IHDR). */
const size = (b: Buffer) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });
export const EMBLEM = size(emblemPng);
export const LOGOTYPE = size(logotypePng);

export const png = (svg: string, width?: number) => new Resvg(svg, width ? { fitTo: { mode: 'width', value: width } } : {}).render().asPng();
export const svgOf = (w: number, h: number, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;
export const field = (w: number, h: number, color: string) => `<rect width="${w}" height="${h}" fill="${color}"/>`;

let n = 0;
/** One of the white-on-transparent PNGs, recoloured to `color` and placed at x, y with width `w`. */
export function tinted(buf: Buffer, dims: { w: number; h: number }, color: string, x: number, y: number, w: number): string {
  const id = `t${n++}`;
  const h = (w * dims.h) / dims.w;
  return `<filter id="${id}" color-interpolation-filters="sRGB"><feFlood flood-color="${color}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`
    + `<image x="${x}" y="${y}" width="${w}" height="${h}" filter="url(#${id})" href="data:image/png;base64,${buf.toString('base64')}"/>`;
}

const LOCKUP_W = 780; // 260 pt at 3x (expo-splash-screen imageWidth 260)
export const LOCKUP_W_FOR_TEST = LOCKUP_W;
const EMBLEM_SHARE = 0.9; // emblem width as a share of the logotype width, as in the client's reference
const LOCKUP_GAP = 56;

/** The lock-up: emblem above logotype, transparent, in one colour. */
export function lockupSvg(color: string): { svg: string; w: number; h: number } {
  const ew = LOCKUP_W * EMBLEM_SHARE;
  const eh = (ew * EMBLEM.h) / EMBLEM.w;
  const lh = (LOCKUP_W * LOGOTYPE.h) / LOGOTYPE.w;
  const h = Math.ceil(eh + LOCKUP_GAP + lh);
  const svg = svgOf(LOCKUP_W, h,
    tinted(emblemPng, EMBLEM, color, (LOCKUP_W - ew) / 2, 0, ew) + tinted(logotypePng, LOGOTYPE, color, 0, eh + LOCKUP_GAP, LOCKUP_W));
  return { svg, w: LOCKUP_W, h };
}

/** The emblem centred on a 1024 canvas at `share` of the canvas width. */
function emblemOn(share: number, color: string): string {
  const w = 1024 * share;
  const h = (w * EMBLEM.h) / EMBLEM.w;
  return tinted(emblemPng, EMBLEM, color, (1024 - w) / 2, (1024 - h) / 2, w);
}
const square = (inner: string) => svgOf(1024, 1024, inner);

/** Leaf for the discreet icon, on a 1024 canvas: a pointed blade with a midrib cut back to the field colour. */
export function leafGroup(box: number): string {
  const s = box / 720;
  const tx = 512 - 512 * s, ty = 512 - 512 * s;
  const blade = 'M512 152 C296 300 236 620 512 872 C788 620 728 300 512 152Z';
  const rib = 'M512 212 C500 420 500 640 512 836';
  return `<g transform="translate(${tx} ${ty}) scale(${s}) rotate(-22 512 512)"><path d="${blade}" fill="#FFFFFF"/><path d="${rib}" fill="none" stroke="${NOTES_GREY}" stroke-width="26" stroke-linecap="round"/></g>`;
}

export function build(): void {
  mkdirSync(out, { recursive: true });
  const write = (name: string, data: Buffer) => writeFileSync(join(out, name), data);
  // the white-on-transparent originals, tinted at runtime in the app (About band, watermarks)
  write('emblem.png', emblemPng);
  write('logotype.png', logotypePng);
  // splash lock-ups: ink on blush, blush on plum (the field colour comes from app.json)
  write('splash-lockup.png', png(lockupSvg(INK).svg));
  write('splash-lockup-dark.png', png(lockupSvg(BLUSH).svg));
  // Android 12+ draws the native splash image inside a circular icon mask (about 160 dp), which clips a lock-up to fragments; the
  // native splash there is the blush field with this transparent image, and the JS splash fades the lock-up in (D-049)
  write('splash-android-blank.png', png(svgOf(200, 200, '')));
  // icons: emblem at 62% of the canvas
  write('icon.png', png(square(field(1024, 1024, BLUSH) + emblemOn(0.62, INK))));
  write('icon-dark.png', png(square(field(1024, 1024, PLUM) + emblemOn(0.62, BLUSH))));
  write('icon-tinted.png', png(square(field(1024, 1024, '#000000') + emblemOn(0.62, '#FFFFFF')))); // iOS tints this one
  // Android adaptive: 108 dp canvas, 66 dp safe circle; the emblem is wide, so it is smaller than on the iOS icon
  write('android-icon-background.png', png(square(field(1024, 1024, BLUSH))));
  write('android-icon-foreground.png', png(square(emblemOn(0.46, INK))));
  write('android-icon-monochrome.png', png(square(emblemOn(0.46, '#FFFFFF'))));
  // discreet alternate icon "Notes" (P3-6), unchanged by v2
  write('notes-icon.png', png(square(field(1024, 1024, NOTES_GREY) + leafGroup(0.62 * 1024))));
  write('notes-android-foreground.png', png(square(leafGroup(0.44 * 1024))));
  write('notes-android-background.png', png(square(field(1024, 1024, NOTES_GREY))));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) build();
