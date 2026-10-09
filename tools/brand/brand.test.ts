import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BLUSH, EMBLEM, INK, LOCKUP_W_FOR_TEST, LOGOTYPE, lockupSvg, PLUM } from './build';

const mobile = join(__dirname, '..', '..', 'apps', 'mobile');
const app = JSON.parse(readFileSync(join(mobile, 'app.json'), 'utf8')).expo;
const splash = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];

describe('brand v2 config (PLAN.md §9.9, D-049, D-051)', () => {
  it('the field colours and the ink are the splash constants, and never UI tokens (D-051)', () => {
    const splashSrc = readFileSync(join(mobile, 'src', 'features', 'splash', 'BrandSplash.tsx'), 'utf8');
    expect(splashSrc).toContain(`light: { field: '${BLUSH}', ink: '${INK}'`);
    expect(splashSrc).toContain(`dark: { field: '${PLUM}'`);
    const tokens = readFileSync(join(__dirname, '..', '..', 'packages', 'ui-tokens', 'src', 'tokens.ts'), 'utf8');
    for (const hex of [BLUSH, PLUM, INK]) expect(tokens).not.toContain(hex);
  });
  it('splash is blush (plum in dark) with the lock-up at 260 pt', () => {
    expect(splash.backgroundColor).toBe(BLUSH);
    expect(splash.imageWidth).toBe(260);
    expect(splash.resizeMode).toBe('contain');
    expect(splash.dark.backgroundColor).toBe(PLUM);
    expect(splash.image).toContain('splash-lockup.png');
    expect(splash.dark.image).toContain('splash-lockup-dark.png');
  });
  it('Android native splash is the bare field: its 12+ circular icon mask would clip a lock-up (D-049)', () => {
    expect(splash.android.image).toContain('splash-android-blank.png');
    expect(splash.android.backgroundColor).toBe(BLUSH);
    expect(splash.android.dark.backgroundColor).toBe(PLUM);
  });
  it('the splash lock-up aspect matches the constant the JS splash positions with', () => {
    const { w, h } = lockupSvg(INK);
    expect(w).toBe(LOCKUP_W_FOR_TEST);
    expect(h / w).toBeCloseTo(881 / 780, 2);
  });
  it('android adaptive icon is blush with a monochrome layer; iOS has light, dark and tinted', () => {
    expect(app.android.adaptiveIcon.backgroundColor).toBe(BLUSH);
    expect(app.android.adaptiveIcon.monochromeImage).toBeTruthy();
    expect(Object.keys(app.ios.icon).sort()).toEqual(['dark', 'light', 'tinted']);
  });
  it('every referenced brand asset exists and is non-empty', () => {
    const refs = [app.icon, splash.image, splash.dark.image, ...Object.values(app.ios.icon), app.android.adaptiveIcon.foregroundImage, app.android.adaptiveIcon.backgroundImage, app.android.adaptiveIcon.monochromeImage] as string[];
    for (const r of refs) {
      const f = join(mobile, r);
      expect(existsSync(f), r).toBe(true);
      expect(statSync(f).size, r).toBeGreaterThan(1000);
    }
  });
  it('the client artwork is used as supplied: white on transparent PNGs, tinted at render time, never redrawn or re-typeset', () => {
    expect(EMBLEM.w).toBeGreaterThan(300);
    expect(LOGOTYPE.w).toBeGreaterThan(300);
    const src = readFileSync(join(__dirname, 'build.ts'), 'utf8');
    expect(src).not.toMatch(/opentype|getPath|fana|dancing|cinzel/i);
    expect(src).toContain('emblem.png');
    expect(src).toContain('logotype.png');
  });
  it('the discreet "Notes" icon exists on a neutral grey field with no brand colour (P3-6)', () => {
    for (const f of ['notes-icon.png', 'notes-android-foreground.png', 'notes-android-background.png']) expect(statSync(join(mobile, 'assets/brand', f)).size).toBeGreaterThan(500);
    const src = readFileSync(join(__dirname, 'build.ts'), 'utf8');
    expect(src).toMatch(/NOTES_GREY = '#6B6165'/);
    expect(src.slice(src.indexOf("'notes-icon.png'"), src.indexOf("'notes-android-background.png'"))).not.toMatch(/BLUSH|PLUM|INK/);
  });
});
