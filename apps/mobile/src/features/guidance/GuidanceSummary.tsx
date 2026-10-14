// apps/mobile/src/features/guidance/GuidanceSummary.tsx
// Calendar: a brief summary of the selected day's food and movement notes, in its own card below the day card (owner, 2026-10-14).
// Tapping it opens the day screen, which has the full notes with reasons, evidence grades and sources.
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import type { GuideDay } from './guidance';

export function GuidanceSummary({ day, onOpen }: { day: GuideDay; onOpen: () => void }) {
  const { t } = useTranslation();
  const p = day.phase;
  const phase = t(day.expected ? 'guidance.phaseExpected' : 'guidance.phaseLine', { phase: t(`guidance.phase.${p}`) });
  const food = `${t('guidance.foodLabel')}: ${t(`guidance.summary.${p}.food`)}`;
  const move = `${t('guidance.moveLabel')}: ${t(`guidance.summary.${p}.move`)}`;
  return (
    <Pressable testID="guidance-summary" accessibilityRole="button" accessibilityLabel={[t('guidance.title'), phase, food, move, t('guidance.readMore')].join('. ')} onPress={onOpen} style={{ minHeight: 56 }}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="heading" accessibilityRole="header">{t('guidance.title')}</Text>
          <Text variant="caption" color="textSecondary" testID={`guidance-summary-phase-${p}`}>{phase}</Text>
          <Text variant="bodySmall" testID="guidance-summary-food">{food}</Text>
          <Text variant="bodySmall" testID="guidance-summary-move">{move}</Text>
          <Text variant="caption" color="accent">{t('guidance.readMore')}</Text>
        </View>
        <Text color="textSecondary" accessibilityElementsHidden>›</Text>
      </Card>
    </Pressable>
  );
}
