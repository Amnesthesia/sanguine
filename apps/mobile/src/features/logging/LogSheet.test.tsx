import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import '@/i18n';
import { DEFAULT_PREFS } from '@/data/prefs';
import { migrate } from '@/data/migrate';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { dayState, setFlow } from './actions';

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('@/state/app', () => ({ useApp: () => app.state }));
vi.mock('expo-router', () => ({ useRouter: () => ({ back: vi.fn() }), useLocalSearchParams: () => ({}) }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('./MoreSection', () => ({ MoreSection: () => null }));
vi.mock('./SymptomGrid', () => ({ SymptomGrid: () => null }));
vi.mock('./FlowSelector', () => ({ FlowSelector: ({ onChange }: { onChange: (v: string) => void }) => <button type="button" onClick={() => onChange('medium')}>Log medium</button> }));
import { LogSheet } from './LogSheet';

afterEach(cleanup);

it('logs an IUD period, preserves old other bleeding, and can explicitly reclassify it', async () => {
  const today = '2026-10-17';
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  const store = new EventStore(db, { nowMs: () => 1_700_000_000_000 + n++, iso: () => `${today}T08:00:00+10:00`, tz: () => 'Australia/Brisbane', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) });
  app.state = { db, store, today, prefs: DEFAULT_PREFS, settings: { lifeStates: [{ kind: 'hormonal_contraception', method: 'hormonal_iud', since: '2026-01-01' }] }, refresh: vi.fn() };
  const view = render(<LogSheet />);
  await waitFor(() => expect(screen.getByTestId('bleed-kind-period').getAttribute('aria-checked')).toBe('true'));
  fireEvent.click(screen.getByText('Log medium'));
  await waitFor(async () => expect((await dayState(db, today)).flowKind).toBe('period'));
  view.unmount();
  await setFlow(store, today, 'medium', { kind: 'on_contraception' });
  render(<LogSheet />);
  await waitFor(() => expect(screen.getByTestId('bleed-kind-on_contraception').getAttribute('aria-checked')).toBe('true'));
  expect((await dayState(db, today)).flowKind).toBe('on_contraception');
  fireEvent.click(screen.getByTestId('bleed-kind-period'));
  fireEvent.click(screen.getByText('Log medium'));
  await waitFor(async () => expect((await dayState(db, today)).flowKind).toBe('period'));
});
