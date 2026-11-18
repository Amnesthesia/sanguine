// One cycle in Insights > History (PLAN.md §8.3). The summary is the button that opens the cycle; the correction actions sit
// beside it, not inside it: a pressable with a label is a single accessibility element, so buttons nested in it cannot be
// reached by VoiceOver or TalkBack (D-093, follow-up to U-24).
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { confidenceLevel, Meter } from '@/ui/Meter';
import { Text } from '@/ui/Text';
import type { HistoryRow as Row } from './insightsModel';
import type { LengthSummary } from './readings';

/** Shown above the history when the cycles vary: their range, the lengths, and how sure the next-period estimate is. */
export function LengthSummaryCard({ s }: { s: LengthSummary }) {
  const { t: tr } = useTranslation();
  return (
    <Card testID="length-summary" style={{ gap: 12 }}>
      <Text variant="heading" accessibilityRole="header">{tr('insights.lengthSummary.range', { min: s.min, max: s.max })}</Text>
      <Meter level={confidenceLevel(s.confidence)} word={tr(`estimates.how.confidence.${s.confidence}`)} />
      <Text variant="bodySmall">{tr('insights.lengthSummary.lengths', { list: s.lengths.join(', '), spread: s.spread })}</Text>
      {/* this list keeps cycles she left out; the chart on the Charts tab does not, so say which is which */}
      <Text variant="caption" color="textSecondary">{tr('insights.lengthSummary.scope', { n: s.lengths.length })}</Text>
    </Card>
  );
}

export function HistoryRow({ r, fertilityTools, onOpen, onInclude, actions }: { r: Row; fertilityTools: boolean; onOpen: () => void; onInclude?: () => void; actions?: ReactNode }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const title = [r.start, r.lengthDays ? tr('insights.lengthDays', { n: r.lengthDays }) : tr('insights.dayN', { day: r.dayOfCycle })].join(' · ');
  const detail = [r.bleedDays ? tr('insights.bleedDays', { n: r.bleedDays }) : null, fertilityTools ? tr(`insights.ovulationBasis.${r.basis}`) : null].filter(Boolean).join(' · ');
  const status = r.current ? tr('insights.current') : tr(`insights.quality.${r.quality}`);
  const muted = r.current || r.quality === 'valid';
  return (
    <Card testID={`history-${r.id}`} style={{ gap: 10 }}>
      <Pressable testID="cycle-detail-link" accessibilityRole="button" accessibilityLabel={[title, detail, status, tr('insights.viewCycle')].filter(Boolean).join('. ')} onPress={onOpen} style={{ minHeight: 56 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="heading">{title}</Text>
            {detail ? <Text variant="bodySmall" color="textSecondary">{detail}</Text> : null}
            {/* "typical" and "current" stay muted; anything unusual is tonal so it is seen (U-23) */}
            <View style={{ alignSelf: 'flex-start', backgroundColor: muted ? t.chipBg : t.c.accentSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
              <Text variant="caption" color={muted ? 'textSecondary' : 'onAccentSoft'}>{status}</Text>
            </View>
          </View>
          <Text color="textSecondary" accessibilityElementsHidden importantForAccessibility="no">›</Text>
        </View>
      </Pressable>
      {r.quality === 'user_excluded' ? (<>
        <Text variant="caption" color="textSecondary">{tr('insights.cycleDetail.excluded')}</Text>
        <Text variant="caption" color="textSecondary">{tr('insights.excludedByYou')}</Text>
        {onInclude ? <Button kind="secondary" style={{ alignSelf: 'flex-start' }} testID={`include-cycle-${r.id}`} label={tr('insights.cycleDetail.include')} accessibilityLabel={tr('insights.includeLabel', { date: r.start })} onPress={onInclude} /> : null}
      </>) : null}
      {actions}
    </Card>
  );
}
