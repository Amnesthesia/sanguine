// Insights > This cycle (frame Insights-This-Cycle; P8-31, D-134): the single home of the long explanations that left the calendar sheet and the
// day screen. The current cycle as of today: the estimate cards with "How it was worked out", food and movement for today's phase with the full
// hormone curve, supplements (not under 18), the evidence key, one numbered source list (the estimate references first, so the cards' superscripts
// 1 to 3 match) and the general caveat. Teen mode and the estimate switches reach the sections through effectivePrefs, as everywhere else.
import { analyzeCycles, pastOvulations } from '@sanguine/engine';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { effectivePrefs } from '@/data/prefs';
import { countedStarts, cycleDayOf } from '@/features/calendar/calendarModel';
import { usePeriodDays } from '@/features/calendar/useCalendarData';
import { phaseOn, showSupplements } from '@/features/guidance/guidance';
import { EstimateSections, estimateSources } from '@/features/guidance/sections/EstimateSections';
import { GuidanceSections, splitSources } from '@/features/guidance/sections/GuidanceSections';
import { SHOW_OVULATION_ESTIMATE } from '@/features/today/todayModel';
import { useApp } from '@/state/app';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { formatDay } from '@/ui/format';
import { Sources } from '@/ui/Sources';
import { Text } from '@/ui/Text';

/** The link to this segment. `at` changes on every tap, so a second tap opens it again after she moved to another segment. */
export const thisCycleHref = () => ({ pathname: '/insights' as const, params: { tab: 'this-cycle', at: String(Date.now()) } });

/** "More about this cycle ›" (calendar sheet, day screen): a secondary pill that opens Insights > This cycle. */
export function MoreAboutThisCycle() {
  const { t: tr } = useTranslation();
  const router = useRouter();
  return <Button testID="this-cycle-more" kind="secondary" label={`${tr('insights.thisCycle.more')} ›`} accessibilityLabel={tr('insights.thisCycle.moreA11y')} onPress={() => router.push(thisCycleHref())} style={{ alignSelf: 'center' }} />;
}

export function ThisCycle() {
  const { t: tr } = useTranslation();
  const { prediction, history, settings, today, prefs, profile } = useApp();
  const eff = effectivePrefs(prefs, profile, today);
  const showEstimate = SHOW_OVULATION_ESTIMATE && eff.showOvulationEstimate;
  const includeUncertain = eff.showUncertainEstimates;
  const records = useMemo(() => (history && settings ? analyzeCycles(history, settings).map((c) => c.record) : []), [history, settings]);
  const pastOv = useMemo(() => (history && settings ? pastOvulations(history, settings) : []), [history, settings]);
  const cycleStarts = useMemo(() => history?.cycles.map((c) => c.start) ?? [], [history]);
  const periodDays = usePeriodDays();
  // her recent closed periods, oldest first, for the period-end card
  const periodLengths = useMemo(() => records.filter((r) => r.nextStart && r.bleedDays).map((r) => r.bleedDays as number).slice(-6), [records]);
  const guide = useMemo(
    () => (prefs.cycleGuidance && history && settings ? phaseOn({ date: today, today, prediction, cycles: records, showEstimate }) : undefined),
    [prefs.cycleGuidance, history, settings, today, prediction, records, showEstimate],
  );
  const est = prediction ? { prediction, day: today, pastOv, cycleStarts, periodDays, showEstimate, includeUncertain, periodLengths } : undefined;
  const sources = [...(est ? estimateSources(est, tr) : []), ...(guide ? splitSources(tr(`guidance.${guide.phase}.sources`)) : [])];
  if (!sources.length) return <Card testID="this-cycle-empty"><Text color="textSecondary">{tr('insights.thisCycle.empty')}</Text></Card>;

  // "This cycle, from 31 Oct · day 3 · Period"; no cycle day while estimates are paused (countedStarts)
  const starts = countedStarts({ prediction, cycleStarts });
  const start = starts.filter((s) => s <= today).sort().at(-1);
  const n = cycleDayOf(starts, today);
  const heading = [start && n ? tr('insights.thisCycle.heading', { start: formatDay(start), day: n }) : null, guide ? tr(`guidance.phase.${guide.phase}`) : null].filter(Boolean).join(' · ');
  return (
    <View testID="this-cycle" style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        {heading ? <Text variant="bodySmall" color="textSecondary" testID="this-cycle-heading">{heading}</Text> : null}
        <Text>{tr('insights.thisCycle.intro')}</Text>
      </View>
      {est ? <EstimateSections {...est} /> : null}
      {guide ? <GuidanceSections day={guide} supplements={showSupplements(eff.teen)} compact={false} /> : null}
      <View testID="this-cycle-sources" style={{ gap: 8 }}>
        <Text variant="heading" accessibilityRole="header">{tr('estimates.how.sources')}</Text>
        <Sources items={sources} />
        {guide ? <Text variant="caption" color="textSecondary">{tr('guidance.caveat')}</Text> : null}
      </View>
    </View>
  );
}
