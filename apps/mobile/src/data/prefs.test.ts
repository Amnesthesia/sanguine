import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, DEFAULT_SYMPTOMS, effectivePrefs, isTeen, loadPrefs, savePrefs } from './prefs';
import { migrate } from './migrate';
import { getSetting, setSetting } from './settings';
import { openTestDb } from './testDb';

describe('settings', () => {
  it('round-trips JSON values with a fallback', async () => {
    const db = openTestDb();
    await migrate(db);
    expect(await getSetting(db, 'x', { a: 1 })).toEqual({ a: 1 });
    await setSetting(db, 'x', { a: 2 });
    await setSetting(db, 'x', { a: 3 });
    expect(await getSetting(db, 'x', { a: 1 })).toEqual({ a: 3 });
  });
});

describe('prefs', () => {
  it('defaults are the most private option and the 8 default symptoms', () => {
    expect(DEFAULT_SYMPTOMS).toEqual(['cramps', 'headache', 'bloating', 'breast_tenderness', 'mood_low', 'acne', 'fatigue', 'midcycle_spotting']);
    expect(DEFAULT_PREFS.sexLogging).toBe(false);
    expect(DEFAULT_PREFS.notifications).toMatchObject({ enabled: true, late: true, descriptive: false }); // owner, D-090; text stays discreet
    expect(DEFAULT_PREFS.notifications.rules.map((x) => [x.days, x.event])).toEqual([[3, 'ovulation'], [3, 'period'], [1, 'period']]);
    expect(DEFAULT_PREFS.appLock).toBe(false); // D-073: the owner chose no Face ID at launch unless asked for
  });
  it('load merges saved values over defaults', async () => {
    const db = openTestDb();
    await migrate(db);
    expect(await loadPrefs(db)).toEqual(DEFAULT_PREFS);
    await savePrefs(db, { ...DEFAULT_PREFS, theme: 'dark', notifications: { ...DEFAULT_PREFS.notifications, enabled: false, descriptive: true } });
    expect(await loadPrefs(db)).toMatchObject({ theme: 'dark', notifications: { enabled: false, descriptive: true, late: true }, tempUnit: 'C' });
  });
  it('a phone that saved the one reminder switch before D-090 keeps its choice and gets the default rules', async () => {
    const db = openTestDb();
    await migrate(db);
    await setSetting(db, 'prefs', { notifications: { period: false, descriptive: true } });
    const n = (await loadPrefs(db)).notifications;
    expect(n).toMatchObject({ enabled: false, descriptive: true, late: true });
    expect(n.rules).toHaveLength(3);
    expect('period' in n).toBe(false);
  });
  it('teen mode (13-17) hides the ovulation estimate until unlocked; adults follow the preference', () => {
    const today = '2026-10-09';
    expect(isTeen({ birthYear: 2012 }, today)).toBe(true);
    expect(isTeen({ birthYear: 2008 }, today)).toBe(false);
    expect(isTeen({}, today)).toBe(false);
    expect(isTeen({ birthDate: '2008-10-10', birthYear: 2008 }, today)).toBe(true); // 17 until tomorrow
    expect(effectivePrefs(DEFAULT_PREFS, { birthYear: 2012 }, today).showOvulationEstimate).toBe(false);
    expect(effectivePrefs({ ...DEFAULT_PREFS, teenUnlockEstimate: true }, { birthYear: 2012 }, today).showOvulationEstimate).toBe(true);
    expect(effectivePrefs(DEFAULT_PREFS, { birthYear: 1990 }, today).showOvulationEstimate).toBe(true);
    expect(effectivePrefs({ ...DEFAULT_PREFS, showOvulationEstimate: false }, { birthYear: 1990 }, today).showOvulationEstimate).toBe(false);
  });
});
