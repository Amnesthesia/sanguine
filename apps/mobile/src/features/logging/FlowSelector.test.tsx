import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import '@/i18n';
vi.mock('react-native-svg', () => ({ default: () => null, Path: () => null }));
import { FlowSelector } from './FlowSelector';

afterEach(cleanup);

it('draws the four levels as circles and pills: radius at least half the height', () => {
  render(<FlowSelector value="medium" onChange={() => {}} />);
  for (const level of ['spotting', 'light', 'medium', 'heavy']) {
    const o = screen.getByTestId(`flow-${level}`);
    expect(Number.parseFloat(o.style.borderTopLeftRadius)).toBeGreaterThanOrEqual(38); // frame: 76 pt high, radius 38
    expect(o.style.minHeight).toBe('76px');
  }
});

it('keeps the labels and the radio state, and reports a tap', () => {
  const onChange = vi.fn();
  render(<FlowSelector value="medium" onChange={onChange} />);
  expect(screen.getByRole('radio', { name: 'Medium' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByRole('radio', { name: 'Heavy' }).getAttribute('aria-checked')).toBe('false');
  fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
  expect(onChange).toHaveBeenCalledWith('light');
});
