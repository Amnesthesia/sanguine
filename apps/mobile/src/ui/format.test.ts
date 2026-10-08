import { describe, expect, it } from 'vitest';
import { formatDay, formatLong, formatRange, formatWeekday } from './format';

describe('format', () => {
  it('days and long dates in en-AU', () => {
    expect(formatDay('2026-10-10')).toBe('10 Oct');
    expect(formatLong('2026-10-10')).toBe('Saturday 10 October');
    expect(formatWeekday('2026-10-14')).toBe('Wednesday');
  });
  it('ranges: same month, across months, single day', () => {
    expect(formatRange('2026-11-12', '2026-11-17')).toBe('12–17 Nov');
    expect(formatRange('2026-10-27', '2026-11-02')).toBe('27 Oct – 2 Nov');
    expect(formatRange('2026-10-27', '2026-10-27')).toBe('27 Oct');
  });
  it('September is Sep, as in the product copy', () => {
    expect(formatDay('2026-09-30')).toBe('30 Sep');
    expect(formatRange('2026-09-28', '2026-10-02')).toBe('28 Sep – 2 Oct');
  });
  it('is not shifted by the machine time zone (UTC maths)', () => {
    expect(formatDay('2026-01-01')).toBe('1 Jan');
    expect(formatDay('2026-12-31')).toBe('31 Dec');
  });
});
