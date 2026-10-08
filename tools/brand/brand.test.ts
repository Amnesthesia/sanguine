import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const mobile = join(__dirname, '..', '..', 'apps', 'mobile');
const app = JSON.parse(readFileSync(join(mobile, 'app.json'), 'utf8')).expo;
const splash = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];

describe('brand config (PLAN.md §9.9)', () => {
  it('splash is wine red with the wordmark at 220pt, same in dark mode', () => {
    expect(splash.backgroundColor).toBe('#6A1220');
    expect(splash.imageWidth).toBe(220);
    expect(splash.resizeMode).toBe('contain');
    expect(splash.dark.backgroundColor).toBe('#6A1220');
  });
  it('android adaptive icon uses wine background and a monochrome layer', () => {
    expect(app.android.adaptiveIcon.backgroundColor).toBe('#6A1220');
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
  it('never uses the Fana Studio font', () => {
    const src = readFileSync(join(__dirname, 'build.ts'), 'utf8');
    expect(src).not.toMatch(/fana/i);
    expect(src).toMatch(/dancing-script\/700Bold/);
  });
});
