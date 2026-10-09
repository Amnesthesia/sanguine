import { describe, expect, it } from 'vitest';
import { defaultTempUnit, pickLocale, pickTranslated, weekdayLabels, weekStartFrom } from './locale';

describe('pickLocale', () => {
  it('maps the English regions we ship and falls back to en-AU', () => {
    expect(pickLocale(['en-US'])).toBe('en-US');
    expect(pickLocale(['en_US'])).toBe('en-US');
    expect(pickLocale(['en-GB'])).toBe('en-GB');
    expect(pickLocale(['en-IE'])).toBe('en-GB');
    expect(pickLocale(['en-AU'])).toBe('en-AU');
    expect(pickLocale(['en-NZ'])).toBe('en-AU');
    expect(pickLocale(['en'])).toBe('en-AU');
    expect(pickLocale([])).toBe('en-AU');
  });
  it('skips languages we do not ship and uses the first English tag', () => {
    expect(pickLocale(['de-DE', 'en-US', 'en-GB'])).toBe('en-US');
    expect(pickLocale(['de-DE', 'fr-FR'])).toBe('en-AU');
  });
  it('reads a script subtag before the region', () => expect(pickLocale(['en-Latn-US'])).toBe('en-US'));
});

describe('defaults from the locale', () => {
  it('uses Fahrenheit only for en-US', () => {
    expect(defaultTempUnit('en-US')).toBe('F');
    expect(defaultTempUnit('en-GB')).toBe('C');
    expect(defaultTempUnit('en-AU')).toBe('C');
  });
  it('starts the week on Sunday only when the device does', () => {
    expect(weekStartFrom(1)).toBe('sun');
    expect(weekStartFrom(2)).toBe('mon');
    expect(weekStartFrom(7)).toBe('mon');
    expect(weekStartFrom(undefined)).toBe('mon');
  });
  it('reorders the weekday labels', () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    expect(weekdayLabels(days, 'mon')).toEqual(days);
    expect(weekdayLabels(days, 'sun')).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });
});

describe('pickTranslated', () => {
  const have = ['de', 'pt-BR'];
  it('uses an exact tag, then the bare language, in the user\'s order', () => {
    expect(pickTranslated(['pt-BR'], have)).toBe('pt-BR');
    expect(pickTranslated(['de-AT'], have)).toBe('de');
    expect(pickTranslated(['fr-FR', 'de-DE'], have)).toBe('de');
  });
  it('does not stretch pt-PT to pt-BR and returns null when nothing matches', () => {
    expect(pickTranslated(['pt-PT'], have)).toBeNull();
    expect(pickTranslated(['en-US'], have)).toBeNull();
    expect(pickTranslated(['de'], [])).toBeNull();
  });
});
