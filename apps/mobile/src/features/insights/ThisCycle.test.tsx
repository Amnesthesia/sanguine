// Insights > This cycle (P8-31, D-134): the estimate cards, food and movement, supplements, the evidence key and one numbered source list.
import { addDays, type EngineSettings, type History, type ISODate, predict } from '@sanguine/engine';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS } from '@/data/prefs';

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('@/state/app', () => ({ useApp: () => app.state }));
vi.mock('expo-router', () => ({ useRouter: () => router }));
// the drawing is rendered, not swallowed: SVG text becomes <span data-svg-text>
vi.mock('react-native-svg', () => {
  const group = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const label = ({ children }: { children?: ReactNode }) => <span data-svg-text="">{children}</span>;
  return { default: group, G: group, Rect: () => null, Path: () => null, Line: () => null, Circle: () => null, Text: label };
});
import { MoreAboutThisCycle, ThisCycle } from './ThisCycle';

afterEach(() => { cleanup(); router.push.mockClear(); });

const S: EngineSettings = { lifeStates: [], recencyLambda: 1, window: 12 };
/** Closed cycles of the given lengths, the last one starting `last`, each with a `bleed`-day period (built through the engine, not by hand). */
function hist(lengths: number[], last: ISODate, bleed = 4): History {
  const starts: ISODate[] = [last];
  for (let i = lengths.length - 1; i >= 0; i--) starts.unshift(addDays(starts[0] as ISODate, -(lengths[i] as number)));
  return { cycles: starts.map((s, i) => ({ id: `c${i}`, start: s, end: addDays(s, bleed - 1), quality: 'valid' as const })), temperatures: [], lh: [], mucus: [], cervix: [], logs: [] };
}
const TODAY = '2026-10-13';
function show(o: { history?: History; profile?: Record<string, unknown> } = {}) {
  const history = o.history ?? hist([28, 30, 29], '2026-10-01');
  app.state = { today: TODAY, history, settings: S, prediction: history.cycles.length ? predict(history, S, TODAY) : undefined, prefs: DEFAULT_PREFS, profile: o.profile ?? {}, version: 0, db: undefined };
  return render(<ThisCycle />);
}
const text = () => document.body.textContent ?? '';
const sources = () => within(screen.getByTestId('this-cycle-sources')).getAllByText(/^\d+\. /).map((n) => (n.textContent ?? '').split(' ').slice(0, 2).join(' '));

describe('Insights > This cycle', () => {
  it('an adult gets the estimate cards, food and movement with the full curve, supplements, the evidence key and the caveat', () => {
    show({ history: hist([28, 30, 29], '2026-10-12') }); // day 2, a period day: the phase with supplement notes
    expect(screen.getByTestId('this-cycle-heading').textContent).toBe('This cycle, from 12 Oct · day 2 · Period');
    for (const id of ['estimate-next-period', 'estimate-ovulation', 'guidance-body', 'hormone-curve', 'guidance-move-note', 'guidance-supps', 'guidance-evidence-key']) expect(screen.getByTestId(id)).toBeTruthy();
    expect(text()).toContain('Research on eating and training by cycle phase is young');
  });
  it('lists every source once, numbered on from the estimate references so the cards\' superscripts match', () => {
    show();
    const s = sources();
    expect(s.slice(0, 3)).toEqual(['1. Munro', '2. Bull', '3. Wilcox']);
    expect(s.length).toBeGreaterThan(3);
    expect(s.map((x) => Number.parseInt(x, 10))).toEqual(s.map((_, i) => i + 1));
    expect(screen.queryByTestId('guidance-sources')).toBeNull();
  });
  it('teen mode: no ovulation or fertile card, no supplements, no fertile-window source', () => {
    show({ history: hist([28, 30, 29], '2026-10-12'), profile: { birthDate: '2011-03-01' } }); // a period day: an adult would get supplements
    expect(screen.getByTestId('estimate-next-period')).toBeTruthy();
    expect(screen.queryByTestId('estimate-ovulation')).toBeNull();
    expect(screen.queryByTestId('guidance-supps')).toBeNull();
    expect(text()).not.toMatch(/ovulat|fertile/i);
    expect(text()).not.toContain('Wilcox');
  });
  it('with nothing logged it says what will appear', () => {
    show({ history: { cycles: [], temperatures: [], lh: [], mucus: [], cervix: [], logs: [] } });
    expect(screen.getByTestId('this-cycle-empty').textContent).toBe('Log a period to see the estimates for this cycle and what they mean.');
  });
  it('More about this cycle opens the segment with a fresh link each time', () => {
    render(<MoreAboutThisCycle />);
    const more = screen.getByTestId('this-cycle-more');
    expect(more.textContent).toBe('More about this cycle ›');
    expect(more.getAttribute('aria-label')).toBe('More about this cycle: estimates explained, food and movement, sources. Opens Insights, This cycle');
    fireEvent.click(more);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/insights', params: { tab: 'this-cycle', at: expect.any(String) } });
  });
});
