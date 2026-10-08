import { useTranslation } from 'react-i18next';
import { Screen } from '@/ui/Screen';

export default function CalendarScreen() {
  const { t } = useTranslation();
  return <Screen testID="screen-calendar" title={t('tabs.calendar')}>{null}</Screen>;
}
