import { describe, expect, it } from 'vitest';
import { quickActionItems } from './quickActions';

const t = (k: string) => k;
describe('quickActionItems (P8-8, D-085)', () => {
  it('are off by default and while the discreet icon is on', () => {
    expect(quickActionItems(false, false, t)).toEqual([]);
    expect(quickActionItems(true, true, t)).toEqual([]);
  });
  it('open the logging sheet on the period or temperature section', () => {
    expect(quickActionItems(true, false, t).map((i) => i.params.href)).toEqual(['/log?section=period', '/log?section=temperature']);
  });
});
