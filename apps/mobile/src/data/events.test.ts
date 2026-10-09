import { describe, expect, it } from 'vitest';
import { validateEvent } from './events';

describe('pregnancy outcome and post-pregnancy bleeding (P3-12, D-053)', () => {
  it('life_state.end for pregnant may carry birth or loss; nothing else may carry an outcome', () => {
    expect(() => validateEvent({ kind: 'life_state.end', payload: { kind: 'pregnant', day: '2026-03-01', outcome: 'loss' } })).not.toThrow();
    expect(() => validateEvent({ kind: 'life_state.end', payload: { kind: 'pregnant', day: '2026-03-01', outcome: 'birth' } })).not.toThrow();
    expect(() => validateEvent({ kind: 'life_state.end', payload: { kind: 'pregnant', day: '2026-03-01' } })).not.toThrow(); // older logs and exports
    expect(() => validateEvent({ kind: 'life_state.end', payload: { kind: 'pregnant', day: '2026-03-01', outcome: 'other' } })).toThrow(/outcome/);
    expect(() => validateEvent({ kind: 'life_state.end', payload: { kind: 'perimenopause', day: '2026-03-01', outcome: 'loss' } })).toThrow(/outcome/);
  });
  it('period.start asked_on must be a day and needs a merge answer', () => {
    expect(() => validateEvent({ kind: 'period.start', payload: { day: '2026-10-10', merge: false, asked_on: '2026-10-05' } })).not.toThrow();
    expect(() => validateEvent({ kind: 'period.start', payload: { day: '2026-10-10', merge: false, asked_on: 'x' } })).toThrow(/asked_on/);
    expect(() => validateEvent({ kind: 'period.start', payload: { day: '2026-10-10', asked_on: '2026-10-05' } })).toThrow(/asked_on/);
  });
  it('post_pregnancy is a flow kind', () => {
    expect(() => validateEvent({ kind: 'flow', payload: { day: '2026-03-02', level: 'medium', flow_kind: 'post_pregnancy' } })).not.toThrow();
  });
});
