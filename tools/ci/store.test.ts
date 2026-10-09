// Release readiness that can be checked without a store account (PLAN.md §2.3, §6.6, §7.6).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const json = (p: string) => JSON.parse(read(p)) as Record<string, any>; // biome-ignore lint/suspicious/noExplicitAny: config files

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
  it('the Apple privacy manifest declares no tracking and no collected data', () => {
    const pm = json('apps/mobile/app.json').expo.ios.privacyManifests;
    expect(pm.NSPrivacyTracking).toBe(false);
    expect(pm.NSPrivacyTrackingDomains).toEqual([]);
    expect(pm.NSPrivacyCollectedDataTypes).toEqual([]);
    expect(pm.NSPrivacyAccessedAPITypes.length).toBeGreaterThan(0);
  });
});

describe('store listing (en-AU)', () => {
  const listing = read('docs/store/listing-en-AU.md');
  const FIXED = 'Sanguine helps you track and understand your menstrual cycle. It is not a contraceptive and is not a medical device.';
  const section = (from: string, to: string) => listing.slice(listing.indexOf(from), listing.indexOf(to));
  it('opens the description with the fixed §2.3 wording', () => expect(section('## Description', '## Keywords')).toContain(`## Description\n\n${FIXED}\n`));
  it('ends the description with the fixed about wording', () => expect(listing).toContain('Sanguine does not diagnose, screen for or treat any condition. If you are worried about your health, talk to a health professional.'));
  it('has no forbidden word in the text users read', () => {
    const text = (section('## Description', '## Category')).replace(FIXED, '');
    // §2.3 and §8.7 list; same words as copy/copy.test.ts
    const words = /\b(safe|unsafe|(un)?protected|contraception|birth control|concei\w*|fertile today|chance of pregnancy|risks?|diagnosis|PCOS|endometriosis|perimenopaus\w*|abnormal|ladies|girls?|feminine|womanhood|should|normal)\b/i;
    expect(text.match(words)).toBeNull();
  });
  it('fits the store limits', () => {
    expect('Sanguine: Cycle Tracker'.length).toBeLessThanOrEqual(30);
    expect('Private, on-device cycle log'.length).toBeLessThanOrEqual(30);
    expect('A private cycle tracker that keeps everything on your phone.'.length).toBeLessThanOrEqual(80);
    const kw = section('## Keywords', '## Category').split('\n').find((l) => l.includes(',')) ?? '';
    expect(kw.length).toBeLessThanOrEqual(100);
  });
  it('has review notes and the Play declaration', () => {
    for (const f of ['review-notes.md', 'play-health-declaration.md']) expect(existsSync(join(root, 'docs/store', f))).toBe(true);
  });
});

describe('open-source files', () => {
  it('has the licence, trademark, security and contributing files', () => {
    expect(read('LICENSE')).toMatch(/GNU AFFERO GENERAL PUBLIC LICENSE\s+Version 3/);
    for (const f of ['TRADEMARK.md', 'SECURITY.md', 'CONTRIBUTING.md', 'packages/engine/LICENSE']) expect(existsSync(join(root, f)), f).toBe(true);
  });
});
