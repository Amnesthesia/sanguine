// Store graphics (docs/store/listing-en-AU.md): app screenshots framed on the brand field with a caption, the Play feature
// graphic and the Play 512 icon. Marketing art, like the splash, so it uses the splash colours and Cormorant (D-072).
// Run: pnpm --filter @sanguine/brand store
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants, crc32, deflateSync } from 'node:zlib';
import { BLUSH, field, INK, LOGOTYPE, logotypePng, EMBLEM, emblemPng, PLUM, svgOf, tinted } from './build';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const shots = join(root, 'docs', 'screenshots');
export const OUT = join(root, 'docs', 'store', 'graphics');
const fonts = join(root, 'node_modules', '@expo-google-fonts', 'cormorant-garamond');
const FONT = 'Cormorant Garamond';

/** One store screenshot: caption lines, the iOS and Android source captures, and whether it is the dark slide. */
export const SLIDES = [
  { name: '01-today', caption: ['Your next period,', 'as a range'], ios: 'suite-p4-devclient/ios-typical.png', android: 'P3-1-devclient/android-typical.png' },
  { name: '02-log', caption: ['Log your day', 'in two taps'], ios: 'suite-p4-devclient/ios-sheet-symptoms.png', android: 'P3-1-devclient/android-sheet-symptoms.png' },
  { name: '03-calendar', caption: ['Your whole cycle', 'at a glance'], ios: 'suite-p4-devclient/ios-month.png', android: 'P3-1-devclient/android-month.png' },
  { name: '04-insights', caption: ['See how your', 'cycles vary'], ios: 'suite-p4-devclient/ios-charts.png', android: 'P3-1-devclient/android-charts.png' },
  { name: '05-privacy', caption: ['Stays on your phone,', 'encrypted'], ios: 'suite-p4-devclient/ios-privacy-discretion.png', android: 'P3-1-devclient/android-step5-privacy.png' },
  { name: '06-dark', caption: ['No account.', 'No tracking.'], ios: 'suite-p4-devclient/ios-typical-dark.png', android: 'P3-1-devclient/android-typical-dark.png', dark: true },
] as const;

/** Canvas per store: App Store 6.9" (1320 x 2868); Play 9:16 (1080 x 1920, the size Play asks for to be eligible for recommendation). */
export const FRAMES = {
  ios: { w: 1320, h: 2868, font: 100, line: 124, top: 300, shotW: 1060, shotY: 640, radius: 72 },
  android: { w: 1080, h: 1920, font: 76, line: 94, top: 210, shotW: 740, shotY: 440, radius: 44 },
} as const;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const caption = (lines: readonly string[], x: number, y: number, size: number, line: number, color: string) =>
  lines.map((l, i) => `<text x="${x}" y="${y + i * line}" font-family="${FONT}" font-weight="600" font-size="${size}" letter-spacing="${size * 0.06}" text-anchor="middle" fill="${color}">${esc(l.toUpperCase())}</text>`).join('');

/** PNG without an alpha channel: both stores reject screenshots and the feature graphic with alpha. */
export function rgbPng(svg: string): Buffer {
  const img = new Resvg(svg, { font: { fontFiles: [join(fonts, '600SemiBold', 'CormorantGaramond_600SemiBold.ttf')], loadSystemFonts: false, defaultFontFamily: FONT } }).render();
  const { width: w, height: h, pixels } = img;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pixels.copy(raw, y * (w * 3 + 1) + 1 + x * 3, (y * w + x) * 4, (y * w + x) * 4 + 3);
  const chunk = (type: string, data: Buffer) => {
    const td = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit truecolour, no alpha
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: constants.Z_BEST_COMPRESSION })), chunk('IEND', Buffer.alloc(0))]);
}

export function slideSvg(platform: keyof typeof FRAMES, slide: (typeof SLIDES)[number]): string {
  const f = FRAMES[platform];
  const src = readFileSync(join(shots, slide[platform]));
  const sh = (f.shotW * src.readUInt32BE(20)) / src.readUInt32BE(16);
  const x = (f.w - f.shotW) / 2;
  const dark = 'dark' in slide && slide.dark;
  const bg = dark ? PLUM : BLUSH;
  const fg = dark ? BLUSH : INK;
  // the capture runs off the bottom edge, so only the top corners are rounded
  return svgOf(f.w, f.h, `${field(f.w, f.h, bg)}${caption(slide.caption, f.w / 2, f.top, f.font, f.line, fg)}`
    + `<defs><clipPath id="c"><rect x="${x}" y="${f.shotY}" width="${f.shotW}" height="${sh}" rx="${f.radius}"/></clipPath>`
    + `<filter id="s" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="${f.radius / 3}" stdDeviation="${f.radius / 2}" flood-color="#2A1518" flood-opacity="0.18"/></filter></defs>`
    + `<rect x="${x}" y="${f.shotY}" width="${f.shotW}" height="${sh}" rx="${f.radius}" fill="${bg}" filter="url(#s)"/>`
    + `<image x="${x}" y="${f.shotY}" width="${f.shotW}" height="${sh}" clip-path="url(#c)" href="data:image/png;base64,${src.toString('base64')}"/>`);
}

/** Play feature graphic, 1024 x 500: emblem left, logotype and a line of caption right. */
export function featureSvg(): string {
  const ew = 300, eh = (ew * EMBLEM.h) / EMBLEM.w;
  const lw = 470, lh = (lw * LOGOTYPE.h) / LOGOTYPE.w;
  return svgOf(1024, 500, field(1024, 500, BLUSH) + tinted(emblemPng, EMBLEM, INK, 90, (500 - eh) / 2, ew)
    + tinted(logotypePng, LOGOTYPE, INK, 460, 150, lw) + caption(['A private cycle tracker'], 460 + lw / 2, 150 + lh + 70, 34, 0, INK));
}

export function buildStore(): void {
  for (const p of ['ios', 'android'] as const) {
    mkdirSync(join(OUT, p), { recursive: true });
    for (const s of SLIDES) writeFileSync(join(OUT, p, `${s.name}.png`), rgbPng(slideSvg(p, s)));
  }
  writeFileSync(join(OUT, 'play-feature-graphic.png'), rgbPng(featureSvg()));
  // Play icon: 512 x 512, 32-bit with alpha allowed; the app icon scaled down
  const icon = readFileSync(join(root, 'apps', 'mobile', 'assets', 'brand', 'icon.png'));
  writeFileSync(join(OUT, 'play-icon-512.png'), new Resvg(svgOf(512, 512, `<image width="512" height="512" href="data:image/png;base64,${icon.toString('base64')}"/>`)).render().asPng());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) buildStore();
