import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import '@/i18n';
import { Chips } from './Chips';
import { DateField } from './DateField';
import { OptionList } from './OptionList';
import { ProgressDots } from './ProgressDots';
import { TextField } from './TextField';

afterEach(cleanup);

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
  it('steps day, month and year with labelled buttons and respects the maximum', () => {
    function D() {
      const [d, setD] = useState('2026-10-10');
      return <DateField value={d} onChange={setD} min="2020-01-01" max="2026-10-10" />;
    }
    render(<D />);
    expect(screen.getByText('10 Oct 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Earlier day' }));
    expect(screen.getByText('9 Oct 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Earlier month' }));
    expect(screen.getByText('9 Sept 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Later year' })); // clamped to max
    expect(screen.getByText('10 Oct 2026')).toBeTruthy();
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
});
