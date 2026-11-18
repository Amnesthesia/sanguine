// P8-22 (D-124): the settings root and preference screens on the glass kit, and the two new switches from the calendar redesign.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS, type Prefs } from '@/data/prefs';

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
const push = vi.hoisted(() => vi.fn());
vi.mock('@/state/app', () => ({ useApp: () => app.state }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push, back: vi.fn() }) }));
vi.mock('@/ui/SubScreen', () => ({ SubScreen: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('react-native-svg', () => ({ default: ({ children }: { children?: ReactNode }) => <svg role="presentation"><title>icon</title>{children}</svg>, Path: () => null, Circle: () => null, Rect: () => null }));
vi.mock('@/ui/Screen', () => ({ Screen: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/features/settings/lifeState', () => ({ lifeStateHistory: async () => [], currentLifeStates: () => [], choiceOf: () => 'none' }));
import SettingsRoot from '@/app/(tabs)/settings';
import AppearanceScreen from './appearance';
import HowScreen from './how';
import TrackingScreen from './tracking';

const today = '2026-11-18';
const update = vi.fn();
/** react-native-web draws a Switch as a role=switch wrapper around the input: take the first match. */
const switchNamed = (name: string) => { const el = screen.queryAllByRole('switch', { name })[0]; return el?.querySelector('input') ?? el; };
const isOn = (el: HTMLElement) => (el as HTMLInputElement).checked === true;
const setup = (prefs: Partial<Prefs> = {}, profile: Record<string, unknown> = { birthDate: '1990-01-01' }) => {
  app.state = { db: undefined, today, prefs: { ...DEFAULT_PREFS, ...prefs }, profile, version: 0, updatePrefs: update };
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
});
