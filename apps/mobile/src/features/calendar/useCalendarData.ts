import { addDays, type ISODate } from '@sanguine/engine';
import { useEffect, useState } from 'react';
import { useApp } from '@/state/app';

/** Logged period days (from the cycle projection plus period-kind flow days) and every day with something logged. */
export function useCalendarData(): { periodDays: Set<ISODate>; loggedDays: Set<ISODate> } {
  const { db, version } = useApp();
  const [data, setData] = useState<{ periodDays: Set<ISODate>; loggedDays: Set<ISODate> }>({ periodDays: new Set(), loggedDays: new Set() });
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
      setData({ periodDays: period, loggedDays: new Set<ISODate>([...logs.map((l) => l.day), ...bio.map((b) => b.day)]) });
    })();
  }, [db, version]);
  return data;
}
