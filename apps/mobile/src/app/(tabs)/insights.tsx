import { useTranslation } from 'react-i18next';
import { Screen } from '@/ui/Screen';

export default function InsightsScreen() {
  const { t } = useTranslation();
  return <Screen testID="screen-insights" title={t('tabs.insights')}>{null}</Screen>;
}
