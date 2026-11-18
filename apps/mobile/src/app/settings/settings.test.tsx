// P8-22 (D-124): the settings root and preference screens on the glass kit, and the two new switches from the calendar redesign.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS, type Prefs } from '@/data/prefs';

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
import AppearanceScreen from './appearance';
import HowScreen from './how';
import NotificationsScreen from './notifications';
import TrackingScreen from './tracking';

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
    for (const id of ['rule-dot-ovulation-3', 'rule-dot-period-3', 'rule-dot-period-1']) {
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
  it('names the setting in the off/on drawing label', () => {
    render(<NotificationsScreen />);
    expect(screen.getByTestId('notif-pair').getAttribute('aria-label')).toMatch(/^Show details in notifications\. Off shows: .+\. On shows: /);
  });
});

describe('decorative views are hidden on both platforms', () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(p) && !/\.test\.tsx$/.test(p) ? [p] : []; });
  it('every accessibilityElementsHidden (iOS) comes with importantForAccessibility (Android) in the same tag', () => {
    const bad: string[] = [];
    for (const f of [...files(__dirname), join(__dirname, '..', '(tabs)', 'settings.tsx')]) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/<[A-Za-z.]+\s[^<>]*?accessibilityElementsHidden[^<>]*?\/?>/gs)) if (!m[0].includes('importantForAccessibility')) bad.push(`${f.split('/app/')[1]}: ${m[0].slice(0, 60)}`);
    }
    expect(bad).toEqual([]);
  });
});
