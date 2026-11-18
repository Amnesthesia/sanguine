import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessibilityInfo } from 'react-native';
import '@/i18n';
const mocks = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), region: 'AU' as string | null, state: {} as Record<string, unknown> }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 10 }), SafeAreaView: ({ children }: { children: ReactNode }) => children }));
vi.mock('expo-router', () => ({ useRouter: () => ({ back: vi.fn(), replace: mocks.replace, push: mocks.push }) }));
vi.mock('react-native-svg', () => ({ default: () => null, Path: () => null, Circle: () => null, Rect: () => null }));
vi.mock('expo-glass-effect', () => ({ GlassView: ({ children }: { children: ReactNode }) => children, isLiquidGlassAvailable: () => true, isGlassEffectAPIAvailable: () => true }));
vi.mock('expo-blur', () => ({ BlurView: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/ui/DateField', () => ({ DateField: ({ testID, value, onChange }: { testID?: string; value: string; onChange: (v: string) => void }) => <button type="button" data-testid={testID} onClick={() => onChange('2015-06-08')}>{value}</button> }));
vi.mock('@/services/clock', () => ({ deviceClock: { iso: () => '2026-11-02T00:00:00Z' }, todayLocal: () => '2026-11-02' }));
vi.mock('@/services/lockAuth', () => ({ deviceHasLock: () => Promise.resolve(true) }));
vi.mock('@/services/locale', () => ({ deviceRegion: () => mocks.region }));
vi.mock('@/data/consent', () => ({ consentRequirement: (r: string | null) => (r === 'DE' ? 'explicit' : 'standard'), recordConsent: vi.fn() }));
vi.mock('@/state/app', () => ({ useApp: (sel: (s: unknown) => unknown) => sel(mocks.state) }));
import { OnboardingFlow } from './OnboardingFlow';

const store = { setProfile: vi.fn(), appendMany: vi.fn() };
const tap = (id: string) => fireEvent.click(screen.getByTestId(id));
const next = () => tap('onboarding-continue');
beforeEach(() => {
  mocks.region = 'AU';
  Object.assign(AccessibilityInfo, { isReduceTransparencyEnabled: vi.fn().mockResolvedValue(true), addEventListener: vi.fn(() => ({ remove: vi.fn() })) });
  mocks.state = { store, db: undefined, refresh: vi.fn().mockResolvedValue(undefined), completeOnboarding: vi.fn().mockResolvedValue(undefined) };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('OnboardingFlow on the glass chrome', () => {
  it('step one: no Back, no Skip, progress on the platter, one Continue', async () => {
    render(<OnboardingFlow />);
    await act(async () => {});
    expect(screen.getByLabelText('Step 1 of 5')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-back')).toBeNull();
    expect(screen.queryByTestId('onboarding-skip')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Continue' })).toHaveLength(1);
  });
  it('Skip shows on the two optional steps only, with a label that says what it skips', async () => {
    render(<OnboardingFlow />);
    await act(async () => {});
    next(); // 2
    expect(screen.queryByTestId('onboarding-skip')).toBeNull();
    next(); // 3
    expect(screen.getByLabelText('Skip this question')).toBeTruthy();
    next(); // 4
    expect(screen.getByLabelText('Skip this question')).toBeTruthy();
    next(); // 5
    expect(screen.queryByTestId('onboarding-skip')).toBeNull();
    expect(screen.getByLabelText('Step 5 of 5')).toBeTruthy();
    tap('onboarding-back');
    expect(screen.getByLabelText('Step 4 of 5')).toBeTruthy();
  });
  it('age gate: under 13 shows the message and blocks Continue', async () => {
    render(<OnboardingFlow />);
    await act(async () => {});
    next();
    tap('birth-date'); // the stub picks 8 Jun 2015
    expect(screen.getByTestId('birth-error').textContent).toContain('aged 13 and over');
    expect(screen.getByTestId('onboarding-continue').getAttribute('aria-disabled')).toBe('true');
  });
  it('last step: the hint sits in the glass footer until the acknowledgement is ticked, then Finish writes and leaves', async () => {
    render(<OnboardingFlow />);
    await act(async () => {});
    next(); next(); next(); next();
    expect(screen.getByTestId('finish-hint')).toBeTruthy();
    expect(screen.getByTestId('onboarding-continue').getAttribute('aria-disabled')).toBe('true');
    tap('consent');
    expect(screen.queryByTestId('finish-hint')).toBeNull();
    await act(async () => { next(); });
    expect(store.setProfile).toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith('/today');
  });
  it('explicit-consent regions need the second agreement too', async () => {
    mocks.region = 'DE';
    render(<OnboardingFlow />);
    await act(async () => {});
    next(); next(); next(); next();
    tap('consent');
    expect(screen.getByTestId('onboarding-continue').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('finish-hint')).toBeTruthy();
    tap('consent-explicit');
    expect(screen.getByTestId('onboarding-continue').getAttribute('aria-disabled')).not.toBe('true');
    expect(screen.getByTestId('consent-explicit').getAttribute('aria-checked')).toBe('true');
  });
  it('postpartum shows the date and breastfeeding rows; the health and backup offers keep their notes', async () => {
    render(<OnboardingFlow />);
    await act(async () => {});
    next(); next(); next();
    tap('life-postpartum');
    expect(screen.getByTestId('state-date')).toBeTruthy();
    expect(screen.getByTestId('breastfeeding')).toBeTruthy();
    next();
    tap('health-offer');
    expect(screen.getByTestId('health-note')).toBeTruthy();
    tap('backup-offer');
    expect(screen.getByTestId('backup-note')).toBeTruthy();
  });
});
