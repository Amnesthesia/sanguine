// D-093 (U-24 follow-up): the row opens the cycle, and its correction buttons stay reachable by VoiceOver and TalkBack.
// A pressable with a label is one accessibility element, so the buttons must not sit inside it.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { HistoryRow, LengthSummaryCard } from './HistoryRow';
import type { HistoryRow as Row } from './insightsModel';

afterEach(cleanup);
const row: Row = { id: 'c1', start: '3 Aug', startISO: '2026-08-03', lengthDays: 56, dayOfCycle: undefined, bleedDays: 4, quality: 'suspect_skip', basis: 'calendar', current: false, offerMissedLog: true, midDay: '2026-08-31', nextStartISO: '2026-09-28' } as Row;

describe('HistoryRow', () => {
  it('the open-cycle button carries the row text and holds none of the correction buttons', () => {
    render(<HistoryRow r={row} fertilityTools onOpen={vi.fn()} actions={<button type="button">I missed logging</button>} />);
    const open = screen.getByTestId('cycle-detail-link');
    expect(open.getAttribute('aria-label')).toContain('3 Aug');
    expect(open.getAttribute('aria-label')).toContain('56 days');
    expect(within(open).queryByText('I missed logging')).toBeNull();
    expect(screen.getByText('I missed logging')).toBeTruthy();
  });

  const excluded = { ...row, id: 'c2', quality: 'user_excluded', offerMissedLog: false } as Row;
  it('an excluded cycle says so and offers Include in estimates beside the row, not inside the open button', () => {
    const onInclude = vi.fn();
    render(<HistoryRow r={excluded} fertilityTools onOpen={vi.fn()} onInclude={onInclude} />);
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
    render(<HistoryRow r={{ ...row, quality: 'valid', offerMissedLog: false } as Row} fertilityTools onOpen={vi.fn()} onInclude={vi.fn()} />);
    expect(screen.queryByTestId('include-cycle-c1')).toBeNull();
    expect(screen.queryByText('This cycle is left out of your estimates.')).toBeNull();
  });
});

describe('LengthSummaryCard', () => {
  const summary = { min: 24, max: 45, spread: 21, lengths: [24, 38, 31, 45, 27, 36], confidence: 'low' as const };
  it('shows the range, the lengths and the spread, and the confidence as three bars with a word', () => {
    render(<LengthSummaryCard s={summary} />);
    expect(screen.getByText('24\u201345 days')).toBeTruthy();
    expect(screen.getByText('24, 38, 31, 45, 27, 36 days \u00b7 21-day spread.')).toBeTruthy();
    expect(screen.getByText('Low confidence')).toBeTruthy();
    expect(screen.getAllByTestId('meter-bar')).toHaveLength(3);
  });
});
