import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import '@/i18n';
import { GuidanceSummary } from './GuidanceSummary';

afterEach(cleanup);

it('shows the phase, a brief food line and a brief movement line, and opens on press', () => {
  const onOpen = vi.fn();
  render(<GuidanceSummary day={{ phase: 'luteal', expected: false }} onOpen={onOpen} />);
  expect(screen.getByText('Food and movement')).toBeTruthy();
  expect(screen.getByTestId('guidance-summary-phase-luteal').textContent).toBe('Luteal phase · estimate');
  expect(screen.getByTestId('guidance-summary-food').textContent).toBe('Food: Protein, magnesium and B12, such as eggs on toast or a handful of almonds.');
  expect(screen.getByTestId('guidance-summary-move').textContent).toBe('Movement: Keep moving: exercise lifts mood. Drink regularly in warm weather.');
  expect(screen.getByText('Read more')).toBeTruthy();
  fireEvent.click(screen.getByTestId('guidance-summary'));
  expect(onOpen).toHaveBeenCalledTimes(1);
});

it('marks a future day as expected', () => {
  render(<GuidanceSummary day={{ phase: 'menstrual', expected: true }} onOpen={() => {}} />);
  expect(screen.getByTestId('guidance-summary-phase-menstrual').textContent).toBe('Period · expected');
});
