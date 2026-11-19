// Store graphics (docs/store/listing-en-AU.md): app screenshots in a phone frame on the brand field with a caption, one typographic
// privacy slide, the Play feature graphic and the Play 512 icon. Marketing art, like the splash, so it uses the splash colours and
// Cormorant (D-072). Source captures: docs/screenshots/appstore/ios/ (iPhone 17 Pro Max, 1320 x 2868, D-148).
// Run: pnpm --filter @sanguine/brand store
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants, crc32, deflateSync } from 'node:zlib';
import { BLUSH, EMBLEM, emblemPng, field, INK, LOGOTYPE, logotypePng, PLUM, svgOf, tinted } from './build';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const shots = join(root, 'docs', 'screenshots', 'appstore', 'ios');
export const OUT = join(root, 'docs', 'store', 'graphics');
const fonts = join(root, 'node_modules', '@expo-google-fonts', 'cormorant-garamond');
const FONT = 'Cormorant Garamond';
/** Phone body: near-black with a plum cast, so it sits on blush without the hard look of pure black. */
const BODY = '#161012';
const BODY_EDGE = '#3B2E31';

/** Source capture size (iPhone 6.9"), and the Dynamic Island in it, measured on 02-calendar-light (the only capture that shows it). */
const SRC = { w: 1320, h: 2868, island: { x: 472, y: 42, w: 468, h: 110 } } as const;

type Phone = { src: string };
/** One store screenshot. `phones`: one capture, or two (back, front) for the opening slide; none for the typographic slide. */
export type Slide = { name: string; caption: readonly string[]; sub: string; phones: readonly Phone[]; dark?: boolean };

export const SLIDES: readonly Slide[] = [
  { name: '01-today', caption: ['Know where you are', 'in your cycle'], sub: 'A range, not a promise.', phones: [{ src: '01-today-dark.png' }, { src: '01-today-light.png' }] },
  { name: '02-calendar', caption: ['Your whole cycle', 'at a glance'], sub: 'Logged days solid, estimates dashed.', phones: [{ src: '02-calendar-light.png' }] },
  { name: '03-day', caption: ['Every estimate says', 'how sure it is'], sub: 'Tap any day to read it in words.', phones: [{ src: '03-calendar-day-light.png' }] },
  { name: '04-log', caption: ['Log your day', 'in a few taps'], sub: 'Flow, symptoms, energy, temperature and more.', phones: [{ src: '04-log-light.png' }] },
  { name: '05-insights', caption: ['How each estimate', 'was worked out'], sub: 'Your own cycles, and the research behind them.', phones: [{ src: '05-insights-cycle-light.png' }] },
  { name: '06-privacy', caption: ['Stays on your phone'], sub: 'Encrypted on your phone, and nowhere else.', phones: [], dark: true },
  { name: '07-dark', caption: ['Light or dark,', 'day or night'], sub: 'Follows your phone, or choose in Settings.', phones: [{ src: '02-calendar-dark.png' }], dark: true },
];

/**
 * Canvas per store: App Store 6.9" (1320 x 2868); Play 9:16 (1080 x 1920, the size Play asks for to be eligible for recommendation).
 * Play frames crop the iOS status bar (`cropTop`) and draw no Dynamic Island, so the phone reads as a phone, not an iPhone.
 */
export const FRAMES = {
  ios: { w: 1320, h: 2868, emblemY: 170, emblemW: 150, capY: 470, font: 98, line: 120, sub: 54, subGap: 92, phoneY: 900, phoneW: 1000, cropTop: 0, island: true },
  android: { w: 1080, h: 1920, emblemY: 110, emblemW: 92, capY: 300, font: 68, line: 84, sub: 38, subGap: 64, phoneY: 560, phoneW: 700, cropTop: 150, island: false },
} as const;
type Frame = (typeof FRAMES)[keyof typeof FRAMES];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
let uid = 0;
const id = (p: string) => `${p}${uid++}`;

const caps = (lines: readonly string[], x: number, y: number, size: number, line: number, color: string) =>
  lines.map((l, i) => `<text x="${x}" y="${y + i * line}" font-family="${FONT}" font-weight="600" font-size="${size}" letter-spacing="${size * 0.07}" text-anchor="middle" fill="${color}">${esc(l.toUpperCase())}</text>`).join('');
const italic = (s: string, x: number, y: number, size: number, color: string, opacity = 0.85) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-style="italic" font-weight="500" font-size="${size}" text-anchor="middle" fill="${color}" fill-opacity="${opacity}">${esc(s)}</text>`;

/** Field with a soft light from the top and a warm glow low on the right; plum in the dark version. */
function backdrop(w: number, h: number, dark: boolean): string {
  const g1 = id('g'), g2 = id('g');
  const [base, light, glow] = dark ? [PLUM, '#3D2126', '#4A2329'] : [BLUSH, '#FDF6F2', '#EBCFC8'];
  return `<defs><radialGradient id="${g1}" cx="0.5" cy="0.08" r="0.75"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="${g2}" cx="0.95" cy="0.9" r="0.6"><stop offset="0" stop-color="${glow}" stop-opacity="0.9"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs>`
    + field(w, h, base) + `<rect width="${w}" height="${h}" fill="url(#${g1})"/><rect width="${w}" height="${h}" fill="url(#${g2})"/>`;
}

/** The client's emblem, recoloured, at `opacity`. */
const emblem = (color: string, x: number, y: number, w: number, opacity = 1) => `<g opacity="${opacity}">${tinted(emblemPng, EMBLEM, color, x, y, w)}</g>`;
const emblemH = (w: number) => (w * EMBLEM.h) / EMBLEM.w;

/** A phone: dark body, the capture clipped to the screen's rounded corners, a Dynamic Island on iOS, a soft shadow. */
function phone(f: Frame, src: string, x: number, y: number, w: number): string {
  const img = readFileSync(join(shots, src));
  const s = w / SRC.w;
  const h = (SRC.h - f.cropTop) * s;
  const r = w * 0.135, b = w * 0.03;
  const clip = id('c'), shadow = id('s');
  const island = f.island ? `<rect x="${x + SRC.island.x * s}" y="${y + SRC.island.y * s}" width="${SRC.island.w * s}" height="${SRC.island.h * s}" rx="${(SRC.island.h * s) / 2}" fill="#000"/>` : '';
  return `<defs><clipPath id="${clip}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>`
    + `<filter id="${shadow}" x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="${w * 0.04}" stdDeviation="${w * 0.045}" flood-color="${PLUM}" flood-opacity="0.32"/></filter></defs>`
    + `<rect x="${x - b}" y="${y - b}" width="${w + 2 * b}" height="${h + 2 * b}" rx="${r + b}" fill="${BODY}" filter="url(#${shadow})"/>`
    + `<rect x="${x - b + 2}" y="${y - b + 2}" width="${w + 2 * b - 4}" height="${h + 2 * b - 4}" rx="${r + b - 2}" fill="none" stroke="${BODY_EDGE}" stroke-width="3"/>`
    + `<image x="${x}" y="${y - f.cropTop * s}" width="${w}" height="${SRC.h * s}" clip-path="url(#${clip})" preserveAspectRatio="none" href="data:image/png;base64,${img.toString('base64')}"/>`
    + island;
}

/** Emblem, caption in Cormorant capitals and an italic line, centred at the top. */
function heading(f: Frame, slide: Slide, fg: string): string {
  const ex = (f.w - f.emblemW) / 2;
  const subY = f.capY + (slide.caption.length - 1) * f.line + f.subGap;
  return emblem(fg, ex, f.emblemY, f.emblemW) + caps(slide.caption, f.w / 2, f.capY, f.font, f.line, fg) + italic(slide.sub, f.w / 2, subY, f.sub, fg);
}

function privacySlide(f: Frame, slide: Slide): string {
  const k = f.w / 1320, v = f.h / 2868;
  const ew = 560 * k, ey = 430 * v;
  const capY = ey + emblemH(ew) + 260 * v;
  const lines = ['No account.', 'No ads.', 'No tracking.'];
  const rule = (y: number) => `<line x1="${f.w / 2 - 90 * k}" y1="${y}" x2="${f.w / 2 + 90 * k}" y2="${y}" stroke="${BLUSH}" stroke-opacity="0.45" stroke-width="${3 * k}"/>`;
  const listY = capY + 230 * v;
  const lw = 520 * k, lh = (lw * LOGOTYPE.h) / LOGOTYPE.w;
  return emblem(BLUSH, (f.w - ew) / 2, ey, ew)
    + caps(slide.caption, f.w / 2, capY, f.font * 1.05, 0, BLUSH)
    + rule(capY + 90 * v)
    + lines.map((l, i) => italic(l, f.w / 2, listY + i * 150 * v, f.sub * 1.9, BLUSH, 1)).join('')
    + rule(listY + 2 * 150 * v + 110 * v)
    + italic(slide.sub, f.w / 2, listY + 2 * 150 * v + 230 * v, f.sub, BLUSH)
    + `<g opacity="0.9">${tinted(logotypePng, LOGOTYPE, BLUSH, (f.w - lw) / 2, f.h - lh - 260 * v, lw)}</g>`;
}

export function slideSvg(platform: keyof typeof FRAMES, slide: Slide): string {
  const f = FRAMES[platform];
  const dark = !!slide.dark;
  const fg = dark ? BLUSH : INK;
  let body: string;
  if (slide.phones.length === 0) body = privacySlide(f, slide);
  else if (slide.phones.length === 1) body = heading(f, slide, fg) + phone(f, slide.phones[0].src, (f.w - f.phoneW) / 2, f.phoneY, f.phoneW);
  else {
    // opening slide: the dark capture behind on the left, tilted, the light one in front on the right
    const [back, front] = slide.phones;
    const bw = f.phoneW * 0.8, fw = f.phoneW * 0.84;
    const bx = f.w * 0.06, fx = f.w - fw - f.w * 0.05;
    body = heading(f, slide, fg)
      + `<g transform="rotate(-7 ${bx + bw / 2} ${f.phoneY + f.h * 0.3})">${phone(f, back.src, bx, f.phoneY + f.h * 0.04, bw)}</g>`
      + `<g transform="rotate(4 ${fx + fw / 2} ${f.phoneY + f.h * 0.3})">${phone(f, front.src, fx, f.phoneY + f.h * 0.015, fw)}</g>`;
  }
  return svgOf(f.w, f.h, backdrop(f.w, f.h, dark) + body);
}

/** Play feature graphic, 1024 x 500: emblem, logotype and two lines on the left; the Today screen in a phone on the right. */
export function featureSvg(): string {
  const W = 1024, H = 500;
  const ew = 120, lw = 380, lh = (lw * LOGOTYPE.h) / LOGOTYPE.w;
  const cx = 290;
  const f = FRAMES.android; // status bar cropped, no island
  const pw = 300;
  return svgOf(W, H, backdrop(W, H, false)
    + emblem(INK, cx - ew / 2, 70, ew)
    + tinted(logotypePng, LOGOTYPE, INK, cx - lw / 2, 70 + emblemH(ew) + 22, lw)
    + caps(['A private cycle tracker'], cx, 70 + emblemH(ew) + 22 + lh + 62, 30, 0, INK)
    + italic('Your cycle, kept on your phone.', cx, 70 + emblemH(ew) + 22 + lh + 110, 28, INK)
    + `<g transform="rotate(6 ${790} ${330})">${phone(f, '01-today-light.png', 640, 70, pw)}</g>`);
}

/** PNG without an alpha channel: both stores reject screenshots and the feature graphic with alpha. */
export function rgbPng(svg: string): Buffer {
  const files = ['600SemiBold/CormorantGaramond_600SemiBold.ttf', '500Medium_Italic/CormorantGaramond_500Medium_Italic.ttf'].map((p) => join(fonts, p));
  const img = new Resvg(svg, { font: { fontFiles: files, loadSystemFonts: false, defaultFontFamily: FONT } }).render();
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

export function buildStore(only?: string): void {
  for (const p of ['ios', 'android'] as const) {
    mkdirSync(join(OUT, p), { recursive: true });
    for (const s of SLIDES) if (!only || s.name === only) writeFileSync(join(OUT, p, `${s.name}.png`), rgbPng(slideSvg(p, s)));
  }
  if (!only || only === 'feature') writeFileSync(join(OUT, 'play-feature-graphic.png'), rgbPng(featureSvg()));
  // Play icon: 512 x 512, 32-bit with alpha allowed; the app icon scaled down
  const icon = readFileSync(join(root, 'apps', 'mobile', 'assets', 'brand', 'icon.png'));
  writeFileSync(join(OUT, 'play-icon-512.png'), new Resvg(svgOf(512, 512, `<image width="512" height="512" href="data:image/png;base64,${icon.toString('base64')}"/>`)).render().asPng());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) buildStore(process.argv[2]);
