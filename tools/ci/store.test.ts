// Release readiness that can be checked without a store account (PLAN.md §2.3, §6.6, §7.6).
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
// biome-ignore lint/suspicious/noExplicitAny: config files
const json = (p: string) => JSON.parse(read(p)) as Record<string, any>;

describe('release configuration', () => {
  it('eas.json has development, preview and production build profiles', () => {
    const eas = json('apps/mobile/eas.json');
    expect(Object.keys(eas.build)).toEqual(expect.arrayContaining(['development', 'preview', 'production']));
    expect(eas.build.development.developmentClient).toBe(true);
  });
  it('no workflow publishes over-the-air updates: engine parameters ship only as builds (§6.6)', () => {
    for (const f of readdirSync(join(root, '.github/workflows'))) expect(read(`.github/workflows/${f}`), f).not.toMatch(/eas[- ]update|expo-updates/);
  });
  it('the build is tagged by version and verifies before it builds', () => {
    const wf = read('.github/workflows/release.yml');
    expect(wf).toMatch(/tags: \['v\*'\]/);
    expect(wf).toMatch(/needs: verify/);
  });
  it('every workflow action is pinned to a full commit SHA (a movable tag could read a secret)', () => {
    for (const f of readdirSync(join(root, '.github/workflows'))) for (const m of read(`.github/workflows/${f}`).matchAll(/uses:\s*(\S+)/g)) expect(m[1], f).toMatch(/@[0-9a-f]{40}$/);
  });
  it('the Expo token reaches only the eas-cli steps, never a job-wide env or a third-party action', () => {
    const wf = read('.github/workflows/release.yml');
    expect(wf).not.toMatch(/^\s{4}env:.*EXPO_TOKEN/m);
    const steps = wf.split(/\n\s+- /).filter((s) => s.includes('secrets.EXPO_TOKEN'));
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) expect(s).toMatch(/^run: npx eas-cli /);
  });
  it('the Apple privacy manifest declares no tracking and only the update check\'s installation id (D-072)', () => {
    const pm = json('apps/mobile/app.json').expo.ios.privacyManifests;
    expect(pm.NSPrivacyTracking).toBe(false);
    expect(pm.NSPrivacyTrackingDomains).toEqual([]);
    expect(pm.NSPrivacyCollectedDataTypes).toEqual([{
      NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeDeviceID',
      NSPrivacyCollectedDataTypeLinked: false,
      NSPrivacyCollectedDataTypeTracking: false,
      NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
    }]);
    expect(pm.NSPrivacyAccessedAPITypes.length).toBeGreaterThan(0);
    const types = pm.NSPrivacyAccessedAPITypes.map((e: { NSPrivacyAccessedAPIType: string }) => e.NSPrivacyAccessedAPIType);
    expect(new Set(types).size).toBe(types.length); // a repeated category is a malformed manifest
  });
  it('entitlement arrays have no repeated values (duplicates fail provisioning)', () => {
    const ent = json('apps/mobile/app.json').expo.ios.entitlements as Record<string, string[]>;
    for (const values of Object.values(ent)) expect(new Set(values).size).toBe(values.length);
  });
});

const listing = read('docs/store/listing-en-AU.md');
const FIXED = 'Sanguine helps you track and understand your menstrual cycle. It is not a contraceptive and is not a medical device.';

describe('store listing (en-AU)', () => {
  const section = (from: string, to: string) => listing.slice(listing.indexOf(from), listing.indexOf(to));
  it('opens the description with the fixed §2.3 wording', () => expect(section('## Description', '## Keywords')).toContain(`## Description\n\n${FIXED}\n`));
  it('ends the description with the fixed about wording', () => expect(listing).toContain('Sanguine does not diagnose, screen for or treat any condition. If you are worried about your health, talk to a health professional.'));
  it('has no forbidden word in the text users read', () => {
    const text = (section('## Name', '## Category')).replace(FIXED, '');
    // §2.3 and §8.7 list; same words as copy/copy.test.ts
    const words = /\b(safe|unsafe|(un)?protected|contraception|birth control|concei\w*|fertile today|chance of pregnancy|risks?|diagnosis|PCOS|endometriosis|perimenopaus\w*|abnormal|ladies|girls?|feminine|womanhood|should|normal)\b/i;
    expect(text.match(words)).toBeNull();
  });
  it('fits the store limits', () => {
    expect('Sanguine: Cycle Tracker'.length).toBeLessThanOrEqual(30);
    expect('Private, on-device cycle log'.length).toBeLessThanOrEqual(30);
    expect('A private cycle tracker that keeps everything on your phone.'.length).toBeLessThanOrEqual(80);
    expect(listing.match(/Promotional text[^:]*: (.+)/)?.[1].length).toBeLessThanOrEqual(170);
    const kw = section('## Keywords', '## Category').split('\n').find((l) => l.includes(',')) ?? '';
    expect(kw.length).toBeLessThanOrEqual(100);
  });
  it('has review notes and the Play declaration', () => {
    for (const f of ['review-notes.md', 'play-health-declaration.md']) expect(existsSync(join(root, 'docs/store', f))).toBe(true);
  });
});

describe('store graphics (docs/store/graphics, tools/brand/store.ts)', () => {
  // width, height and PNG colour type from the IHDR chunk; type 2 is RGB without alpha, which both stores require for screenshots
  const ihdr = (p: string) => { const b = readFileSync(join(root, 'docs/store/graphics', p)); return [b.readUInt32BE(16), b.readUInt32BE(20), b[25]]; };
  it('every slide exists for both stores at the store size, without alpha', async () => {
    const { SLIDES, FRAMES } = await import('../brand/store');
    for (const s of SLIDES) for (const p of ['ios', 'android'] as const) {
      expect(ihdr(`${p}/${s.name}.png`), `${p}/${s.name}`).toEqual([FRAMES[p].w, FRAMES[p].h, 2]);
      expect(listing, s.name).toContain(`${p}/${s.name}.png`);
    }
  });
  it('has the Play feature graphic and 512 icon', () => {
    expect(ihdr('play-feature-graphic.png')).toEqual([1024, 500, 2]);
    expect(ihdr('play-icon-512.png').slice(0, 2)).toEqual([512, 512]);
  });
});

describe('website (apps/site/, Astro, built by pnpm site)', () => {
  const DIST = join(root, 'apps', 'site', 'dist');
  const pages = ['src/layouts/Base.astro', 'src/pages/index.astro', 'src/pages/support.astro'];
  it('builds every page the listing links to, with the published policy', () => {
    execFileSync('pnpm', ['site'], { cwd: root, stdio: 'pipe', timeout: 120_000 });
    for (const m of listing.matchAll(/https:\/\/amnesthesia\.github\.io\/sanguine\/(\S*)/g)) expect(existsSync(join(DIST, m[1] || 'index.html')), m[0]).toBe(true);
    const privacy = readFileSync(join(DIST, 'privacy.html'), 'utf8');
    expect(privacy).toContain('Sanguine Privacy Policy');
    expect(privacy).toContain('mailto:admin@dothings.lol');
    expect(privacy).not.toMatch(/TBD|DRAFT/);
    expect(readFileSync(join(DIST, 'index.html'), 'utf8')).toContain(FIXED);
  }, 150_000);
  it('loads nothing from a third party', () => {
    for (const f of pages) expect(read(`apps/site/${f}`).match(/(?:src|href)="https?:\/\/(?!github\.com\/Amnesthesia)[^"]*"/g), f).toBeNull();
    expect(existsSync(join(DIST, 'index.html')) && readFileSync(join(DIST, 'index.html'), 'utf8').match(/(?:src|href)="https?:\/\/(?!github\.com\/Amnesthesia)[^"]*"/g)).toBeFalsy();
  });
  it('has no forbidden word in the pages it writes itself', () => {
    const words = /\b(safe|unsafe|(un)?protected|contraception|birth control|concei\w*|fertile today|chance of pregnancy|risks?|diagnosis|PCOS|endometriosis|perimenopaus\w*|abnormal|ladies|girls?|feminine|womanhood|should|normal)\b/i;
    for (const f of pages) expect(read(`apps/site/${f}`).match(words), f).toBeNull();
  });
});

describe('open-source files', () => {
  it('has the licence, trademark, security and contributing files', () => {
    expect(read('LICENSE')).toMatch(/GNU AFFERO GENERAL PUBLIC LICENSE\s+Version 3/);
    for (const f of ['TRADEMARK.md', 'SECURITY.md', 'CONTRIBUTING.md', 'packages/engine/LICENSE']) expect(existsSync(join(root, f)), f).toBe(true);
  });
});
