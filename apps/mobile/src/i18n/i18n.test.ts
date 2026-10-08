import { describe, expect, it } from 'vitest';
import i18n from './index';

describe('i18n', () => {
  it('resolves nested keys and interpolates {placeholders}', () => {
    expect(i18n.t('tabs.today')).toBe('Today');
    expect(i18n.t('today.periodLikely', { lo: 3, hi: 8 })).toBe('Period likely in 3–8 days');
    expect(i18n.t('legal.estimateCard', { point: '14 Nov', lo: '12 Nov', hi: '17 Nov' })).toBe(
      'Estimated ovulation around 14 Nov (range 12 Nov–17 Nov). This is for understanding your cycle. Do not use it to prevent pregnancy.',
    );
    expect(i18n.t('symptom.breast_tenderness')).toBe('Breast tenderness');
  });
  it('every key used by the UI exists (no key echoes back)', () => {
    for (const k of ['common.done', 'log.flowLevels.medium', 'onboarding.s1.title', 'settings.about.title', 'flags.long.body']) expect(i18n.t(k)).not.toBe(k);
  });
});
