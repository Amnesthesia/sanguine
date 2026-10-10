// D-093 (U-24 follow-up): the row opens the cycle, and its correction buttons stay reachable by VoiceOver and TalkBack.
// A pressable with a label is one accessibility element, so the buttons must not sit inside it.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { HistoryRow } from './HistoryRow';
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
});
