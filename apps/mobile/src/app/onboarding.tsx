import { useTranslation } from 'react-i18next';
import { useApp } from '@/state/app';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

// Placeholder shell; the five steps are P2-7.
export default function Onboarding() {
  const { t } = useTranslation();
  const done = useApp((s) => s.completeOnboarding);
  return (
    <Screen testID="screen-onboarding" title={t('onboarding.s1.title')} bottomInset={24}>
      <Text>{t('onboarding.s1.body')}</Text>
      <Button label={t('common.continue')} onPress={() => void done()} testID="onboarding-continue" />
    </Screen>
  );
}
