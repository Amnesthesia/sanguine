// PLAN.md §2.4, §8.6, §11.1: under 18 the app hides fertility tools and language by default. One place that checks every surface.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addDays, type EngineSettings, type History, predict } from '@sanguine/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, effectivePrefs } from '@/data/prefs';
import { buildToday } from '@/features/today/todayModel';
import { calendarLegend } from '@/features/calendar/calendarModel';
import { healthRows } from '@/features/health/healthModel';
import { moreRows } from '@/features/logging/moreRows';
import { calendarRanges } from '@/features/share/ics';

const today = '2026-10-09';
const teenProfile = { birthDate: '2010-10-10' }; // 15, and 16 tomorrow
const adultProfile = { birthDate: '2008-10-09' }; // 18 today
const eff = (profile: { birthDate: string }, over: Partial<typeof DEFAULT_PREFS> = {}) => effectivePrefs({ ...DEFAULT_PREFS, ...over }, profile, today);

describe('who is a teen', () => {
  it('is under 18 on today\'s date, and not from the 18th birthday', () => {
    expect(eff(teenProfile).teen).toBe(true);
    expect(eff(adultProfile).teen).toBe(false);
  });
});

describe('fertility tools', () => {
  it('are off for a teen until they unlock them, on for an adult', () => {
    expect(eff(teenProfile).fertilityTools).toBe(false);
    expect(eff(teenProfile, { teenUnlockEstimate: true }).fertilityTools).toBe(true);
    expect(eff(adultProfile).fertilityTools).toBe(true);
    expect(eff(adultProfile, { showOvulationEstimate: false }).fertilityTools).toBe(true); // an adult who hides the card still logs tests
  });
  it('the estimate card follows the same unlock', () => {
    expect(eff(teenProfile).showOvulationEstimate).toBe(false);
    expect(eff(teenProfile, { teenUnlockEstimate: true }).showOvulationEstimate).toBe(true);
  });
});

describe('surfaces', () => {
  it('the logging sheet offers no ovulation test, mucus or cervix rows to a teen, and no sex row unless turned on', () => {
    const ids = (e: ReturnType<typeof eff>) => moreRows(e).map((r) => r.id);
    expect(ids(eff(teenProfile))).not.toEqual(expect.arrayContaining(['lh']));
    expect(ids(eff(teenProfile))).toEqual(['temperature', 'note']);
    expect(ids(eff(adultProfile))).toEqual(['temperature', 'lh', 'mucus', 'note', 'cervix']);
    expect(ids(eff(adultProfile, { sexLogging: true }))).toContain('sex');
  });
  it('the calendar legend names no fertile window or ovulation when the estimate is hidden', () => {
    expect(calendarLegend(false)).toEqual(['period', 'predicted', 'logged']);
    expect(calendarLegend(true)).toEqual(['period', 'predicted', 'fertile', 'ovulation', 'logged']);
  });
  it('Health sync does not offer ovulation tests or cervical mucus to a teen, and words wrist temperature without fertility terms', () => {
    const types = (fertilityTools: boolean) => healthRows({ teen: !fertilityTools, sexLogging: false, fertilityTools }).map((r) => r.type);
    expect(types(false)).not.toContain('lh');
    expect(types(false)).not.toContain('mucus');
    expect(types(true)).toEqual(expect.arrayContaining(['lh', 'mucus']));
    expect(healthRows({ teen: true, sexLogging: false, fertilityTools: false }).find((r) => r.type === 'skin_temp')?.bodyKey).toBe('settings.health.types.skin_temp.bodyTeen');
  });
  it('Today shows no ovulation card and no fertile band when the estimate is hidden', () => {
    const S: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };
    const starts = ['2026-07-06', '2026-08-03', '2026-09-01', '2026-10-01'];
    const h: History = { cycles: starts.map((st, i) => ({ id: `c${i}`, start: st, end: addDays(st, 4), quality: 'valid' as const })), temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
    const m = buildToday({ prediction: predict(h, S, '2026-10-10'), hasCycles: true, today: '2026-10-10', showEstimate: false, todayFlow: undefined });
    expect(m.estimate).toBeUndefined();
    expect(JSON.stringify(m)).not.toMatch(/ovulation/i);
    expect((m.ring as { fertile?: unknown[] }).fertile ?? []).toEqual([]);
    const shown = buildToday({ prediction: predict(h, S, '2026-10-10'), hasCycles: true, today: '2026-10-10', showEstimate: true, todayFlow: undefined });
    expect(shown.estimate).toBeDefined(); // the same data does show it for an adult
  });
});

describe('calendar export (P8-2, D-079)', () => {
  it('offers no fertile range when the estimate is hidden (teen until unlocked), even if asked', () => {
    const S: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };
    const starts = ['2026-07-06', '2026-08-03', '2026-09-01', '2026-10-01'];
    const h: History = { cycles: starts.map((st, i) => ({ id: `c${i}`, start: st, end: addDays(st, 4), quality: 'valid' as const })), temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
    const p = predict(h, S, '2026-10-10');
    expect(calendarRanges(p, { fertile: eff(teenProfile).showOvulationEstimate }).fertile).toBeUndefined();
    expect(calendarRanges(p, { fertile: eff(adultProfile).showOvulationEstimate }).fertile).toBeDefined(); // the same data does for an adult
  });
});

describe('every surface reads the teen rules', () => {
  const root = join(__dirname, '..', '..');
  const read = (p: string) => readFileSync(join(root, p), 'utf8');
  it.each([
    ['app/(tabs)/today.tsx', 'effectivePrefs'],
    ['app/(tabs)/calendar.tsx', 'effectivePrefs'],
    ['app/(tabs)/insights.tsx', 'fertilityTools'],
    ['app/cycle/[id].tsx', 'fertilityTools'],
    ['features/logging/MoreSection.tsx', 'moreRows'],
    ['app/settings/health.tsx', 'fertilityTools'],
    ['app/_layout.tsx', 'isTeen'],
    ['app/settings/about.tsx', 'isTeen'],
    ['app/settings/how.tsx', 'fertilityTools'],
    ['app/settings/report.tsx', 'fertilityTools'],
    ['app/settings/notifications.tsx', 'showOvulationEstimate'],
    ['app/settings/calendar.tsx', 'effectivePrefs(prefs, profile, today).showOvulationEstimate'],
  ])('%s uses %s', (file, word) => expect(read(file)).toContain(word));
});
