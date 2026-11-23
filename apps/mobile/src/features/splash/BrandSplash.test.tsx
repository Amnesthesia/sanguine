import { act, cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { BrandSplash } from './BrandSplash';

vi.mock('react-native-svg', () => ({ default: ({ children }: { children?: ReactNode }) => <>{children}</>, Path: () => null }));

afterEach(cleanup);

describe('BrandSplash', () => {
  it('shows the lock-up and the tagline, then flips to the moon, zooms and hands over', async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<BrandSplash tagline="Blood demands blood." onDone={onDone} />);
    expect(screen.getByLabelText('Sanguine')).toBeTruthy();
    expect(screen.getByText('Blood demands blood.')).toBeTruthy();
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it('uses only 2D transforms and no transformOrigin (D-154: the native driver ignores the origin, and 3D rotation is clipped)', () => {
    const src = readFileSync(join(__dirname, 'BrandSplash.tsx'), 'utf8').replace(/^\/\/.*$/gm, '');
    expect(src).not.toMatch(/transformOrigin|rotateX|rotateY|perspective/);
  });
  it('no tagline (teen mode): the lock-up only', () => {
    render(<BrandSplash tagline={undefined} onDone={() => {}} />);
    expect(screen.getByLabelText('Sanguine')).toBeTruthy();
    expect(screen.queryByText(/blood/i)).toBeNull();
  });
});
