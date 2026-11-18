import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
vi.mock('react-native-svg', () => ({ default: () => null, Path: () => null, Rect: () => null }));
vi.mock('@/services/lockAuth', () => ({ deviceHasLock: () => Promise.resolve(true), authenticate: vi.fn().mockResolvedValue(false) }));
const app = vi.hoisted(() => ({ state: { status: 'ready', onboarded: true, prefs: { appLock: true } } }));
vi.mock('@/state/app', () => ({ useApp: (sel: (s: unknown) => unknown) => sel(app.state) }));
import { useLock } from '@/state/lock';
import { LockGate } from './LockGate';

const gate = (child: ReactNode = <span>content</span>) => render(<LockGate>{child}</LockGate>);
beforeEach(() => {
  useLock.setState({ locked: false, decided: false, failed: false, prompting: false, unlockedThisSession: false, backgroundedAt: undefined, available: undefined });
});
afterEach(cleanup);

describe('LockGate', () => {
  it('covers the app with the lock screen: title, explanation, one Unlock', async () => {
    gate();
    await act(async () => {});
    expect(screen.getByTestId('lock-screen')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sanguine is locked' })).toBeTruthy();
    expect(screen.getByText(/lock Sanguine with Face ID/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Unlock' })).toHaveLength(1);
  });
  it('a failed or cancelled attempt shows the message in a live region and Unlock asks again', async () => {
    gate();
    await act(async () => {});
    const msg = screen.getByText('Could not unlock. Try again.');
    expect(msg.getAttribute('aria-live')).toBe('polite');
    const { authenticate } = await import('@/services/lockAuth');
    (authenticate as ReturnType<typeof vi.fn>).mockClear();
    await act(async () => { fireEvent.click(screen.getByTestId('unlock-button')); });
    expect(authenticate).toHaveBeenCalledTimes(1);
  });
  it('before the first decision the content stays under a blank cover', () => {
    gate();
    expect(screen.getByTestId('lock-pending')).toBeTruthy();
    expect(screen.queryByTestId('lock-screen')).toBeNull();
  });
  it('the lock glyph is decorative: hidden from screen readers', async () => {
    gate();
    await act(async () => {});
    expect(screen.getByTestId('lock-glyph').getAttribute('aria-hidden')).toBe('true');
  });
});
