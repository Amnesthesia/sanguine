import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { SymptomGrid } from './SymptomGrid';

afterEach(cleanup);

describe('SymptomGrid strength (D-088)', () => {
  it('names the strength on a selected tile and in its label; an unselected tile shows none', () => {
    render(<SymptomGrid codes={['cramps', 'headache']} values={{ cramps: 2 }} onSet={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Cramps, moderate, 2 of 3' })).toBeTruthy();
    expect(screen.getByText('Moderate')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Headache' })).toBeTruthy();
    expect(screen.queryByText('Mild')).toBeNull();
    expect(screen.queryByText('Strong')).toBeNull();
  });
  it('uses mild and strong for 1 and 3', () => {
    render(<SymptomGrid codes={['cramps', 'headache']} values={{ cramps: 1, headache: 3 }} onSet={() => {}} />);
    expect(screen.getByText('Mild')).toBeTruthy();
    expect(screen.getByText('Strong')).toBeTruthy();
  });
  it('says under the grid that a tap steps the strength', () => {
    render(<SymptomGrid codes={['cramps']} values={{}} onSet={() => {}} />);
    expect(screen.getByText('Tap a symptom for mild, again for moderate, again for strong. Press and hold to clear.')).toBeTruthy();
  });
});

describe('SymptomGrid tap steps the strength (D-097)', () => {
  it('steps off, mild, moderate, strong, off', () => {
    const got: number[] = [];
    for (const n of [0, 1, 2, 3]) {
      render(<SymptomGrid codes={['cramps']} values={{ cramps: n }} onSet={(_, v) => got.push(v)} />);
      fireEvent.click(screen.getByRole('checkbox'));
      cleanup();
    }
    expect(got).toEqual([1, 2, 3, 0]);
  });
  it('clears on press and hold', () => {
    vi.useFakeTimers();
    const got: number[] = [];
    render(<SymptomGrid codes={['cramps']} values={{ cramps: 2 }} onSet={(_, v) => got.push(v)} />);
    const tile = screen.getByRole('checkbox');
    fireEvent.mouseDown(tile, { button: 0, buttons: 1 });
    vi.advanceTimersByTime(1000);
    fireEvent.mouseUp(tile, { button: 0 });
    vi.useRealTimers();
    expect(got).toEqual([0]);
  });
});
