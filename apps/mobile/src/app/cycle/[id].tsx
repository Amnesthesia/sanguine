// Cycle detail (PLAN.md §8.3): one cycle, where its ovulation estimate came from, and whether it counts toward estimates.
import { analyzeCycles, detectBbtShift, diffDays, pastOvulations } from '@sanguine/engine';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { effectivePrefs } from '@/data/prefs';
import { fromC } from '@/features/logging/actions';
import { setCycleExcluded } from '@/features/insights/cycleExclude';
import { cycleOvulation, ovulationWords } from '@/features/insights/insightsModel';
import { cycleTimeline } from '@/features/insights/readings';
import { SHOW_OVULATION_ESTIMATE } from '@/features/today/todayModel';
import { useApp } from '@/state/app';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EstimateTag } from '@/ui/EstimateTag';
import { formatDay, formatDayYear, formatRange } from '@/ui/format';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

export default function CycleDetail() {
  const { t: tr } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { history, settings, prediction, store, refresh, prefs, profile, today } = useApp();
  // under 18 the ovulation date, its basis and the luteal length stay hidden like everywhere else (§8.6, I-18, D-075)
  const eff = effectivePrefs(prefs, profile, today);
  const { fertilityTools } = eff;
  const classified = useMemo(() => (history && settings ? analyzeCycles(history, settings) : []), [history, settings]);
  const pastOv = useMemo(() => (history && settings ? pastOvulations(history, settings) : []), [history, settings]);
  const entry = classified.find((c) => c.record.id === id);
  const c = entry?.record;
  const conflict = prediction?.cycleQuality.find((q) => q.cycleId === id)?.conflict;

  async function toggleExclude() {
    if (!store || !c) return;
    await setCycleExcluded(store, c.start, c.quality !== 'user_excluded');
    await refresh();
  }
  if (!c) return <SubScreen testID="screen-cycle" backTestID="cycle-back" title={tr('insights.cycleDetail.title')}><Card testID="cycle-missing"><Text color="textSecondary">{tr('insights.cycleDetail.missing')}</Text></Card></SubScreen>;

  // the same estimate and words as the cycle's row in Insights: a date range, its basis in plain words, nothing when hidden or when the engine gives none
  const ov = ovulationWords(cycleOvulation(c, pastOv, prediction), { show: fertilityTools && SHOW_OVULATION_ESTIMATE && eff.showOvulationEstimate, includeUncertain: eff.showUncertainEstimates }, tr);
  const luteal = c.ovulation && c.ovulation.basis !== 'calendar' && c.nextStart ? diffDays(c.nextStart, c.ovulation.point) - 1 : undefined;
  // the same readings Insights charts: undisturbed, by mouth, vagina or other (not wrist or finger)
  const temps = (history?.temperatures ?? []).filter((r) => !r.disturbed && (r.source === 'oral' || r.source === 'vaginal' || r.source === 'other'));
  const timeline = cycleTimeline(c, history?.lh ?? [], history ? detectBbtShift(history.temperatures, c.start)?.firstHighDate : undefined, fertilityTools, temps);
  const timelineText = (e: (typeof timeline)[number]): string => {
    switch (e.kind) {
      case 'started': return tr('insights.cycleDetail.started', { date: formatDayYear(e.from) });
      case 'bleeding': return tr('insights.cycleDetail.timelineBleeding', { range: formatRange(e.from, e.to ?? e.from) });
      case 'ended': return tr('insights.cycleDetail.ended', { date: formatDayYear(e.from) });
      case 'lh': return tr('insights.cycleDetail.timelineLh', { date: formatDay(e.from) });
      case 'rise': return tr('insights.cycleDetail.timelineRise', { date: formatDay(e.from) });
      case 'reading': return tr('insights.cycleDetail.timelineReading', { date: formatDay(e.from), value: fromC(e.valueC ?? 0, prefs.tempUnit).toFixed(2), unit: prefs.tempUnit });
      case 'next': return tr('insights.cycleDetail.timelineNext', { date: formatDay(e.from) });
    }
  };
  return (
    <SubScreen testID="screen-cycle" backTestID="cycle-back" title={formatDayYear(c.start)} bottomInset={32}>
      <Card style={{ gap: 12 }}>
        <Text>{c.length ? `${tr('insights.cycleDetail.length')}: ${c.length} days` : `${tr('insights.cycleDetail.length')}: ${tr('insights.dayN', { day: diffDays(today, c.start) + 1 })}`}</Text>
        {c.bleedDays ? <Text>{`${tr('insights.cycleDetail.bleed')}: ${c.bleedDays} days`}</Text> : null}
        <Text>{`${tr('insights.cycleDetail.quality')}: ${tr(`insights.quality.${c.quality}`)}`}</Text>
        {entry?.reason ? <Text variant="bodySmall" color="textSecondary">{entry.reason}</Text> : null}
      </Card>
      <Card testID="cycle-timeline" style={{ gap: 12 }}>
        <Text variant="heading" accessibilityRole="header">{tr('insights.cycleDetail.timeline')}</Text>
        {timeline.map((e) => <Text key={e.kind}>{timelineText(e)}</Text>)}
      </Card>
      {ov ? <Card testID="cycle-ovulation" style={{ gap: 12 }}>
        <Text variant="heading" accessibilityRole="header">{tr('insights.cycleDetail.ovulation')}</Text>
        <EstimateTag />
        <Text>{ov.line}</Text>
        <Text variant="bodySmall" color="textSecondary">{ov.basis ? tr('insights.cycleDetail.ovulationBasis', { basis: ov.basis }) : tr('insights.cycleDetail.ovulationNone')}</Text>
        {ov.basis && luteal !== undefined ? <Text variant="bodySmall" color="textSecondary">{tr('insights.cycleDetail.luteal', { days: luteal })}</Text> : null}
        {conflict ? <Text variant="bodySmall" testID="cycle-conflict">{tr('insights.cycleDetail.conflict')}</Text> : null}
      </Card> : null}
      {c.quality === 'user_excluded' ? <Text variant="bodySmall" color="textSecondary">{tr('insights.cycleDetail.excluded')}</Text> : null}
      <Button testID="cycle-exclude" kind="secondary" label={c.quality === 'user_excluded' ? tr('insights.cycleDetail.include') : tr('insights.cycleDetail.exclude')} onPress={() => void toggleExclude()} />
    </SubScreen>
  );
}
