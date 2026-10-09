// How Sanguine estimates (P8-3, roadmap R2-6): fixed reference text, not an article feed (PLAN.md §8.1). Under 18, until the
// fertility tools are unlocked, the sentence about dating ovulation is replaced by one without fertility terms (§8.6).
import { useTranslation } from 'react-i18next';
import { effectivePrefs } from '@/data/prefs';
import { useApp } from '@/state/app';
import { Card } from '@/ui/Card';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

export default function HowScreen() {
  const { t } = useTranslation();
  const { prefs, profile, today } = useApp();
  const { fertilityTools } = effectivePrefs(prefs, profile, today);
  const section = (title: string, ...body: string[]) => (
    <>
      <Text variant="heading" accessibilityRole="header">{t(title)}</Text>
      <Card>{body.map((b) => <Text key={b} variant="bodySmall">{t(b)}</Text>)}</Card>
    </>
  );
  return (
    <SubScreen testID="screen-how" title={t('settings.how.title')}>
      {section('settings.how.rangeTitle', 'settings.how.rangeBody')}
      {section('settings.how.confidenceTitle', 'settings.how.confidenceHigh', 'settings.how.confidenceMedium', 'settings.how.confidenceLow', 'settings.how.confidenceNone')}
      {section('settings.how.narrowTitle', fertilityTools ? 'settings.how.narrowBody' : 'settings.how.narrowBodyTeen')}
      {section('settings.how.symptomsTitle', 'settings.how.symptomsBody')}
      {section('settings.how.accuracyTitle', 'settings.how.accuracyBody')}
    </SubScreen>
  );
}
