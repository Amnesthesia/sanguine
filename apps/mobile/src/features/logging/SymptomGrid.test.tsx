import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import '@/i18n';
import { SymptomGrid } from './SymptomGrid';

afterEach(cleanup);

describe('SymptomGrid strength (D-088)', () => {
  it('names the strength on a selected tile and in its label; an unselected tile shows none', () => {
    render(<SymptomGrid codes={['cramps', 'headache']} values={{ cramps: 2 }} onSet={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Cramps, moderate, 2 of 3' })).toBeTruthy();
    expect(screen.getByText('Moderate')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Headache, not selected' })).toBeTruthy();
    expect(screen.queryByText('Mild')).toBeNull();
    expect(screen.queryByText('Strong')).toBeNull();
  });
  it('uses mild and strong for 1 and 3', () => {
    render(<SymptomGrid codes={['cramps', 'headache']} values={{ cramps: 1, headache: 3 }} onSet={() => {}} />);
    expect(screen.getByText('Mild')).toBeTruthy();
    expect(screen.getByText('Strong')).toBeTruthy();
  });
  it('explains the dots in the hint under the grid', () => {
    render(<SymptomGrid codes={['cramps']} values={{}} onSet={() => {}} />);
    expect(screen.getByText('Dots show how strong it was: mild, moderate or strong. Press and hold a symptom to change it.')).toBeTruthy();
  });
});
