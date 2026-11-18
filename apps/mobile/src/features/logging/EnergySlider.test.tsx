import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import '@/i18n';
import { EnergySlider, stepEnergy } from './EnergySlider';

afterEach(cleanup);

it('sets the level of the tapped detent', () => {
  const onChange = vi.fn();
  render(<EnergySlider value={0} onChange={onChange} />);
  fireEvent.click(screen.getByTestId('energy-2'));
  expect(onChange).toHaveBeenCalledWith(2);
});

it('says Not logged with nothing set, and Clear is absent', () => {
  render(<EnergySlider value={0} onChange={() => {}} />);
  expect(screen.getByText('Not logged')).toBeTruthy();
  expect(screen.queryByTestId('energy-clear')).toBeNull();
});

it('names the level and Clear sets 0', () => {
  const onChange = vi.fn();
  render(<EnergySlider value={2} onChange={onChange} />);
  expect(screen.getAllByText('Low').length).toBeGreaterThan(0);
  expect(screen.getByLabelText('Energy').getAttribute('aria-valuetext')).toBe('Low');
  fireEvent.click(screen.getByTestId('energy-clear'));
  expect(onChange).toHaveBeenCalledWith(0);
});

it('steps by one for increment and decrement, staying inside 1 to 5', () => {
  expect(stepEnergy(0, 'increment')).toBe(1);
  expect(stepEnergy(2, 'increment')).toBe(3);
  expect(stepEnergy(5, 'increment')).toBe(5);
  expect(stepEnergy(3, 'decrement')).toBe(2);
  expect(stepEnergy(1, 'decrement')).toBe(1);
  expect(stepEnergy(0, 'decrement')).toBe(0); // nothing logged: decrement does not invent a value
});
