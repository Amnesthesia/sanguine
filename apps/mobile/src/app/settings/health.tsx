import { useTranslation } from 'react-i18next';
import { Group, SettingsRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';

// Health sync needs native modules (Phase 4); the screen stays so the settings map is complete.
export default function HealthScreen() {
  const { t } = useTranslation();
  return (
    <SubScreen testID="screen-health" title={t('settings.health.title')}>
      <Group><SettingsRow title={t('settings.health.unavailable')} last /></Group>
    </SubScreen>
  );
}
