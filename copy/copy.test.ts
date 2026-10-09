import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const files = readdirSync(__dirname).filter((f) => f.endsWith('.json'));
const load = (f: string) => JSON.parse(readFileSync(join(__dirname, f), 'utf8'));

/** PLAN.md §2.3 and §8.7 forbidden words. */
const FORBIDDEN: Array<[string, RegExp]> = [
  ['safe', /\bsafe\b/i], ['unsafe', /\bunsafe\b/i], ['protected', /\b(un)?protected\b/i],
  ['contraception', /\bcontraception\b/i], ['birth control', /\bbirth control\b/i], ['conceive', /\bconcei\w*/i],
  ['fertile today', /\bfertile today\b/i], ['chance of pregnancy', /\bchance of pregnancy\b/i],
  ['risk', /\brisks?\b/i], ['diagnosis', /\bdiagnosis\b/i], ['PCOS', /\bPCOS\b/i], ['endometriosis', /\bendometriosis\b/i],
  ['perimenopause', /\bperimenopaus\w*/i], ['abnormal', /\babnormal\b/i],
  ['ladies', /\bladies\b/i], ['girls', /\bgirls?\b/i], ['feminine', /\bfeminine\b/i], ['womanhood', /\bwomanhood\b/i],
  ['should', /\bshould\b/i], ['normal', /\bnormal\b/i],
];
/** Category labels the user picks for themselves (life-state options) may name the state. Nothing else may. */
const ALLOWED: Record<string, string[]> = {
  'en-AU.json': ['onboarding.s4.options.', 'settings.lifeState.options.'],
};
const ALLOWED_WORDS = ['contraception', 'perimenopause'];

function strings(node: unknown, path = ''): Array<[string, string]> {
  if (typeof node === 'string') return [[path, node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (node && typeof node === 'object')
    return Object.entries(node).flatMap(([k, v]) => (k.startsWith('_') ? [] : strings(v, path ? `${path}.${k}` : k)));
  return [];
}

function violations(file: string, json: unknown): string[] {
  const out: string[] = [];
  for (const [path, text] of strings(json)) {
    const exempt = (ALLOWED[file] ?? []).some((p) => path.startsWith(p));
    for (const [name, re] of FORBIDDEN) {
      if (re.test(text) && !(exempt && ALLOWED_WORDS.includes(name))) out.push(`${file}:${path} contains "${name}"`);
    }
  }
  return out;
}

describe('forbidden-word list (PLAN.md §2.3, §8.7)', () => {
  it('there are copy files to check', () => expect(files.length).toBeGreaterThanOrEqual(5));
  for (const f of files) it(`${f} has no forbidden word`, () => expect(violations(f, load(f))).toEqual([]));
  it('the checker catches violations', () => {
    expect(violations('x.json', { a: 'This day is safe.' })).toHaveLength(1);
    expect(violations('x.json', { a: 'Not a contraception tool' })).toHaveLength(1);
    expect(violations('x.json', { a: 'You should rest' })).toHaveLength(1);
    expect(violations('en-AU.json', { onboarding: { s4: { options: { h: 'Hormonal contraception' } } } })).toEqual([]);
    expect(violations('en-AU.json', { elsewhere: 'Hormonal contraception' })).toHaveLength(1);
  });
  it('life-state exemption does not cover any other forbidden word', () => {
    expect(violations('en-AU.json', { onboarding: { s4: { options: { h: 'safe days' } } } })).toHaveLength(1);
  });
});

describe('fixed regulatory wording (§2.3)', () => {
  const legal = load('legal.en-AU.json');
  it('store listing first paragraph', () =>
    expect(legal.storeFirstParagraph).toBe('Sanguine helps you track and understand your menstrual cycle. It is not a contraceptive and is not a medical device.'));
  it('onboarding purpose', () =>
    expect(legal.onboardingPurpose).toBe('Sanguine estimates when your next period and your ovulation are likely, using what you log. Estimates are ranges, not promises.'));
  it('fertility estimate card', () =>
    expect(legal.estimateCard).toBe('Estimated ovulation around {point} (range {lo}–{hi}). This is for understanding your cycle. Do not use it to prevent pregnancy.'));
  it('about disclaimer', () =>
    expect(legal.aboutDisclaimer).toBe('Sanguine does not diagnose, screen for or treat any condition. If you are worried about your health, talk to a health professional.'));
  it('onboarding step 1 carries the purpose and non-medical statement', () => {
    const s1 = load('en-AU.json').onboarding.s1.body as string;
    expect(s1).toContain(legal.onboardingPurpose);
    expect(s1).toContain(legal.notMedicalDevice);
  });
  it('privacy step uses the three fixed sentences', () =>
    expect(load('en-AU.json').onboarding.s5.title).toBe('Your data stays with you'));
});

describe('health flag copy (§4.10, §11.2)', () => {
  const flags = load('flags.en-AU.json');
  const bodies = Object.entries(flags).filter(([, v]) => typeof v === 'object' && v && 'body' in (v as object)) as Array<[string, { body: string; insightOnly?: boolean }]>;
  it('has a body for every flag', () =>
    expect(bodies.map(([k]) => k).sort()).toEqual(['heavy', 'intermenstrual', 'long', 'longSingle', 'missed', 'missedFrom40', 'prolonged', 'shortLuteal', 'short', 'variability'].sort()));
  for (const [k, v] of bodies) {
    if (v.insightOnly) continue;
    it(`${k} points to a doctor`, () => expect(v.body).toMatch(/doctor/));
  }
});

describe('symptom catalogue (§11.1)', () => {
  const { symptoms } = load('symptoms.json') as { symptoms: Array<{ code: string; label: string; defaultVisible: boolean; affectsPrediction: boolean }> };
  it('has 40 unique codes', () => {
    expect(symptoms).toHaveLength(40);
    expect(new Set(symptoms.map((s) => s.code)).size).toBe(40);
  });
  it('shows exactly the 8 default symptoms', () =>
    expect(symptoms.filter((s) => s.defaultVisible).map((s) => s.code)).toEqual(['cramps', 'headache', 'bloating', 'breast_tenderness', 'mood_low', 'acne', 'fatigue', 'midcycle_spotting']));
  it('no symptom affects a prediction', () => expect(symptoms.every((s) => s.affectsPrediction === false)).toBe(true));
});

describe('placeholders', () => {
  it('every {placeholder} is a simple identifier', () => {
    for (const f of files)
      for (const [path, t] of strings(load(f)))
        for (const m of t.matchAll(/\{([^}]*)\}/g)) expect(m[1], `${f}:${path}`).toMatch(/^[a-zA-Z0-9]+$/);
  });
});

describe('policy drafts use the same word list (P0-10)', () => {
  for (const f of ['privacy-policy.md', 'consumer-health-data-policy.md', 'dpia.md']) {
    const text = readFileSync(join(__dirname, '..', 'docs', f), 'utf8');
    it(`${f} has no forbidden word and is marked DRAFT`, () => {
      expect(text.startsWith('DRAFT, not legal advice')).toBe(true);
      expect(violations('doc', { text })).toEqual([]);
    });
  }
});
