import { addDays, type ISODate, type PastOvulation, pastOvulations } from '@sanguine/engine';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { activeEvents } from '@/data/project';
import type { DayEvent } from '@/features/logging/actions';
import { shortDescribe } from '@/features/logging/describe';
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
const EMPTY: Omit<CalendarData, 'pastOv'> = { periodDays: new Set(), loggedDays: new Set(), symptomDays: new Set(), loggedText: new Map() };
const LISTED = new Set(['flow', 'symptom', 'energy', 'biomarker', 'sex', 'note']);

export function useCalendarData(): CalendarData {
  const { db, store, version, history, settings, prefs } = useApp();
  const { t: tr } = useTranslation();
  const [data, setData] = useState(EMPTY);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads the projections after every write
  useEffect(() => {
    if (!db) return;
    void (async () => {
      const cycles = await db.all<{ start_day: string; end_day: string | null }>('SELECT start_day, end_day FROM cycle');
      const flows = await db.all<{ day: string }>("SELECT day FROM daily_log WHERE flow_kind = 'period' AND flow IN ('light','medium','heavy')");
      const logs = await db.all<{ day: string }>('SELECT day FROM daily_log');
      const bio = await db.all<{ day: string }>('SELECT DISTINCT day FROM biomarker');
      const period = new Set<ISODate>(flows.map((f) => f.day));
      for (const c of cycles) {
        const end = c.end_day ?? c.start_day;
        for (let d = c.start_day as ISODate; d <= end; d = addDays(d, 1)) period.add(d);
      }
      // one pass over the active events gives the symptom days and the month list's phrases
      const symptomDays = new Set<ISODate>();
      const loggedText = new Map<ISODate, string[]>();
      for (const e of store ? activeEvents(await store.events()) : []) {
        if (!LISTED.has(e.kind) || !e.effective_day) continue;
        const day = e.effective_day as ISODate;
        if (e.kind === 'symptom') symptomDays.add(day);
        const ev: DayEvent = { ...e, data: JSON.parse(e.payload) as Record<string, unknown> };
        loggedText.set(day, [...(loggedText.get(day) ?? []), shortDescribe(ev, tr, prefs.tempUnit)]);
      }
      setData({ periodDays: period, loggedDays: new Set<ISODate>([...logs.map((l) => l.day), ...bio.map((b) => b.day)]), symptomDays, loggedText });
    })();
  }, [db, store, version, tr, prefs.tempUnit]);
  const pastOv = useMemo(() => (history && settings ? pastOvulations(history, settings) : []), [history, settings]);
  return { ...data, pastOv };
}
