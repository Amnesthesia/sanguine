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
  it('post_pregnancy is a flow kind', () => {
    expect(() => validateEvent({ kind: 'flow', payload: { day: '2026-03-02', level: 'medium', flow_kind: 'post_pregnancy' } })).not.toThrow();
  });
});
