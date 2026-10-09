import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { BrandSplash } from './BrandSplash';

afterEach(cleanup);

describe('BrandSplash', () => {
  it('shows the lock-up and the tagline, then hands over', async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<BrandSplash tagline="Blood demands blood." onDone={onDone} />);
    expect(screen.getByLabelText('Sanguine')).toBeTruthy();
    expect(screen.getByText('Blood demands blood.')).toBeTruthy();
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it('no tagline (teen mode): the lock-up only', () => {
    render(<BrandSplash tagline={undefined} onDone={() => {}} />);
    expect(screen.getByLabelText('Sanguine')).toBeTruthy();
    expect(screen.queryByText(/blood/i)).toBeNull();
  });
});
