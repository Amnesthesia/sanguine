import { describe, expect, it } from 'vitest';
import { arcPath } from './arc';

describe('arcPath', () => {
  it('starts at the top for 0 degrees and goes clockwise', () => {
    expect(arcPath(100, 100, 50, 0, 90)).toBe('M 100.00 50.00 A 50 50 0 0 1 150.00 100.00');
  });
  it('uses the large-arc flag past 180 degrees', () => expect(arcPath(100, 100, 50, 0, 270)).toContain('A 50 50 0 1 1'));
  it('a full turn is two half arcs; an empty span is empty', () => {
    expect(arcPath(100, 100, 50, 0, 360).match(/A /g)).toHaveLength(2);
    expect(arcPath(100, 100, 50, 30, 30)).toBe('');
  });
});
