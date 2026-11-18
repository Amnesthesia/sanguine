import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import '@/i18n';
import { migrate } from '@/data/migrate';
import { DEFAULT_PREFS } from '@/data/prefs';
import { EventStore } from '@/data/store';
import { openTestDb } from '@/data/testDb';
import { dayEvents, saveLh, setFlow, setSymptom } from '@/features/logging/actions';
import { removeEntry, visibleEntries } from '@/features/logging/removeEntry';
import { useCalendarData, usePeriodDays } from './useCalendarData';

const app = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('@/state/app', () => ({ useApp: () => app.state }));
afterEach(cleanup);

const DAY = '2026-11-10';
async function setup() {
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  const store = new EventStore(db, { nowMs: () => 1_700_000_000_000 + n++, iso: () => `${DAY}T08:00:00+10:00`, tz: () => 'Australia/Brisbane', randomBytes: (k) => Uint8Array.from({ length: k }, (_, i) => (n + i) % 256) });
  app.state = { db, store, version: 0, prefs: DEFAULT_PREFS, history: undefined, settings: undefined };
  return { db, store };
}

it('gives one phrase per entry, marks symptom days, and leaves a retracted symptom out', async () => {
  const { db, store } = await setup();
  await setSymptom(store, DAY, 'cramps', 2);
  await setSymptom(store, DAY, 'headache', 1);
  await saveLh(store, '2026-11-12', 'negative');
  const { result, rerender } = renderHook(() => useCalendarData());
  await waitFor(() => expect(result.current.loggedText.get(DAY)).toHaveLength(2));
  expect([...result.current.symptomDays]).toEqual([DAY]);
  expect(result.current.loggedDays.has('2026-11-12')).toBe(true);
  expect(result.current.symptomDays.has('2026-11-12')).toBe(false);
  const cramps = visibleEntries(await dayEvents(store, DAY)).find((e) => e.kind === 'symptom' && JSON.stringify(e.data).includes('cramps'));
  await removeEntry(store, db, cramps as NonNullable<typeof cramps>);
  const headache = visibleEntries(await dayEvents(store, DAY)).find((e) => e.kind === 'symptom') as NonNullable<typeof cramps>;
  await removeEntry(store, db, headache);
  app.state = { ...app.state, version: 1 };
  rerender();
  await waitFor(() => expect(result.current.symptomDays.size).toBe(0));
  expect(result.current.loggedText.get(DAY)).toBeUndefined();
});

it('usePeriodDays reads the period days without scanning events', async () => {
  const { store } = await setup();
  const events = vi.spyOn(store, 'events');
  await setFlow(store, DAY, 'medium');
  events.mockClear();
  const { result } = renderHook(() => usePeriodDays());
  await waitFor(() => expect(result.current.has(DAY)).toBe(true));
  expect(events).not.toHaveBeenCalled();
});

it('useCalendarData carries the same period days', async () => {
  const { store } = await setup();
  await setFlow(store, DAY, 'light');
  const { result } = renderHook(() => useCalendarData());
  await waitFor(() => expect(result.current.periodDays.has(DAY)).toBe(true));
});
