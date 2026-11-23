// P8-22 (D-124): the settings root and preference screens on the glass kit, and the two new switches from the calendar redesign.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS, type Prefs } from '@/data/prefs';
import type { ReminderRule } from '@/features/notifications/plan';

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
const push = vi.hoisted(() => vi.fn());
vi.mock('@/state/app', () => ({ useApp: () => app.state }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push, back: vi.fn() }) }));
vi.mock('@/ui/SubScreen', () => ({ SubScreen: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('react-native-svg', () => ({ default: ({ children, testID, 'aria-hidden': hidden }: { children?: ReactNode; testID?: string; 'aria-hidden'?: boolean }) => <svg role="presentation" data-testid={testID} aria-hidden={hidden}><title>icon</title>{children}</svg>, Path: () => null, Circle: () => null, Rect: () => null, Defs: () => null, LinearGradient: () => null, Stop: () => null }));
vi.mock('@/ui/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/features/settings/lifeState', () => ({ lifeStateHistory: async () => [], currentLifeStates: () => [], choiceOf: () => 'none' }));
vi.mock('@/data/settings', () => ({ getSetting: async (_db: unknown, _k: string, d: unknown) => d, setSetting: async () => undefined }));
vi.mock('@/services/notifications', () => ({ ensurePermission: async () => true, remindersSupported: true }));
vi.mock('@/services/widgets', () => ({ widgetsSupported: true }));
import SettingsRoot from '@/app/(tabs)/settings';
import AppearanceScreen from '@/app/settings/appearance';
import HowScreen from '@/app/settings/how';
import NotificationsScreen from '@/app/settings/notifications';
import TrackingScreen from '@/app/settings/tracking';

const today = '2026-11-18';
const update = vi.fn();
/** react-native-web draws a Switch as a role=switch wrapper around the input: take the first match. */
const switchNamed = (name: string) => { const el = screen.queryAllByRole('switch', { name })[0]; return el?.querySelector('input') ?? el; };
const isOn = (el: HTMLElement) => (el as HTMLInputElement).checked === true;
const setup = (prefs: Partial<Prefs> = {}, profile: Record<string, unknown> = { birthDate: '1990-01-01' }) => {
  app.state = { db: undefined, today, prefs: { ...DEFAULT_PREFS, ...prefs }, profile, version: 0, updatePrefs: update, nextReminder: '2026-11-25', refresh: vi.fn() };
};
beforeEach(() => { update.mockClear(); setup(); });
afterEach(cleanup);

describe('settings root', () => {
  it('draws a round icon on each of the seven rows and keeps their ids', () => {
    render(<SettingsRoot />);
    for (const id of ['life', 'health', 'privacy', 'notifications', 'appearance', 'tracking', 'about']) {
      const row = screen.getByTestId(`settings-${id}`);
      expect(row.querySelector('svg'), id).toBeTruthy();
      // the svg sits directly in SettingsRow's round rose-tinted disc
      expect(row.querySelector('svg')?.parentElement?.style.backgroundColor, id).toBe('rgb(244, 220, 224)');
    }
  });
});

describe('tracking options', () => {
  it('shows "Show uncertain estimates" below the ovulation estimate and writes the pref', () => {
    render(<TrackingScreen />);
    const sw = switchNamed('Show uncertain estimates') as HTMLElement;
    expect(isOn(sw)).toBe(false);
    fireEvent.click(sw);
    expect(update).toHaveBeenCalledWith({ showUncertainEstimates: true });
  });
  it('hides it while the ovulation estimate is off', () => {
    setup({ showOvulationEstimate: false });
    render(<TrackingScreen />);
    expect(switchNamed('Show ovulation estimate')).toBeTruthy();
    expect(switchNamed('Show uncertain estimates')).toBeUndefined();
  });
  it('hides it in teen mode, even when the estimate is unlocked', () => {
    setup({ teenUnlockEstimate: true, showUncertainEstimates: true }, { birthDate: '2011-06-01' });
    render(<TrackingScreen />);
    expect(switchNamed('Show uncertain estimates')).toBeUndefined();
  });
  it('toggles a symptom chip and keeps the catalogue order', () => {
    setup({ symptoms: ['cramps'] });
    render(<TrackingScreen />);
    expect(screen.getByTestId('track-cramps').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId('track-headache'));
    expect(update).toHaveBeenCalledWith({ symptoms: ['cramps', 'headache'] });
  });
});

describe('appearance', () => {
  it('has the "Cycle day on calendar" switch, on by default', () => {
    render(<AppearanceScreen />);
    const sw = switchNamed('Cycle day on calendar') as HTMLElement;
    expect(isOn(sw)).toBe(true);
    fireEvent.click(sw);
    expect(update).toHaveBeenCalledWith({ calendarCycleDay: false });
  });
  it('picks a theme', () => {
    render(<AppearanceScreen />);
    fireEvent.click(screen.getByTestId('theme-dark'));
    expect(update).toHaveBeenCalledWith({ theme: 'dark' });
  });
});

describe('how Sanguine estimates', () => {
  it('names the fertility signals for adults and only the period start under 18', () => {
    render(<HowScreen />);
    expect(screen.getByText('Cervical mucus')).toBeTruthy();
    cleanup();
    setup({}, { birthDate: '2011-06-01' });
    render(<HowScreen />);
    expect(screen.getByText('Every period start')).toBeTruthy();
    expect(screen.queryByText('Cervical mucus')).toBeNull();
    expect(screen.queryByText('Ovulation tests')).toBeNull();
  });
  it('draws the blend bar, the range bar and the accuracy chart, each one image with a text label', () => {
    render(<HowScreen />);
    for (const id of ['how-blend', 'how-range', 'how-accuracy']) {
      const el = screen.getByTestId(id);
      expect(el.getAttribute('role'), id).toBe('img');
      expect(el.getAttribute('aria-label') ?? '', id).not.toBe('');
    }
    expect(screen.getByTestId('how-accuracy').getAttribute('aria-label')).toContain('inside the range twice, just outside it once');
    expect(screen.getAllByText('Drawn to explain, not your own data.')).toHaveLength(3);
  });
  it('splits each confidence word from its rule (the word is the meter label)', () => {
    render(<HowScreen />);
    expect(screen.getByLabelText('Fair estimate')).toBeTruthy();
    expect(screen.getByText('At least two cycles and a period range of up to about 11 days.')).toBeTruthy();
  });
  it('under 18 no drawing or source names ovulation or the fertile window; adults also see the ovulation-test source', () => {
    render(<HowScreen />);
    expect(screen.getByText('Ecochard et al. 2001')).toBeTruthy();
    expect(screen.getByText('Bull et al. 2019, npj Digital Medicine')).toBeTruthy();
    cleanup();
    setup({}, { birthDate: '2011-06-01' });
    const teen = render(<HowScreen />).container;
    expect(screen.getByText('Bull et al. 2019, npj Digital Medicine')).toBeTruthy();
    expect(screen.queryByText('Ecochard et al. 2001')).toBeNull();
    const labels = [...teen.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).join(' ');
    expect(`${teen.textContent} ${labels}`).not.toMatch(/ovulat|fertil/i);
  });
});

describe('notifications', () => {
  it('draws a shape-coded dot on each reminder rule row and an icon on the next-reminder line, both hidden from screen readers', () => {
    render(<NotificationsScreen />);
    for (const id of ['rule-dot-follicularEarly-0', 'rule-dot-ovulation-3', 'rule-dot-lutealEarly-0', 'rule-dot-period-3', 'rule-dot-period-1']) {
      expect(screen.getByTestId(id).getAttribute('aria-hidden'), id).toBe('true');
    }
    expect(screen.getByTestId('notif-next-icon').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('notif-next').textContent).toContain('Next reminder');
  });
  it('under 18 draws no ovulation rule dots', () => {
    setup({}, { birthDate: '2011-06-01' });
    render(<NotificationsScreen />);
    expect(screen.queryByTestId('rule-dot-ovulation-3')).toBeNull();
    expect(screen.getByTestId('rule-dot-period-3')).toBeTruthy();
  });
  it('under 18 the phase rules and chips stay while ovulation goes', () => {
    setup({}, { birthDate: '2011-06-01' });
    render(<NotificationsScreen />);
    expect(screen.getByTestId('rule-dot-follicularEarly-0').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('rule-dot-lutealEarly-0').getAttribute('aria-hidden')).toBe('true');
    for (const e of ['follicularEarly', 'follicularLate', 'lutealEarly', 'lutealLate']) expect(screen.getByTestId(`rule-event-${e}`), e).toBeTruthy();
    expect(screen.queryByTestId('rule-event-ovulation')).toBeNull();
    expect(screen.queryByTestId('rule-dot-ovulation-3')).toBeNull();
  });
  it('adds a phase reminder with own words and saves the text on the rule', () => {
    render(<NotificationsScreen />);
    fireEvent.click(screen.getByTestId('rule-days-0'));
    fireEvent.click(screen.getByTestId('rule-event-lutealLate'));
    fireEvent.change(screen.getByTestId('rule-own-text'), { target: { value: '  Be kind to yourself ' } });
    fireEvent.click(screen.getByTestId('rule-add'));
    const saved = update.mock.calls.at(-1)?.[0].notifications.rules.find((r: { event: string }) => r.event === 'lutealLate');
    expect(saved).toMatchObject({ days: 0, event: 'lutealLate', text: 'Be kind to yourself' });
    expect((screen.getByTestId('rule-own-text') as HTMLInputElement).value).toBe('');
  });
  it('adds a rule without own words with no text key', () => {
    render(<NotificationsScreen />);
    fireEvent.click(screen.getByTestId('rule-days-0'));
    fireEvent.click(screen.getByTestId('rule-event-lutealLate'));
    fireEvent.click(screen.getByTestId('rule-add'));
    const saved = update.mock.calls.at(-1)?.[0].notifications.rules.find((r: { event: string }) => r.event === 'lutealLate');
    expect('text' in saved).toBe(false);
  });
  it('shows a rule\'s own words, edits them, and clears them without leaving a text key', () => {
    const rules: ReminderRule[] = [{ id: 'a', days: 0, event: 'lutealLate', text: 'Be kind to yourself' }, { id: 'b', days: 3, event: 'period' }];
    setup({ notifications: { ...DEFAULT_PREFS.notifications, rules } });
    render(<NotificationsScreen />);
    expect(screen.getByTestId('rule-text-lutealLate-0').textContent).toBe('Your words: Be kind to yourself');
    expect(screen.queryByTestId('rule-text-period-3')).toBeNull();
    fireEvent.click(screen.getByTestId('rule-edit-lutealLate-0'));
    expect((screen.getByTestId('rule-edit-field-lutealLate-0') as HTMLInputElement).value).toBe('Be kind to yourself');
    fireEvent.change(screen.getByTestId('rule-edit-field-lutealLate-0'), { target: { value: ' Rest well ' } });
    fireEvent.click(screen.getByTestId('rule-save-lutealLate-0'));
    expect(update.mock.calls.at(-1)?.[0].notifications.rules).toEqual([{ id: 'a', days: 0, event: 'lutealLate', text: 'Rest well' }, rules[1]]);
    expect(screen.queryByTestId('rule-edit-field-lutealLate-0')).toBeNull();
    fireEvent.click(screen.getByTestId('rule-edit-lutealLate-0'));
    fireEvent.click(screen.getByTestId('rule-clear-lutealLate-0'));
    const cleared = update.mock.calls.at(-1)?.[0].notifications.rules[0];
    expect(cleared).toEqual({ id: 'a', days: 0, event: 'lutealLate' });
    expect('text' in cleared).toBe(false);
    fireEvent.click(screen.getByTestId('rule-edit-lutealLate-0'));
    fireEvent.change(screen.getByTestId('rule-edit-field-lutealLate-0'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('rule-save-lutealLate-0'));
    expect('text' in (update.mock.calls.at(-1)?.[0].notifications.rules[0] ?? { text: 1 })).toBe(false);
  });
  it('the drawing shows the feeling check-in for a phase sample and "A reminder" for a period sample', () => {
    render(<NotificationsScreen />); // the first default rule is early follicular
    expect(screen.getByTestId('notif-pair').getAttribute('aria-label')).toContain('Off shows: How are you feeling today?');
    cleanup();
    setup({ notifications: { ...DEFAULT_PREFS.notifications, rules: [{ id: 'p', days: 3, event: 'period' }] } });
    render(<NotificationsScreen />);
    expect(screen.getByTestId('notif-pair').getAttribute('aria-label')).toContain('Off shows: A reminder');
  });
  it('the own-text fields show the built-in text as their placeholder, following the details switch', () => {
    render(<NotificationsScreen />);
    expect(screen.getByTestId('rule-own-text').getAttribute('placeholder')).toBe('A reminder');
    fireEvent.click(screen.getByTestId('rule-edit-follicularEarly-0'));
    expect(screen.getByTestId('rule-edit-field-follicularEarly-0').getAttribute('placeholder')).toBe('How are you feeling today?');
    cleanup();
    setup({ notifications: { ...DEFAULT_PREFS.notifications, descriptive: true } });
    render(<NotificationsScreen />);
    fireEvent.click(screen.getByTestId('rule-edit-follicularEarly-0'));
    expect(screen.getByTestId('rule-edit-field-follicularEarly-0').getAttribute('placeholder')).toBe('Your follicular phase has likely started. How are you feeling?');
  });
  it('names the setting in the off/on drawing label', () => {
    render(<NotificationsScreen />);
    expect(screen.getByTestId('notif-pair').getAttribute('aria-label')).toMatch(/^Show details in notifications\. Off shows: .+\. On shows: /);
  });
});

describe('P8-32 details of the frames', () => {
  it('appearance: only the middle day of the cycle-day preview carries the today ring', () => {
    render(<AppearanceScreen />);
    expect(screen.getByTestId('preview-day-2').style.boxShadow).toMatch(/0 0 0 4px/);
    expect(screen.getByTestId('preview-day-1').style.boxShadow ?? '').toBe('');
    expect(screen.getByTestId('preview-day-3').style.boxShadow ?? '').toBe('');
  });
  it('notifications: "Your reminders" and "Widgets" are 15 pt semibold headings, not 18 pt', () => {
    render(<NotificationsScreen />);
    for (const name of ['Your reminders', 'Widgets']) {
      const h = screen.getByRole('heading', { name });
      expect(h.style.fontSize, name).toBe('15px');
      expect(h.style.fontWeight, name).toBe('600');
    }
  });
  it('how: card headings are 17 pt, and the two sentences resting on a source carry its number', () => {
    render(<HowScreen />);
    expect(screen.getByRole('heading', { name: 'Where the period range comes from' }).style.fontSize).toBe('17px');
    expect(screen.getByRole('heading', { name: 'Sources' }).style.fontSize).toBe('17px');
    // the number follows "(Bull et al. 2019)" in the middle of the paragraph and the fertile-window sentence ends with source 2
    expect(screen.getByLabelText('Source 1').previousSibling?.textContent ?? '').toMatch(/\(Bull et al\. 2019\)$/);
    expect(screen.getByLabelText('Source 2').parentElement?.textContent ?? '').toMatch(/fertile window estimate\.²$/);
    cleanup();
    setup({}, { birthDate: '2011-06-01' });
    render(<HowScreen />);
    expect(screen.getByLabelText('Source 1')).toBeTruthy();
    expect(screen.queryByLabelText('Source 2')).toBeNull();
  });
});

describe('decorative views are hidden on both platforms', () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(p) && !/\.test\.tsx$/.test(p) ? [p] : []; });
  it('every accessibilityElementsHidden (iOS) comes with importantForAccessibility (Android) in the same tag', () => {
    const bad: string[] = [];
    for (const f of [...files(join(__dirname, '..', '..', 'app', 'settings')), join(__dirname, '..', '..', 'app', '(tabs)', 'settings.tsx')]) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/<[A-Za-z.]+\s[^<>]*?accessibilityElementsHidden[^<>]*?\/?>/gs)) if (!m[0].includes('importantForAccessibility')) bad.push(`${f.split('/app/')[1]}: ${m[0].slice(0, 60)}`);
    }
    expect(bad).toEqual([]);
  });
});
