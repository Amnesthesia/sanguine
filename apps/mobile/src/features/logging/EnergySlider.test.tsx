import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import '@/i18n';
import { forwardRef } from 'react';

// records the props of every View so a test can call handlers react-native-web does not forward to the DOM (accessibility actions, responder events)
const seen = vi.hoisted(() => ({ props: [] as Array<Record<string, any>> }));
vi.mock('react-native', async (orig) => {
  const rn = (await orig()) as { View: React.ComponentType<any> };
  const Real = rn.View;
  const Spy = forwardRef<unknown, Record<string, any>>((p, ref) => { seen.props.push(p); return <Real ref={ref} {...p} />; });
  return { ...rn, View: Spy };
});
import { EnergySlider, energyAt, stepEnergy } from './EnergySlider';
const find = (key: string) => [...seen.props].reverse().find((p) => key in p)!;

afterEach(() => { cleanup(); seen.props = []; });

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

it('wires the screen reader actions to one step and writes nothing at the limits', () => {
  const onChange = vi.fn();
  const { rerender } = render(<EnergySlider value={2} onChange={onChange} />);
  const act = (name: string) => find('onAccessibilityAction').onAccessibilityAction({ nativeEvent: { actionName: name } });
  act('increment');
  expect(onChange).toHaveBeenLastCalledWith(3);
  act('decrement');
  expect(onChange).toHaveBeenLastCalledWith(1);
  expect(find('accessibilityActions').accessibilityActions.map((a: { name: string }) => a.name)).toEqual(['increment', 'decrement']);
  onChange.mockClear();
  rerender(<EnergySlider value={5} onChange={onChange} />);
  act('increment');
  expect(onChange).not.toHaveBeenCalled();
});

it('maps a horizontal position to the nearest of five steps, clamped', () => {
  expect(energyAt(0, 0, 250)).toBe(1);
  expect(energyAt(49, 0, 250)).toBe(1);
  expect(energyAt(50, 0, 250)).toBe(2);
  expect(energyAt(125, 0, 250)).toBe(3);
  expect(energyAt(249, 0, 250)).toBe(5);
  expect(energyAt(-40, 0, 250)).toBe(1);
  expect(energyAt(900, 0, 250)).toBe(5);
  expect(energyAt(130, 10, 250)).toBe(3); // left edge offset
  expect(energyAt(5, 0, 0)).toBe(1); // not measured yet
});

it('previews while dragging and writes once on release', () => {
  const onChange = vi.fn();
  render(<EnergySlider value={0} onChange={onChange} />);
  const track = screen.getByTestId('energy-track') as HTMLElement & { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void };
  track.measureInWindow = (cb) => cb(10, 0, 250, 44);
  const h = () => find('onResponderMove');
  const ev = (pageX: number) => ({ nativeEvent: { pageX } });
  // a start that has not moved far is a tap for the detents: do not claim it
  find('onStartShouldSetResponderCapture').onStartShouldSetResponderCapture(ev(30));
  expect(find('onMoveShouldSetResponderCapture').onMoveShouldSetResponderCapture(ev(32))).toBe(false);
  expect(find('onMoveShouldSetResponderCapture').onMoveShouldSetResponderCapture(ev(60))).toBe(true);
  act(() => h().onResponderGrant(ev(60)));
  act(() => h().onResponderMove(ev(140)));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Energy').getAttribute('aria-valuetext')).toBe('OK');
  act(() => h().onResponderMove(ev(250)));
  act(() => h().onResponderRelease(ev(250)));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(5);
});

it('gives every detent a label for the static accessibility gate', () => {
  render(<EnergySlider value={0} onChange={() => {}} />);
  expect(screen.getByTestId('energy-3').getAttribute('aria-label')).toBe('OK');
});
