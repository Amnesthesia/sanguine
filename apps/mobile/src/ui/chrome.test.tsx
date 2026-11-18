import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { AccessibilityInfo } from 'react-native';
import '@/i18n';
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 0 }), SafeAreaView: ({ children }: { children: ReactNode }) => children }));
vi.mock('expo-router', () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock('react-native-svg', () => ({ default: () => null, Path: () => null }));
vi.mock('expo-glass-effect', () => ({ GlassView: ({ children }: { children: ReactNode }) => children, isLiquidGlassAvailable: () => true, isGlassEffectAPIAvailable: () => true }));
vi.mock('expo-blur', () => ({ BlurView: ({ children }: { children: ReactNode }) => children }));
import { ToastHost, showToast } from './Toast';
import { SubScreen } from './SubScreen';
beforeEach(() => {
  Object.assign(AccessibilityInfo, { isReduceTransparencyEnabled: vi.fn().mockResolvedValue(true), addEventListener: vi.fn(() => ({ remove: vi.fn() })) });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('offers an action for six seconds, announces it, and consumes it once', () => {
  vi.useFakeTimers();
  const announce = vi.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  const undo = vi.fn();
  render(<ToastHost />);
  act(() => showToast('Removed', { label: 'Undo', onPress: undo }));
  expect(announce).toHaveBeenCalledWith('Removed, Undo available');
  act(() => vi.advanceTimersByTime(4000));
  const button = screen.getByRole('button', { name: 'Undo' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(undo).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Removed')).toBeNull();
  act(() => showToast('Removed', { label: 'Undo', onPress: undo }));
  act(() => vi.advanceTimersByTime(6000));
  expect(screen.queryByText('Removed')).toBeNull();
});
it('keeps message-only toasts dismissible and expires them at four seconds', () => {
  vi.useFakeTimers();
  render(<ToastHost />);
  act(() => showToast('Saved'));
  fireEvent.click(screen.getByRole('button', { name: 'Saved' }));
  expect(screen.queryByText('Saved')).toBeNull();
  act(() => showToast('Saved'));
  act(() => vi.advanceTimersByTime(3999));
  expect(screen.getByText('Saved')).toBeTruthy();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByText('Saved')).toBeNull();
});
it('keeps the pushed screen Back label', () => {
  render(<SubScreen title="Details" testID="details"><span>Content</span></SubScreen>);
  expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
});
