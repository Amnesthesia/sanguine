import { useTranslation } from 'react-i18next';
import { Screen } from '@/ui/Screen';

export default function TodayScreen() {
  const { t } = useTranslation();
  return <Screen testID="screen-today" title={t('tabs.today')}>{null}</Screen>;
}
