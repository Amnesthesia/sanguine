import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CHOICE_OF, currentLifeStates, lifeStateHistory } from '@/features/settings/lifeState';
import { useApp } from '@/state/app';
import { Group, SettingsRow } from '@/ui/SettingsRow';
import { Screen } from '@/ui/Screen';

type Href = Parameters<ReturnType<typeof useRouter>['push']>[0];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { db, today, prefs, version } = useApp();
  const [life, setLife] = useState('');
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads the life state after every write
  useEffect(() => {
    if (!db) return;
    void lifeStateHistory(db).then((rows) => {
      const cur = currentLifeStates(rows, today)[0];
      setLife(t(`settings.lifeState.options.${cur ? (CHOICE_OF[cur.kind] ?? 'none') : 'none'}`));
    });
  }, [db, today, version, t]);
  const go = (path: string): (() => void) => () => router.push(path as Href);
  return (
    <Screen testID="screen-settings" title={t('settings.title')}>
      <Group>
        <SettingsRow testID="settings-life" title={t('settings.lifeState.title')} description={life} onPress={go('/settings/lifestate')} />
        <SettingsRow testID="settings-health" title={t('settings.health.title')} onPress={go('/settings/health')} />
        <SettingsRow testID="settings-privacy" title={t('settings.privacy.title')} onPress={go('/settings/privacy')} />
        <SettingsRow testID="settings-notifications" title={t('settings.notifications.title')} onPress={go('/settings/notifications')} />
        <SettingsRow testID="settings-appearance" title={t('settings.appearance.title')} description={t(`settings.appearance.theme${prefs.theme === 'system' ? 'System' : prefs.theme === 'light' ? 'Light' : 'Dark'}`)} onPress={go('/settings/appearance')} />
        <SettingsRow testID="settings-tracking" title={t('settings.tracking.title')} onPress={go('/settings/tracking')} />
        <SettingsRow testID="settings-about" title={t('settings.about.title')} onPress={go('/settings/about')} last />
      </Group>
    </Screen>
  );
}
