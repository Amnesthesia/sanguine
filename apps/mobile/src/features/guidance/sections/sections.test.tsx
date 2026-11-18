import type { PastOvulation, Prediction } from '@sanguine/engine';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { GUIDANCE, type GuidePhase } from '../guidance';
import { EstimateSections } from './EstimateSections';
import { GuidanceSections } from './GuidanceSections';

vi.mock('react-native-svg', () => {
  const none = () => null;
  return { default: none, Rect: none, Path: none, Line: none, Circle: none, G: none, Text: none };
});
afterEach(cleanup);

const prediction = {
  engineVersion: 'test', asOf: '2026-11-02',
  currentPhase: { phase: 'menstrual', dayOfCycle: 3 },
  currentBleed: { point: '2026-11-04', i80: { lo: '2026-11-03', hi: '2026-11-05' }, confidence: 'low' },
  nextPeriod: { point: '2026-11-28', i80: { lo: '2026-11-26', hi: '2026-11-30' }, i95: { lo: '2026-11-24', hi: '2026-12-02' }, confidence: 'medium', daysOfDataUsed: 56 },
  cycleLength: { mean: 28, sd: 2, nu: 5, scale: 1, nCyclesUsed: 2 },
  ovulation: { point: '2026-11-14', i80: { lo: '2026-11-10', hi: '2026-11-18' }, sd: 3, confidence: 'medium', basis: 'calendar' },
  fertileDays: [{ date: '2026-11-12', pInWindow: 0.3 }, { date: '2026-11-13', pInWindow: 0.5 }, { date: '2026-11-14', pInWindow: 0.4 }],
  flags: [], cycleQuality: [],
} as unknown as Prediction;
const pastOv: PastOvulation[] = [{ cycleId: 'c1', cycleStart: '2026-10-05', point: '2026-10-19', i80: { lo: '2026-10-16', hi: '2026-10-22' }, basis: 'calendar', confidence: 'low' }];
const text = () => document.body.textContent ?? '';

describe('EstimateSections', () => {
  const render0 = (over: Partial<Parameters<typeof EstimateSections>[0]> = {}) =>
    render(<EstimateSections prediction={prediction} day="2026-11-02" pastOv={pastOv} showEstimate periodLengths={[5, 4]} {...over} />);

  it('period end card shows her own period lengths', () => {
    render0();
    expect(screen.getByText('When this period ends')).toBeTruthy();
    expect(text()).toContain('Most likely ends 3–5 Nov, around 4 Nov.');
    expect(text()).toContain('Your last 2 periods lasted 5 days and 4 days.');
    expect(screen.getByLabelText('Typical period length is up to 8 days. Yours: 5 days and 4 days.')).toBeTruthy();
  });
  it('says so when there are no earlier periods', () => {
    render0({ periodLengths: [] });
    expect(text()).toContain('There are no earlier periods to go on yet');
  });
  it('next period card gives the 8 in 10 and about 19 in 20 ranges', () => {
    render0();
    expect(screen.getByText('Next period')).toBeTruthy();
    expect(text()).toContain('8 in 10 chance it starts here');
    expect(text()).toContain('About 19 in 20 within the whole bar');
    expect(text()).toContain('Your own cycles (2 used, averaging 28 days) are combined with what a study of 612,613 cycles found');
    expect(text()).toContain('With only 2 of your cycles');
  });
  it('ovulation card warns when the basis is the calendar only, with the fixed wording', () => {
    render0();
    expect(text()).toContain('Calendar only: no LH tests or temperatures this cycle');
    expect(text()).toContain('Ovulation most likely 10–18 Nov, around 14 Nov.');
    expect(text()).toContain('Do not use it to prevent pregnancy.');
    expect(screen.getAllByText(/Medium confidence/).length).toBeGreaterThan(0);
  });
  it('drops the calendar warning when a test or temperature is the basis', () => {
    render0({ prediction: { ...prediction, ovulation: { ...(prediction.ovulation as NonNullable<Prediction['ovulation']>), basis: 'lh' } } });
    expect(text()).not.toContain('Calendar only');
    expect(text()).toContain('Based on your ovulation test.');
  });
  it('shows a past cycle with the estimate worked out after it ended', () => {
    render0({ day: '2026-10-20' });
    expect(text()).toContain('Ovulation was most likely 16–22 Oct, around 19 Oct.');
    expect(text()).toContain('This cycle has ended');
  });
  it('hides ovulation and fertile wording when the estimate is off (teen mode)', () => {
    render0({ showEstimate: false });
    expect(screen.getByText('Next period')).toBeTruthy();
    expect(text()).not.toMatch(/ovulation|fertile/i);
    expect(document.querySelector('[aria-label*="ovulation" i]')).toBeNull();
    expect(document.querySelector('[aria-label*="fertile" i]')).toBeNull();
  });
  it('cites its sources as a numbered list', () => {
    render0();
    expect(text()).toContain('1. Munro and others 2018');
    expect(text()).toContain('2. Bull and others 2019');
    expect(text()).toContain('3. Wilcox and others 1995');
  });
  it('renders nothing while estimates are paused', () => {
    const { container } = render0({ prediction: { ...prediction, suspended: { reason: 'pregnant' } } });
    expect(container.textContent).toBe('');
  });
});

describe('GuidanceSections', () => {
  const day = { phase: 'premenstrual', expected: false } as const;
  it('lists the four evidence grades with their definitions', () => {
    render(<GuidanceSections day={day} supplements compact={false} />);
    expect(screen.getByText('How to read the evidence bars')).toBeTruthy();
    for (const [word, def] of [
      ['Strong', 'large reviews or national guidelines agree.'],
      ['Some', 'several small trials point the same way, results vary.'],
      ['Early', 'one study, lab work, or a plausible link not tested in people.'],
      ['General', 'good advice on any day, not specific to this phase.'],
    ]) expect(screen.getByTestId(`evidence-key-${word.toLowerCase()}`).textContent).toBe(`${word}${def}`);
  });
  it('shows supplements only when allowed', () => {
    const { unmount } = render(<GuidanceSections day={day} supplements compact={false} />);
    expect(screen.getByTestId('guidance-supps')).toBeTruthy();
    unmount();
    render(<GuidanceSections day={day} supplements={false} compact={false} />);
    expect(screen.queryByTestId('guidance-supps')).toBeNull();
    expect(text()).not.toContain('Supplements with some research');
  });
  it('shows every food note and the movement note with their evidence', () => {
    render(<GuidanceSections day={{ phase: 'menstrual', expected: true }} supplements compact={false} />);
    for (const f of GUIDANCE.menstrual.foods) expect(screen.getByTestId(`guidance-food-${f.id}`)).toBeTruthy();
    expect(screen.getByTestId('guidance-move-note')).toBeTruthy();
    expect(screen.getByTestId('guidance-phase-menstrual').textContent).toBe('Period · expected');
    expect(screen.getByTestId('guidance-sources').textContent).toContain('1. NHMRC Nutrient Reference Values: iron.');
  });
  it('compact mode is two tiles and a Read more button', () => {
    const more = vi.fn();
    render(<GuidanceSections day={day} supplements compact onMore={more} />);
    expect(screen.getAllByTestId('guidance-tile')).toHaveLength(2);
    expect(screen.queryByTestId('guidance-supps')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Open the day screen/ }));
    expect(more).toHaveBeenCalledOnce();
    expect(screen.getByText('Read more')).toBeTruthy();
  });
  it.each(['menstrual', 'follicular', 'luteal', 'premenstrual', 'general'] as GuidePhase[])('the %s picture never mentions ovulation', (phase) => {
    render(<GuidanceSections day={{ phase, expected: false }} supplements compact={false} />);
    expect(document.querySelector('[aria-label*="ovulat" i]')).toBeNull();
  });
});
