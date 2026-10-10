// Cycle detail (PLAN.md §8.3): one cycle, where its ovulation estimate came from, and whether it counts toward estimates.
import { analyzeCycles, diffDays } from '@sanguine/engine';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { effectivePrefs } from '@/data/prefs';
import { activeEvents } from '@/data/project';
import { useApp } from '@/state/app';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { formatDayYear } from '@/ui/format';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

export default function CycleDetail() {
  const { t: tr } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { history, settings, prediction, store, refresh, prefs, profile, today } = useApp();
  // under 18 the ovulation date, its basis and the luteal length stay hidden like everywhere else (§8.6, I-18, D-075)
  const { fertilityTools } = effectivePrefs(prefs, profile, today);
  const classified = useMemo(() => (history && settings ? analyzeCycles(history, settings) : []), [history, settings]);
  const entry = classified.find((c) => c.record.id === id);
  const c = entry?.record;
  const conflict = prediction?.cycleQuality.find((q) => q.cycleId === id)?.conflict;

  async function toggleExclude() {
    if (!store || !c) return;
    if (c.quality === 'user_excluded') {
      const ev = activeEvents(await store.events()).find((e) => e.kind === 'cycle.exclude' && (JSON.parse(e.payload) as { cycle_start: string }).cycle_start === c.start);
      if (ev) await store.retract(ev.id);
    } else await store.append({ kind: 'cycle.exclude', payload: { cycle_start: c.start, reason: 'user_excluded' } });
    await refresh();
  }
  if (!c) return <SubScreen testID="screen-cycle" backTestID="cycle-back" title={tr('insights.cycleDetail.title')}>{null}</SubScreen>;

  const luteal = c.ovulation && c.ovulation.basis !== 'calendar' && c.nextStart ? diffDays(c.nextStart, c.ovulation.point) - 1 : undefined;
  return (
    <SubScreen testID="screen-cycle" backTestID="cycle-back" title={formatDayYear(c.start)} bottomInset={32}>
      <Card>
        <Text>{c.length ? `${tr('insights.cycleDetail.length')}: ${c.length} days` : `${tr('insights.cycleDetail.length')}: ${tr('insights.dayN', { day: diffDays(today, c.start) + 1 })}`}</Text>
        {c.bleedDays ? <Text>{`${tr('insights.cycleDetail.bleed')}: ${c.bleedDays} days`}</Text> : null}
        <Text>{`${tr('insights.cycleDetail.quality')}: ${tr(`insights.quality.${c.quality}`)}`}</Text>
        {entry?.reason ? <Text variant="bodySmall" color="textSecondary">{entry.reason}</Text> : null}
      </Card>
      {fertilityTools ? <Card testID="cycle-ovulation">
        <Text variant="heading">{tr('insights.cycleDetail.ovulation')}</Text>
        {c.ovulation && c.ovulation.basis !== 'calendar' ? (<>
          <Text>{formatDayYear(c.ovulation.point)}</Text>
          <Text variant="bodySmall" color="textSecondary">{tr('insights.cycleDetail.ovulationBasis', { basis: tr(`insights.ovulationBasis.${c.ovulation.basis}`).replace('ovulation: ', '') })}</Text>
          {luteal !== undefined ? <Text variant="bodySmall" color="textSecondary">{tr('insights.cycleDetail.luteal', { days: luteal })}</Text> : null}
        </>) : <Text variant="bodySmall" color="textSecondary">{tr('insights.cycleDetail.ovulationNone')}</Text>}
        {conflict ? <Text variant="bodySmall" testID="cycle-conflict">{tr('insights.cycleDetail.conflict')}</Text> : null}
      </Card> : null}
      {c.quality === 'user_excluded' ? <Text variant="bodySmall" color="textSecondary">{tr('insights.cycleDetail.excluded')}</Text> : null}
      <Button testID="cycle-exclude" kind="secondary" label={c.quality === 'user_excluded' ? tr('insights.cycleDetail.include') : tr('insights.cycleDetail.exclude')} onPress={() => void toggleExclude()} />
    </SubScreen>
  );
}
