import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const mobile = join(__dirname, '..', '..', 'apps', 'mobile');
const app = JSON.parse(readFileSync(join(mobile, 'app.json'), 'utf8')).expo;
const splash = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];

describe('brand config (PLAN.md §9.9)', () => {
  it('splash is brand red with the mark at 200pt, same in dark mode', () => {
    expect(splash.backgroundColor).toBe('#B8324A');
    expect(splash.imageWidth).toBe(200);
    expect(splash.resizeMode).toBe('contain');
    expect(splash.dark.backgroundColor).toBe('#B8324A');
  });
  it('android adaptive icon uses the brand red background and a monochrome layer', () => {
    expect(app.android.adaptiveIcon.backgroundColor).toBe('#B8324A');
    expect(app.android.adaptiveIcon.monochromeImage).toBeTruthy();
  });
  it('every referenced brand asset exists and is non-empty', () => {
    const refs = [app.icon, splash.image, app.android.adaptiveIcon.foregroundImage, app.android.adaptiveIcon.backgroundImage, app.android.adaptiveIcon.monochromeImage];
    for (const r of refs) {
      const f = join(mobile, r);
      expect(existsSync(f), r).toBe(true);
      expect(statSync(f).size, r).toBeGreaterThan(1000);
    }
  });
  it('the discreet "Notes" icon exists on a neutral grey field with no brand colour (P3-6)', () => {
    for (const f of ['notes-icon.png', 'notes-android-foreground.png', 'notes-android-background.png']) expect(statSync(join(mobile, 'assets/brand', f)).size).toBeGreaterThan(500);
    const src = readFileSync(join(__dirname, 'build.ts'), 'utf8');
    expect(src).toMatch(/NOTES_GREY = '#6B6165'/);
    expect(src.slice(src.indexOf("'notes-icon.png'"), src.indexOf("'notes-android-background.png'"))).not.toMatch(/WINE/);
  });
  it('never uses the Fana Studio font', () => {
    const src = readFileSync(join(__dirname, 'build.ts'), 'utf8');
    expect(src).not.toMatch(/fana/i);
    expect(src).toMatch(/dancing-script\/700Bold/);
  });
  it('the mark is closed filled outlines with no NaN coordinates', async () => {
    const { markPaths } = await import('./build');
    const paths = markPaths();
    expect(paths.length).toBeGreaterThanOrEqual(10);
    for (const d of paths) {
      expect(d).toMatch(/^M[\d.\- L]+Z$/);
      expect(d).not.toMatch(/NaN/);
    }
  });
});
