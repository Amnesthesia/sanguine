import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { BrandSplash } from './BrandSplash';

// the vignette is decorative; react-native-svg has no jsdom renderer
vi.mock('react-native-svg', () => {
  const Null = () => null;
  return { default: Null, Defs: Null, RadialGradient: Null, Rect: Null, Stop: Null };
});

afterEach(cleanup);

describe('BrandSplash', () => {
  it('shows the mark, the wordmark and the tagline, then hands over', async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<BrandSplash onDone={onDone} pick={() => 0} />);
    expect(screen.getByLabelText('Sanguine')).toBeTruthy();
    expect(screen.getByText('Sanguine')).toBeTruthy();
    expect(screen.getByText('Blood demands blood.')).toBeTruthy();
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it('rotates through every tagline', () => {
    render(<BrandSplash onDone={() => {}} pick={() => 0.999} />);
    expect(screen.getByText('An ocean of red for the Lord of Rage.')).toBeTruthy();
  });
});
