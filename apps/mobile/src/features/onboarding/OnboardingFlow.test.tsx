import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessibilityInfo, Keyboard } from 'react-native';
import { colors } from '@sanguine/ui-tokens';
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
  it('the step title is 28 pt bold, as the frames draw it', async () => {
    render(<OnboardingFlow />);
    await act(async () => {});
    const h = screen.getByRole('heading', { name: 'Track and understand your cycle' });
    expect(h.style.fontSize).toBe('28px');
    expect(h.style.fontWeight).toBe('700');
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
  it('Skip and the finish hint are drawn in the glass text colour, not the accent', async () => {
    render(<OnboardingFlow />);
    await act(async () => {});
    next(); next(); // step 3: Skip shows
    const ink = (el: HTMLElement) => getComputedStyle(el).color;
    const probe = document.createElement('i');
    probe.style.color = colors.light.textOnGlass;
    const want = probe.style.color;
    expect(ink(screen.getByText('Skip'))).toBe(want);
    next(); next(); // step 5: the hint shows
    expect(ink(screen.getByTestId('finish-hint'))).toBe(want);
  });
  it('"Another date" swaps the date note for the date row (the frame draws no note); the other choices keep the note', async () => {
    render(<OnboardingFlow />);
    await act(async () => {});
    next(); next(); // step 3
    const empty = screen.getByText('No problem. Log your next period to start.'); // nothing chosen yet
    expect(empty.getAttribute('aria-live')).toBe('polite');
    tap('last-today');
    expect(screen.queryByText('No problem. Log your next period to start.')).toBeNull();
    expect(screen.getByText('Last period started 2 November 2026')).toBeTruthy();
    expect(screen.queryByTestId('last-date')).toBeNull();
    tap('last-other');
    expect(screen.getByTestId('last-date')).toBeTruthy();
    expect(screen.queryByText(/Last period started \d/)).toBeNull(); // no note line; the row label is the only "Last period started"
    expect(screen.getAllByText('Last period started')).toHaveLength(1);
  });
  it('the footer rides above the keyboard and drops back to the safe-area edge when it goes', async () => {
    const handlers = new Map<string, (e: { endCoordinates: { height: number } }) => void>();
    vi.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, fn: never) => { handlers.set(name, fn); return { remove: () => handlers.delete(name) }; }) as never);
    render(<OnboardingFlow />);
    await act(async () => {});
    const bottom = () => screen.getByTestId('onboarding-footer').style.bottom;
    expect(bottom()).toBe('18px'); // safe-area bottom 10 + 8
    const show = handlers.get('keyboardWillShow') ?? handlers.get('keyboardDidShow');
    act(() => show?.({ endCoordinates: { height: 300 } }));
    expect(bottom()).toBe('308px'); // keyboard 300 + 8: the safe-area term is inside the keyboard height
    act(() => (handlers.get('keyboardWillHide') ?? handlers.get('keyboardDidHide'))?.({ endCoordinates: { height: 0 } }));
    expect(bottom()).toBe('18px');
  });
});
