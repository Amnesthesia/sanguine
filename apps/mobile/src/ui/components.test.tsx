import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AccessibilityInfo } from 'react-native';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { Chips } from './Chips';
import { DateField, dateToIso, isoToDate } from './DateField';

// the native picker cannot render in jsdom: a stub that picks 3 Feb 1994 when pressed
vi.mock('@expo/ui/community/datetime-picker', () => ({
  default: ({ onValueChange }: { onValueChange: (e: unknown, d?: Date) => void }) => (
    <>
      <button type="button" data-testid="picker" onClick={() => onValueChange({}, new Date(1994, 1, 3, 12))} />
      <button type="button" data-testid="dismiss" onClick={() => onValueChange({}, undefined)} />
    </>
  ),
}));
vi.mock('react-native-svg', () => ({ default: () => null, Path: () => null }));
import { OptionList } from './OptionList';
import { ProgressDots } from './ProgressDots';
import { TextField } from './TextField';

afterEach(cleanup);
// the step platter is a glass surface, which asks the OS for Reduce Transparency
Object.assign(AccessibilityInfo, { isReduceTransparencyEnabled: vi.fn().mockResolvedValue(true), addEventListener: vi.fn(() => ({ remove: vi.fn() })) });

function Harness() {
  const [v, setV] = useState<'a' | 'b' | undefined>();
  return <OptionList testIDPrefix="o" value={v} onChange={setV} options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta', hint: 'second' }]} />;
}

describe('OptionList', () => {
  it('exposes radio roles with selected state and updates on press', () => {
    render(<Harness />);
    const a = screen.getByRole('radio', { name: 'Alpha' });
    expect(a.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(a);
    expect(screen.getByRole('radio', { name: 'Alpha' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Beta' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('second')).toBeTruthy();
  });
  it('is one grouped list with a checkmark and bold text on the selected row only', () => {
    render(<Harness />);
    expect(screen.queryAllByTestId('option-check')).toHaveLength(0);
    fireEvent.click(screen.getByRole('radio', { name: 'Beta' }));
    const checks = screen.getAllByTestId('option-check');
    expect(checks).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Beta' }).contains(checks[0] as HTMLElement)).toBe(true);
    expect(screen.getByText('Beta').style.fontWeight).toBe('600');
    expect(screen.getByText('Alpha').style.fontWeight).not.toBe('600');
    expect(screen.getByRole('radio', { name: 'Alpha' }).parentElement).toBe(screen.getByRole('radio', { name: 'Beta' }).parentElement);
    expect(screen.getByTestId('o-b')).toBeTruthy();
  });
});

describe('Chips', () => {
  it('selects one at a time', () => {
    function C() {
      const [v, setV] = useState<string | undefined>('x');
      return <Chips value={v} onChange={setV} options={[{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }]} />;
    }
    render(<C />);
    fireEvent.click(screen.getByRole('radio', { name: 'Y' }));
    expect(screen.getByRole('radio', { name: 'Y' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'X' }).getAttribute('aria-checked')).toBe('false');
  });
});

describe('DateField', () => {
  it('opens the system picker from a labelled field and stores the picked day, clamped to the range', () => {
    function D() {
      const [d, setD] = useState('2026-10-10');
      return <DateField value={d} onChange={setD} min="2020-01-01" max="2026-10-10" />;
    }
    render(<D />);
    expect(screen.queryByTestId('picker')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '10 Oct 2026' }));
    fireEvent.click(screen.getByTestId('picker'));
    expect(screen.getByRole('button', { name: '1 Jan 2020' })).toBeTruthy(); // the stub picks 3 Feb 1994, before the minimum
    expect(screen.queryByTestId('picker')).toBeNull();
  });
  it('keeps the value when the Android dialog is dismissed without a date', () => {
    function D() {
      const [d, setD] = useState('2026-10-10');
      return <DateField value={d} onChange={setD} min="2020-01-01" max="2026-10-10" />;
    }
    render(<D />);
    fireEvent.click(screen.getByRole('button', { name: '10 Oct 2026' }));
    fireEvent.click(screen.getByTestId('dismiss'));
    expect(screen.getByRole('button', { name: '10 Oct 2026' })).toBeTruthy();
    expect(screen.queryByTestId('picker')).toBeNull();
  });
  it('converts between ISO days and local dates without shifting the day', () => {
    expect(dateToIso(isoToDate('2024-02-29'))).toBe('2024-02-29');
    expect(dateToIso(isoToDate('1990-12-31'))).toBe('1990-12-31');
  });
});

describe('TextField and ProgressDots', () => {
  it('labels the input and announces the error', () => {
    render(<TextField label="Year of birth" value="2018" onChangeText={() => {}} error="Too young" />);
    expect(screen.getByLabelText('Year of birth')).toBeTruthy();
    expect(screen.getByText('Too young')).toBeTruthy();
  });
  it('progress is a single labelled element', () => {
    render(<ProgressDots step={2} total={5} />);
    expect(screen.getByLabelText('Step 3 of 5')).toBeTruthy();
  });
  it('draws the current step as a pill, earlier steps as dots and later ones faint', () => {
    render(<ProgressDots step={2} total={5} />);
    const marks = screen.getAllByTestId('step-dot');
    expect(marks.map((m) => m.style.width)).toEqual(['8px', '8px', '22px', '8px', '8px']);
    const colour = marks.map((m) => m.style.backgroundColor);
    expect(colour[0]).toBe(colour[2]);
    expect(colour[3]).not.toBe(colour[2]);
    expect(colour[3]).toBe(colour[4]);
  });
});
