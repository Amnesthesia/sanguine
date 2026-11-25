import type { PastOvulation, Prediction } from '@sanguine/engine';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FERTILE_WINDOW_DAYS, LUTEAL_PREDICTIVE_SD, LUTEAL_PRIOR, POPULATION_MEAN, WINDOW_CYCLES } from '@sanguine/engine';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import en from '../../../../../../copy/en-AU.json';
import { GUIDANCE, type GuidePhase } from '../guidance';
import { DayEstimateRows, EstimateSections, estimateRow, estimateSources } from './EstimateSections';
import { BodyCard, GuidanceSections, generalReasonText, splitSources } from './GuidanceSections';

// the drawing is rendered, not swallowed: shapes become <i data-svg-shape>, SVG text becomes <span data-svg-text>
vi.mock('react-native-svg', () => {
  const group = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const shape = (p: { fill?: string; strokeDasharray?: string }) => <i data-svg-shape="" data-fill={p.fill} data-dash={p.strokeDasharray} />;
  const label = ({ children }: { children?: ReactNode }) => <span data-svg-text="">{children}</span>;
  return { default: group, G: group, Rect: shape, Path: shape, Line: shape, Circle: shape, Text: label };
});
vi.mock('@/state/app', () => ({ useApp: () => ({}) })); // BodyCard reads the life states for the paused reason; none here
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
const wide = { ...prediction, ovulation: { ...(prediction.ovulation as NonNullable<Prediction['ovulation']>), i80: { lo: '2026-11-05', hi: '2026-11-20' } } } as Prediction;
const pastOv: PastOvulation[] = [{ cycleId: 'c1', cycleStart: '2026-10-05', point: '2026-10-19', i80: { lo: '2026-10-16', hi: '2026-10-22' }, basis: 'calendar', confidence: 'low' }];
const text = () => document.body.textContent ?? '';
// the open cycle starts 31 Oct (day 3 on 2 Nov); she logged its first three days
const cycleStarts = ['2026-10-05', '2026-10-31'];
const periodDays = new Set(['2026-10-31', '2026-11-01', '2026-11-02']);
/** Solid (filled) period marks in a picture: the bleed strip's circles, or the cycle strip's period cells (dashed 2 2). */
const solid = (label: string, dash?: string) =>
  [...(document.querySelector(`[aria-label^="${label}"]`)?.querySelectorAll('[data-svg-shape]') ?? [])].filter((n) => (dash === undefined || n.getAttribute('data-dash') === dash) && n.getAttribute('data-fill') && n.getAttribute('data-fill') !== 'none');

const props = (over: Partial<Parameters<typeof EstimateSections>[0]> = {}): Parameters<typeof EstimateSections>[0] =>
  ({ prediction, day: '2026-11-02', pastOv, cycleStarts, periodDays, showEstimate: true, includeUncertain: false, periodLengths: [5, 4], ...over });

describe('EstimateSections', () => {
  const render0 = (over: Partial<Parameters<typeof EstimateSections>[0]> = {}) =>
    render(<EstimateSections prediction={prediction} day="2026-11-02" pastOv={pastOv} cycleStarts={cycleStarts} periodDays={periodDays} showEstimate includeUncertain={false} periodLengths={[5, 4]} {...over} />);

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
    expect(text()).toContain('Your own cycles (2 used) are combined with what a study of 612,613 cycles found');
    expect(text()).toContain('Together they point to a cycle of about 28 days for you.');
    expect(text()).not.toContain('averaging');
    expect(text()).toContain('With only 2 of your cycles');
  });
  it('ovulation card warns when the basis is the calendar only, with the fixed wording', () => {
    render0();
    expect(text()).toContain('Worked out from your period dates only: no ovulation tests or temperatures this cycle');
    expect(text()).toContain('Ovulation most likely 10–18 Nov, around 14 Nov.');
    expect(text()).toContain('Do not use it to prevent pregnancy.');
    expect(screen.getAllByText(/Fair estimate/).length).toBeGreaterThan(0);
  });
  it('drops the calendar warning when a test or temperature is the basis', () => {
    render0({ prediction: { ...prediction, ovulation: { ...(prediction.ovulation as NonNullable<Prediction['ovulation']>), basis: 'lh' } } });
    expect(text()).not.toContain('Worked out from your period dates only');
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
  it('teen: no ovulation or fertile text is drawn, even when uncertain estimates are on', () => {
    render0({ showEstimate: false, includeUncertain: true, prediction: wide });
    expect(text()).not.toMatch(/ovulation|fertile/i);
    expect([...document.querySelectorAll('[data-svg-text]')].map((n) => n.textContent).join(' ')).not.toMatch(/ovulation|fertile/i);
    expect(screen.queryByTestId('estimate-ovulation')).toBeNull();
    expect(estimateSources(props({ showEstimate: false, includeUncertain: true, prediction: wide }), i18n.t).join(' ')).not.toContain('Wilcox');
  });
  it('a wide ovulation range with the setting off is words only: no strip, no fertile wording, no point date', () => {
    render0({ prediction: wide });
    expect(screen.getByTestId('estimate-ovulation')).toBeTruthy();
    expect(text()).toContain('Ovulation estimate uncertain: could fall 5–20 Nov');
    expect(document.querySelector('[aria-label*="fertile window estimate"]')).toBeNull();
    expect(document.querySelector('[aria-label*="ovulation estimate days"]')).toBeNull();
    expect(text()).not.toMatch(/fertile/i);
    expect(text()).not.toContain('around 14 Nov');
    expect(screen.queryByTestId('estimate-legal')).toBeNull();
    expect(text()).toContain('Not a contraceptive.');
    expect(estimateSources(props({ prediction: wide }), i18n.t).join(' ')).not.toContain('Wilcox');
  });
  it('the same wide range with the setting on draws the strip and the fertile wording', () => {
    render0({ prediction: wide, includeUncertain: true });
    expect(text()).toContain('Ovulation estimate uncertain: could fall 5–20 Nov');
    expect(document.querySelector('[aria-label*="fertile window estimate"]')).not.toBeNull();
    expect(text()).toMatch(/fertile window/i);
    expect(screen.getByTestId('estimate-legal').textContent).toContain('around 14 Nov');
    expect(estimateSources(props({ prediction: wide, includeUncertain: true }), i18n.t)[2]).toMatch(/^Wilcox/);
  });
  it('a wide past ovulation range is hidden unless uncertain estimates are on, then it is worded uncertain', () => {
    const widePast: PastOvulation[] = [{ ...(pastOv[0] as PastOvulation), i80: { lo: '2026-10-12', hi: '2026-10-26' } }];
    const { unmount } = render0({ day: '2026-10-20', pastOv: widePast });
    expect(screen.queryByTestId('estimate-ovulation')).toBeNull();
    expect(estimateSources(props({ day: '2026-10-20', pastOv: widePast }), i18n.t).join(' ')).not.toContain('Wilcox');
    unmount();
    render0({ day: '2026-10-20', pastOv: widePast, includeUncertain: true });
    expect(text()).toContain('Ovulation estimate uncertain: could have fallen 12–26 Oct · worked out from your cycle lengths');
    expect(text()).not.toContain('Ovulation was most likely');
  });
  it('a day before the open cycle with no past ovulation row shows no estimate cards at all', () => {
    const { container } = render0({ day: '2026-10-20', pastOv: [] });
    expect(container.textContent).toBe('');
  });
  it('a day in a cycle without its own row never borrows an earlier cycle\'s ovulation estimate', () => {
    // 7 Sep has a row; 5 Oct (an IUD cycle, say) has none; 20 Oct belongs to the 5 Oct cycle
    const sep: PastOvulation = { cycleId: 'c0', cycleStart: '2026-09-07', point: '2026-09-21', i80: { lo: '2026-09-18', hi: '2026-09-24' }, basis: 'calendar', confidence: 'low' };
    const { container } = render0({ day: '2026-10-20', pastOv: [sep], cycleStarts: ['2026-09-07', '2026-10-05', '2026-10-31'] });
    expect(container.textContent).toBe('');
    cleanup();
    render0({ day: '2026-09-25', pastOv: [sep], cycleStarts: ['2026-09-07', '2026-10-05', '2026-10-31'] });
    expect(text()).toContain('Ovulation was most likely 18–24 Sep');
  });
  it('fills only the period days she logged: day 1 logged, today day 3, days 2 and 3 are estimates', () => {
    render0({ periodDays: new Set(['2026-10-31']), includeUncertain: true });
    expect(solid('Most likely ends')).toHaveLength(1);
    expect(solid('This cycle from day 1', '2 2')).toHaveLength(1);
    cleanup();
    render0({ includeUncertain: true });
    expect(solid('Most likely ends')).toHaveLength(3);
    expect(solid('This cycle from day 1', '2 2')).toHaveLength(3);
  });
  it('a day inside the open cycle keeps the live cards even with past rows present', () => {
    render0({ day: '2026-11-01' });
    expect(screen.getByTestId('estimate-period-end')).toBeTruthy();
    expect(screen.getByTestId('estimate-next-period')).toBeTruthy();
  });
  it('the numbers written into the how-it-was-worked-out copy match the engine constants', () => {
    const how = en.estimates.how;
    expect(how.ovulationCalendar).toContain(String(LUTEAL_PRIOR.m0));
    expect(how.ovulationCalendar).toContain(`give or take ${LUTEAL_PREDICTIVE_SD} days`);
    // the Settings > How Sanguine estimates copy names the cycle window (D-161)
    expect(en.settings.how.rangeBody).toContain(`last ${WINDOW_CYCLES} cycles`);
    expect(en.settings.how.draw.blendLabel).toContain(`up to your last ${WINDOW_CYCLES}`);
    expect(how.nextPeriodNone).toContain(String(POPULATION_MEAN));
    expect(how.nextPeriod).toContain(String(POPULATION_MEAN));
    expect(how.fertile).toContain(`${FERTILE_WINDOW_DAYS + 1} days`);
  });
  it('lists the sources its cards cite, in their superscript order; none while nothing shows', () => {
    expect(estimateSources(props(), i18n.t).map((s) => s.split(' ')[0])).toEqual(['Munro', 'Bull', 'Wilcox']);
    expect(estimateSources(props({ prediction: { ...prediction, suspended: { reason: 'pregnant' } } as Prediction }), i18n.t)).toEqual([]);
    render0();
    expect(text()).not.toContain('1. Munro'); // the page (Insights > This cycle) lists them once, after food and movement
  });
  it('renders nothing while estimates are paused', () => {
    const { container } = render0({ prediction: { ...prediction, suspended: { reason: 'pregnant' } } });
    expect(container.textContent).toBe('');
  });
  it('a one-day range says the day once', () => {
    const one = { ...prediction, currentBleed: { point: '2026-11-04', i80: { lo: '2026-11-04', hi: '2026-11-04' }, confidence: 'low' } } as Prediction;
    render0({ prediction: one });
    expect(text()).toContain('Most likely ends 4 Nov.');
    expect(text()).not.toContain('4 Nov, around 4 Nov');
  });
  it('the period-end strip names the weekdays, today as Today', () => {
    render0();
    const strip = [...(document.querySelector('[aria-label^="Most likely ends"]')?.querySelectorAll('[data-svg-text]') ?? [])].map((n) => n.textContent);
    expect(strip).toEqual(expect.arrayContaining(['Sat', 'Sun', 'Today', 'Tue']));
  });
});

const drawn = () => [...document.querySelectorAll('[data-svg-text]')].map((n) => n.textContent).join(' ');

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
    expect(screen.queryByTestId('guidance-sources')).toBeNull(); // listed once by Insights > This cycle
    expect(splitSources(en.guidance.menstrual.sources)[0]).toBe('NHMRC Nutrient Reference Values: iron.');
  });
  it('compact mode is two tiles and a Read more button', () => {
    const more = vi.fn();
    render(<GuidanceSections day={day} supplements compact onMore={more} />);
    expect(screen.getAllByTestId('guidance-tile')).toHaveLength(2);
    expect(screen.queryByTestId('guidance-supps')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Read the reasons, evidence and sources/ }));
    expect(more).toHaveBeenCalledOnce();
    expect(screen.getByText('Read more')).toBeTruthy();
  });
  it('compact without onMore has no Read more (the day screen places its own link)', () => {
    render(<GuidanceSections day={day} supplements compact />);
    expect(screen.getAllByTestId('guidance-tile')).toHaveLength(2);
    expect(screen.queryByTestId('guidance-more')).toBeNull();
  });
  it('a general day says why: late, wide with and without her cycles, paused named and unnamed, set aside (D-162)', () => {
    const t = i18n.t.bind(i18n);
    expect(generalReasonText({ kind: 'late', by: '2026-11-03' }, t, [])).toContain('later than the range Sanguine expected (by 3 Nov)');
    expect(generalReasonText({ kind: 'wide', width: 14, n: 36, min: 24, max: 38 }, t, [])).toContain('Over your last 36 cycles, lengths have varied from 24 to 38 days, so the middle of your cycle can only be narrowed to 14 days.');
    expect(generalReasonText({ kind: 'wide', width: 14 }, t, [])).toContain('narrowed to 14 days so far');
    expect(generalReasonText({ kind: 'paused', on: '2026-10-14' }, t, [{ kind: 'postpartum', delivered: '2026-01-01', breastfeeding: true }])).toContain('While breastfeeding is set');
    expect(generalReasonText({ kind: 'paused', on: '2026-10-14' }, t, [{ kind: 'perimenopause', since: '2026-01-01' }])).toContain('A life state you set in Settings');
    expect(generalReasonText({ kind: 'paused', on: '2026-10-14' }, t, [])).toContain('A life state you set in Settings');
    for (const r of [{ kind: 'paused', on: '2026-10-14' }, { kind: 'wide', width: 14, n: 36, min: 24, max: 38 }] as const)
      expect(generalReasonText(r, t, [{ kind: 'perimenopause', since: '2026-01-01' }])).not.toMatch(/perimenopause/i); // §2.3 word
    expect(generalReasonText({ kind: 'setAside', quality: 'suspect_skip' }, t, [])).toContain('(unusually long)');
    expect(generalReasonText(undefined, t, [])).toBeUndefined();
  });
  it('the card leads with the reason and keeps the any-day line; the compact card shows the reason', () => {
    const day = { phase: 'general', expected: false, reason: { kind: 'wide', width: 14, n: 36, min: 24, max: 38 } } as const;
    render(<BodyCard day={day} />);
    expect(text()).toContain('Over your last 36 cycles, lengths have varied from 24 to 38 days, so the middle of your cycle can only be narrowed to 14 days. This day falls inside that stretch, so it isn\'t placed in a phase. These notes hold for any day of the cycle.');
    expect(text()).not.toContain('for example when cycles vary a lot');
    cleanup();
    render(<BodyCard day={day} compact />);
    expect(text()).toContain('Over your last 36 cycles, lengths have varied from 24 to 38 days, so the middle of your cycle can only be narrowed to 14 days.');
    cleanup();
    render(<BodyCard day={{ phase: 'general', expected: false }} />);
    expect(text()).toContain('for example when cycles vary a lot'); // no reason: the generic sentence
  });
  it('the compact body card has the short curve, the phase and one sentence', () => {
    render(<BodyCard day={{ phase: 'menstrual', expected: false }} compact />);
    expect(screen.getByTestId('hormone-curve-compact')).toBeTruthy();
    expect(screen.getByText('Period · estimate')).toBeTruthy();
    expect(text()).toContain('Estrogen and progesterone are at their lowest, and bleeding carries iron out of the body.');
    expect(text()).not.toContain('397 substances');
    expect(text()).toContain('A typical cycle, drawn to explain. Not your own hormone levels.');
    expect(drawn()).not.toContain('period'); // the compact drawing has no period label
  });
  it.each(['menstrual', 'follicular', 'luteal', 'premenstrual', 'general'] as GuidePhase[])('the %s picture never mentions ovulation', (phase) => {
    render(<GuidanceSections day={{ phase, expected: false }} supplements compact={false} />);
    expect(document.querySelector('[aria-label*="ovulat" i]')).toBeNull();
    expect(drawn()).not.toMatch(/ovulat/i);
  });
  it('only the ovulatory picture draws the ovulation label', () => {
    render(<GuidanceSections day={{ phase: 'ovulatory', expected: false }} supplements compact={false} />);
    expect(drawn()).toContain('ovulation');
  });
  it('each evidence meter reads its grade as a phrase, not a bare word', () => {
    render(<GuidanceSections day={day} supplements compact={false} />);
    for (const [grade, label] of [['strong', 'Strong evidence'], ['some', 'Some evidence'], ['early', 'Early evidence'], ['general', 'General guidance, not specific to this phase']])
      expect(screen.getByTestId(`evidence-key-${grade}`).querySelector(`[aria-label="${label}"]`)).not.toBeNull();
  });
  it.each([['menstrual', 8], ['follicular', 7], ['ovulatory', 4], ['luteal', 8], ['premenstrual', 8], ['general', 5]] as [GuidePhase, number][])('the %s source line splits into %i references', (phase, n) => {
    const items = splitSources(en.guidance[phase].sources);
    expect(items).toHaveLength(n);
    for (const item of items) expect(item).toMatch(/^[A-Z0-9].*\.$/);
    expect(items.join(' ')).toBe(en.guidance[phase].sources);
  });
});

describe('DayEstimateRows', () => {
  const lines = ['Period likely to end 3–5 Nov · rough estimate', 'Period likely to start 26–30 Nov · fair estimate', 'Ovulation estimate 10–18 Nov · fair estimate', 'Fertile window: moderate likelihood', 'Period possible: the wider range is 24 Nov – 2 Dec · confident'];
  it('reads each line back into its mark, words and confidence', () => {
    expect(lines.map((l) => estimateRow(l, i18n.t))).toEqual([
      { kind: 'period', text: 'Period likely to end 3–5 Nov', confidence: 'low' },
      { kind: 'period', text: 'Period likely to start 26–30 Nov', confidence: 'medium' },
      { kind: 'ovulation', text: 'Ovulation estimate 10–18 Nov', confidence: 'medium' },
      { kind: 'fertile', text: 'Fertile window: moderate likelihood' },
      { kind: 'period95', text: 'Period possible: the wider range is 24 Nov – 2 Dec', confidence: 'high' },
    ]);
    expect(estimateRow('Ovulation estimate 16–22 Oct · worked out from your cycle lengths', i18n.t)).toEqual({ kind: 'ovulation', text: 'Ovulation estimate 16–22 Oct · worked out from your cycle lengths' });
  });
  it('one row per line with its ESTIMATE tag and the meter word in the How vocabulary', () => {
    render(<DayEstimateRows lines={lines.slice(0, 2)} future={false} />);
    expect(screen.getByText('Estimates for this day')).toBeTruthy();
    expect(screen.getAllByTestId('day-estimate-row')).toHaveLength(2);
    expect(screen.getAllByText('ESTIMATE')).toHaveLength(2);
    expect(screen.getByLabelText('Rough estimate')).toBeTruthy();
    expect(screen.getByLabelText('Fair estimate')).toBeTruthy();
    expect(text()).not.toContain('· rough estimate');
  });
  it('nothing for a past day without estimates; a future day says none covers it', () => {
    const { container } = render(<DayEstimateRows lines={[]} future={false} />);
    expect(container.textContent).toBe('');
    cleanup();
    render(<DayEstimateRows lines={[]} future />);
    expect(screen.getByTestId('day-no-estimate').textContent).toBe('No estimate covers this day.');
  });
  it('a future day inside the wider range gets the range bar marked this day, with the two shades in words', () => {
    const next = prediction.nextPeriod as NonNullable<Prediction['nextPeriod']>;
    render(<DayEstimateRows lines={[lines[4] as string]} future bar={{ next, day: '2026-11-24' }} note />);
    expect(screen.getByLabelText(/This day, 24 Nov, is marked on the bar\.$/)).toBeTruthy();
    expect(drawn()).toContain('this day');
    expect(text()).toContain('About 19 in 20 within the whole bar');
    expect(text()).toContain('Estimates are ranges worked out from your own logs, not promises.');
    cleanup();
    render(<DayEstimateRows lines={[lines[4] as string]} future bar={{ next, day: '2026-12-05' }} />);
    expect(drawn()).not.toContain('this day');
  });
});
