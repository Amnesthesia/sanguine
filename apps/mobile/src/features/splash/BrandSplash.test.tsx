import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { BrandSplash } from './BrandSplash';

afterEach(cleanup);

describe('BrandSplash', () => {
  it('shows the mark and the tagline, then hands over', async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<BrandSplash onDone={onDone} pick={() => 0} />);
    expect(screen.getByLabelText('Sanguine')).toBeTruthy();
    expect(screen.getByText('Blood for the blood god')).toBeTruthy();
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it('rotates through every tagline', () => {
    render(<BrandSplash onDone={() => {}} pick={() => 0.999} />);
    expect(screen.getByText('The veins of the mortal realm feed the Brass Citadel.')).toBeTruthy();
  });
});
