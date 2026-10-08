import { useTranslation } from 'react-i18next';
import { Screen } from '@/ui/Screen';

export default function SettingsScreen() {
  const { t } = useTranslation();
  return <Screen testID="screen-settings" title={t('tabs.settings')}>{null}</Screen>;
}
