import { addDays, type ISODate, type PastOvulation, pastOvulations } from '@sanguine/engine';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { activeEvents } from '@/data/project';
import type { DayEvent } from '@/features/logging/actions';
import { shortDescribe } from '@/features/logging/describe';
import { visibleEntries } from '@/features/logging/removeEntry';
import { useApp } from '@/state/app';

export interface CalendarData {
  /** Logged period days (from the cycle projection plus period-kind flow days). */
  periodDays: Set<ISODate>;
  /** Every day with something logged. */
  loggedDays: Set<ISODate>;
  /** Days with at least one symptom. */
  symptomDays: Set<ISODate>;
  /** What was logged on each day, in the short phrases of the month list (period start and end markers left out, as in the old summary). */
  loggedText: Map<ISODate, string[]>;
  /** Retrospective ovulation estimates of closed cycles (engine; never written into the cycle records). */
  pastOv: PastOvulation[];
}
const EMPTY: Omit<CalendarData, 'pastOv' | 'periodDays'> = { loggedDays: new Set(), symptomDays: new Set(), loggedText: new Map() };
const LISTED = new Set(['flow', 'symptom', 'energy', 'biomarker', 'sex', 'note']);

/** The logged period days alone (the cycle projection plus period-kind flow days): two small queries, no event scan. Today's dial uses this. */
export function usePeriodDays(): Set<ISODate> {
  const { db, version } = useApp();
  const [days, setDays] = useState<Set<ISODate>>(() => new Set());
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads the projections after every write
  useEffect(() => {
    if (!db) return;
    void (async () => {
      const cycles = await db.all<{ start_day: string; end_day: string | null }>('SELECT start_day, end_day FROM cycle');
      const flows = await db.all<{ day: string }>("SELECT day FROM daily_log WHERE flow_kind = 'period' AND flow IN ('light','medium','heavy')");
      const period = new Set<ISODate>(flows.map((f) => f.day as ISODate));
      for (const c of cycles) {
        const end = c.end_day ?? c.start_day;
        for (let d = c.start_day as ISODate; d <= end; d = addDays(d, 1)) period.add(d);
      }
      setDays(period);
    })();
  }, [db, version]);
  return days;
}

/** Everything the calendar screen draws from the data layer; Today only needs `usePeriodDays`. */
export function useCalendarData(): CalendarData {
  const { db, store, version, history, settings, prefs } = useApp();
  const { t: tr } = useTranslation();
  const periodDays = usePeriodDays();
  const [data, setData] = useState(EMPTY);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads the projections after every write
  useEffect(() => {
    if (!db) return;
    void (async () => {
      // one pass over the active events, grouped by day and collapsed by the day detail's own rule (visibleEntries: a flow is never
      // retracted, so only the latest counts and a removed one is a 'none' flow); a day is "logged" only while something stays visible
      const byDay = new Map<ISODate, DayEvent[]>();
      for (const e of store ? activeEvents(await store.events()) : []) {
        if (!LISTED.has(e.kind) || !e.effective_day) continue;
        const day = e.effective_day as ISODate;
        byDay.set(day, [...(byDay.get(day) ?? []), { ...e, data: JSON.parse(e.payload) as Record<string, unknown> }]);
      }
      const symptomDays = new Set<ISODate>();
      const loggedText = new Map<ISODate, string[]>();
      for (const [day, evs] of byDay) {
        const shown = visibleEntries(evs);
        if (!shown.length) continue;
        if (shown.some((e) => e.kind === 'symptom')) symptomDays.add(day);
        loggedText.set(day, shown.map((e) => shortDescribe(e, tr, prefs.tempUnit)));
      }
      setData({ loggedDays: new Set(loggedText.keys()), symptomDays, loggedText });
    })();
  }, [db, store, version, tr, prefs.tempUnit]);
  const pastOv = useMemo(() => (history && settings ? pastOvulations(history, settings) : []), [history, settings]);
  return { periodDays, ...data, pastOv };
}
