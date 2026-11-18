// D-093 (U-24 follow-up): the row opens the cycle, and its correction buttons stay reachable by VoiceOver and TalkBack.
// A pressable with a label is one accessibility element, so the buttons must not sit inside it.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { HistoryRow, LengthSummaryCard } from './HistoryRow';
import type { HistoryRow as Row } from './insightsModel';

afterEach(cleanup);
const on = { show: true, includeUncertain: false };
const row: Row = { id: 'c1', start: '3 Aug', startISO: '2026-08-03', lengthDays: 56, dayOfCycle: undefined, bleedDays: 4, quality: 'suspect_skip', ovulation: { i80: { lo: '2026-08-20', hi: '2026-08-24' }, basis: 'calendar', past: true }, current: false, offerMissedLog: true, midDay: '2026-08-31', nextStartISO: '2026-09-28' } as Row;

describe('HistoryRow', () => {
  it('the open-cycle button carries the row text and holds none of the correction buttons', () => {
    render(<HistoryRow r={row} estimates={on} onOpen={vi.fn()} actions={<button type="button">I missed logging</button>} />);
    const open = screen.getByTestId('cycle-detail-link');
    expect(open.getAttribute('aria-label')).toContain('3 Aug');
    expect(open.getAttribute('aria-label')).toContain('56 days');
    expect(within(open).queryByText('I missed logging')).toBeNull();
    expect(screen.getByText('I missed logging')).toBeTruthy();
  });

  const excluded = { ...row, id: 'c2', quality: 'user_excluded', offerMissedLog: false } as Row;
  it('an excluded cycle says so and offers Include in estimates beside the row, not inside the open button', () => {
    const onInclude = vi.fn();
    render(<HistoryRow r={excluded} estimates={on} onOpen={vi.fn()} onInclude={onInclude} />);
    expect(screen.getByText('This cycle is left out of your estimates.')).toBeTruthy();
    expect(screen.getByText('excluded by you')).toBeTruthy();
    const open = screen.getByTestId('cycle-detail-link');
    const include = screen.getByTestId('include-cycle-c2');
    expect(open.contains(include)).toBe(false);
    expect(include.getAttribute('aria-label')).toContain('3 Aug');
    fireEvent.click(include);
    expect(onInclude).toHaveBeenCalledTimes(1);
  });
  it('a typical cycle has no Include action or excluded note', () => {
    render(<HistoryRow r={{ ...row, quality: 'valid', offerMissedLog: false } as Row} estimates={on} onOpen={vi.fn()} onInclude={vi.fn()} />);
    expect(screen.queryByTestId('include-cycle-c1')).toBeNull();
    expect(screen.queryByText('This cycle is left out of your estimates.')).toBeNull();
  });
});

describe('HistoryRow ovulation estimate', () => {
  const detail = () => screen.getByTestId('cycle-detail-link').textContent ?? '';
  it('says the date range, not the basis key, and leaves out the calendar basis', () => {
    render(<HistoryRow r={row} estimates={on} onOpen={vi.fn()} />);
    expect(screen.getByText('4 bleed days \u00b7 Ovulation estimate 20\u201324 Aug')).toBeTruthy();
    expect(detail()).not.toMatch(/calendar|ovulation:/);
    expect(screen.getByTestId('cycle-detail-link').getAttribute('aria-label')).toContain('Ovulation estimate 20\u201324 Aug');
  });
  it('names the signal in plain words when one dated it', () => {
    render(<HistoryRow r={{ ...row, ovulation: { i80: { lo: '2026-08-20', hi: '2026-08-22' }, basis: 'bbt', past: true } } as Row} estimates={on} onOpen={vi.fn()} />);
    expect(screen.getByText('4 bleed days \u00b7 Ovulation estimate 20\u201322 Aug \u00b7 from your temperature readings')).toBeTruthy();
  });
  it('a wide range is only "uncertain" unless she opted in', () => {
    const wide = { ...row, ovulation: { i80: { lo: '2026-08-12', hi: '2026-08-30' }, basis: 'calendar', past: true } } as Row;
    render(<HistoryRow r={wide} estimates={on} onOpen={vi.fn()} />);
    expect(screen.getByText('4 bleed days \u00b7 Ovulation estimate uncertain')).toBeTruthy();
    cleanup();
    render(<HistoryRow r={wide} estimates={{ show: true, includeUncertain: true }} onOpen={vi.fn()} />);
    expect(screen.getByText('4 bleed days \u00b7 Ovulation estimate uncertain: could have fallen 12\u201330 Aug')).toBeTruthy();
  });
  it('no ovulation words when the estimate is hidden (teen mode) or the engine gave none', () => {
    render(<HistoryRow r={row} estimates={{ show: false, includeUncertain: true }} onOpen={vi.fn()} />);
    expect(detail()).not.toMatch(/ovulation/i);
    cleanup();
    render(<HistoryRow r={{ ...row, ovulation: undefined } as Row} estimates={on} onOpen={vi.fn()} />);
    expect(screen.getByText('4 bleed days')).toBeTruthy();
    expect(detail()).not.toMatch(/ovulation/i);
  });
});

describe('LengthSummaryCard', () => {
  const summary = { min: 24, max: 45, spread: 21, lengths: [24, 38, 31, 45, 27, 36], confidence: 'low' as const };
  it('shows the range, the lengths and the spread, and the confidence as three bars with a word', () => {
    render(<LengthSummaryCard s={summary} />);
    expect(screen.getByText('24\u201345 days')).toBeTruthy();
    expect(screen.getByText('24, 38, 31, 45, 27, 36 days \u00b7 21-day spread.')).toBeTruthy();
    expect(screen.getByText('Low confidence')).toBeTruthy();
    // low confidence is one filled bar out of three: the filled one is darker than the other two
    const bars = screen.getAllByTestId('meter-bar').map((b) => getComputedStyle(b).backgroundColor);
    expect(bars).toHaveLength(3);
    expect(bars[1]).toBe(bars[2]);
    expect(bars[0]).not.toBe(bars[1]);
  });
  it('says the list counts the cycles she left out, unlike the chart', () => {
    render(<LengthSummaryCard s={summary} />);
    expect(screen.getByText('Your last 6 completed cycles, including any you left out of estimates. The cycle length chart shows typical cycles only.')).toBeTruthy();
  });
  it('more confidence fills more bars', () => {
    render(<LengthSummaryCard s={{ ...summary, confidence: 'high' }} />);
    const bars = screen.getAllByTestId('meter-bar').map((b) => getComputedStyle(b).backgroundColor);
    expect(new Set(bars).size).toBe(1);
  });
});
