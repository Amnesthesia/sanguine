// One cycle in Insights > History (PLAN.md §8.3). The summary is the button that opens the cycle; the correction actions sit
// beside it, not inside it: a pressable with a label is a single accessibility element, so buttons nested in it cannot be
// reached by VoiceOver or TalkBack (D-093, follow-up to U-24).
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import type { HistoryRow as Row } from './insightsModel';

export function HistoryRow({ r, fertilityTools, onOpen, actions }: { r: Row; fertilityTools: boolean; onOpen: () => void; actions?: ReactNode }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const title = [r.start, r.lengthDays ? tr('insights.lengthDays', { n: r.lengthDays }) : tr('insights.dayN', { day: r.dayOfCycle })].join(' · ');
  const detail = [r.bleedDays ? tr('insights.bleedDays', { n: r.bleedDays }) : null, fertilityTools ? tr(`insights.ovulationBasis.${r.basis}`) : null].filter(Boolean).join(' · ');
  const status = r.current ? tr('insights.current') : tr(`insights.quality.${r.quality}`);
  const muted = r.current || r.quality === 'valid';
  return (
    <Card testID={`history-${r.id}`}>
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
      {actions}
    </Card>
  );
}
