import type { CycleRecord, ISODate, PastOvulation } from '@sanguine/engine';
import { useMemo } from 'react';
import { phaseOn } from '@/features/guidance/guidance';
import { DayEstimateRows } from '@/features/guidance/sections/EstimateSections';
import { BodyCard } from '@/features/guidance/sections/GuidanceSections';
import { MoreAboutThisCycle } from '@/features/insights/ThisCycle';
import { useApp } from '@/state/app';
import { cycleHeadlines, dayEstimates } from './calendarModel';

export interface SheetDetailProps {
  /** The selected day. */
  day: ISODate;
  pastOv: PastOvulation[];
  /** Unused since D-134 (the full estimate cards moved to Insights > This cycle); calendar.tsx still passes it. */
  cycleStarts: readonly ISODate[];
  periodDays: ReadonlySet<ISODate>;
  /** The estimate gates, already through effectivePrefs (teen mode outranks the stored switches, D-115). */
  showEstimate: boolean;
  includeUncertain: boolean;
  /** Unused since D-134 (supplements live in Insights > This cycle); calendar.tsx still passes it. */
  teen: boolean;
  /** Her analysed cycles (analyzeCycles records), for the phase. */
  records: CycleRecord[];
}

/**
 * The day sheet's large detent below the logged chips (frame Calendar-3-SheetExpanded; P8-31, D-134): the estimates covering the day as short
 * rows with their meters, a compact "What is changing" curve with one phase sentence, and "More about this cycle ›" to Insights > This cycle,
 * where the explanations, food and movement and the sources now live. Log this day and Open day are the sheet's own footer.
 */
export function SheetDetail({ day, pastOv, periodDays, showEstimate, includeUncertain, records }: SheetDetailProps) {
  const { prediction, prefs, today } = useApp();
  // the same words as the small detent and the bar (calendar.tsx builds them from the same call)
  const lines = useMemo(
    () => {
      const own = dayEstimates(day, { prediction, pastOv, showEstimate, includeUncertain, period: periodDays.has(day), today });
      const heads = showEstimate ? cycleHeadlines(day, { prediction, pastOv, showEstimate, includeUncertain, today }).filter((l) => !own.includes(l)) : [];
      return [...heads, ...own];
    },
    [day, prediction, pastOv, showEstimate, includeUncertain, periodDays, today],
  );
  // the phase for the day: same call and inputs as the day screen, so both show the same phase
  const guide = useMemo(
    () => (prefs.cycleGuidance ? phaseOn({ date: day, today, prediction, cycles: records, showEstimate }) : undefined),
    [prefs.cycleGuidance, day, today, prediction, records, showEstimate],
  );
  return (
    <>
      <DayEstimateRows lines={lines} future={day > today} />
      {guide ? <BodyCard day={guide} compact extras={showEstimate} /> : null}
      <MoreAboutThisCycle />
    </>
  );
}
