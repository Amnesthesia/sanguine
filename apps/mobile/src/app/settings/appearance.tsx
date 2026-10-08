import { useTranslation } from 'react-i18next';
import type { ThemePref } from '@/data/prefs';
import { useApp } from '@/state/app';
import { OptionList } from '@/ui/OptionList';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

export default function AppearanceScreen() {
  const { t } = useTranslation();
  const { prefs, updatePrefs } = useApp();
  const opts: Array<{ value: ThemePref; label: string }> = [
    { value: 'system', label: t('settings.appearance.themeSystem') }, { value: 'light', label: t('settings.appearance.themeLight') }, { value: 'dark', label: t('settings.appearance.themeDark') },
  ];
  return (
    <SubScreen testID="screen-appearance" title={t('settings.appearance.title')}>
      <OptionList testIDPrefix="theme" value={prefs.theme} onChange={(v) => void updatePrefs({ theme: v })} options={opts} />
      <Text variant="bodySmall" color="textSecondary">{t('settings.appearance.motionNote')}</Text>
    </SubScreen>
  );
}
