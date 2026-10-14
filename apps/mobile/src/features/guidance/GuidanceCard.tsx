// Food, movement and supplement notes (P8-18, D-107). Every note shows its tip, reason and grade on both surfaces (owner: reasons on Today);
// the day screen adds what changes in the body and the sources.
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import { GUIDANCE, type GuideDay } from './guidance';

const label = { fontWeight: '600' as const };

export function GuidanceCard({ day, supplements, full = false, onMore, energyLow = false }: { day: GuideDay; supplements: boolean; full?: boolean; onMore?: () => void; energyLow?: boolean }) {
  const { t } = useTranslation();
  const p = day.phase;
  const supps = supplements ? GUIDANCE[p].supps : [];
  // one graded note: the tip, its reason, and how well supported it is
  const item = (testID: string, key: string, evidence: string) => (
    <View key={testID} testID={testID} style={{ gap: 2 }}>
      <Text>{t(`${key}.tip`)}</Text>
      <Text variant="bodySmall" color="textSecondary">{t(`${key}.why`)}</Text>
      <Text variant="caption" color="textSecondary">{t(`guidance.evidence.${evidence}`)}</Text>
    </View>
  );
  return (
    <Card testID="guidance-card" style={{ gap: 10 }}>
      <Text variant="heading" accessibilityRole="header">{t('guidance.title')}</Text>
      <Text variant="caption" color="textSecondary" testID={`guidance-phase-${p}`}>{t(day.expected ? 'guidance.phaseExpected' : 'guidance.phaseLine', { phase: t(`guidance.phase.${p}`) })}</Text>
      {energyLow ? <Text variant="bodySmall" testID="guidance-energy-low">{t('guidance.energyLow')}</Text> : null}
      {full ? (
        <View style={{ gap: 2 }}>
          <Text variant="bodySmall" style={label}>{t('guidance.bodyLabel')}</Text>
          <Text testID="guidance-body">{t(`guidance.${p}.body`)}</Text>
        </View>
      ) : null}
      <View testID="guidance-food" style={{ gap: 8 }}>
        <Text variant="bodySmall" style={label}>{t('guidance.foodLabel')}</Text>
        {GUIDANCE[p].foods.map((f) => item(`guidance-food-${f.id}`, `guidance.food.${f.id}`, f.evidence))}
      </View>
      <View testID="guidance-move" style={{ gap: 2 }}>
        <Text variant="bodySmall" style={label}>{t('guidance.moveLabel')}</Text>
        {item('guidance-move-note', `guidance.${p}.move`, GUIDANCE[p].move)}
      </View>
      {supps.length ? (
        <View testID="guidance-supps" style={{ gap: 8 }}>
          <Text variant="bodySmall" style={label}>{t('guidance.suppLabel')}</Text>
          {supps.map((s) => item(`guidance-supp-${s.id}`, `guidance.supp.${s.id}`, s.evidence))}
          <Text variant="caption" color="textSecondary">{t('guidance.suppCaveat')}</Text>
        </View>
      ) : null}
      {full ? <Text variant="caption" color="textSecondary" testID="guidance-sources">{`${t('guidance.sourcesLabel')}: ${t(`guidance.${p}.sources`)}`}</Text> : null}
      <Text variant="caption" color="textSecondary">{t('guidance.caveat')}</Text>
      {!full && onMore ? <Button kind="text" testID="guidance-more" label={t('guidance.more')} accessibilityLabel={t('guidance.moreA11y')} onPress={onMore} /> : null}
    </Card>
  );
}
