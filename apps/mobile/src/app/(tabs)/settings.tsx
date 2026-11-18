import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { choiceOf, currentLifeStates, lifeStateHistory } from '@/features/settings/lifeState';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Group, SettingsRow } from '@/ui/SettingsRow';
import { Screen } from '@/ui/Screen';

/** The seven row icons of the glass frame (Settings-Root), drawn in the on-accent-soft colour on the round rose-tinted disc SettingsRow draws. */
function Icon({ name }: { name: 'life' | 'health' | 'privacy' | 'notifications' | 'appearance' | 'tracking' | 'about' }) {
  const c = useTheme().c.onAccentSoft;
  const line = { stroke: c, strokeWidth: 1.8, fill: 'none' } as const;
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {name === 'life' ? <><Circle cx={12} cy={12} r={8.5} {...line} /><Path d="M12 3.5A8.5 8.5 0 0 1 12 20.5Z" fill={c} /></> : null}
      {name === 'health' ? <Path d="M12 20S3.5 14.6 3.5 8.9A4.4 4.4 0 0 1 12 7A4.4 4.4 0 0 1 20.5 8.9C20.5 14.6 12 20 12 20Z" strokeLinejoin="round" {...line} /> : null}
      {name === 'privacy' ? <><Rect x={5} y={10.5} width={14} height={10} rx={2.5} {...line} /><Path d="M8 10.5V7.5A4 4 0 0 1 16 7.5V10.5" {...line} /></> : null}
      {name === 'notifications' ? <><Path d="M6 16.5V11A6 6 0 0 1 18 11V16.5L19.5 18H4.5Z" strokeLinejoin="round" {...line} /><Path d="M10 20.5A2 2 0 0 0 14 20.5" strokeLinecap="round" {...line} /></> : null}
      {name === 'appearance' ? <><Circle cx={12} cy={12} r={4} {...line} /><Path d="M12 3V5M12 19V21M3 12H5M19 12H21M5.6 5.6L7 7M17 17L18.4 18.4M5.6 18.4L7 17M17 7L18.4 5.6" strokeLinecap="round" {...line} /></> : null}
      {name === 'tracking' ? <><Path d="M9.5 7H20M9.5 12H20M9.5 17H20" strokeLinecap="round" {...line} /><Circle cx={5} cy={7} r={1.4} fill={c} /><Circle cx={5} cy={12} r={1.4} fill={c} /><Circle cx={5} cy={17} r={1.4} fill={c} /></> : null}
      {name === 'about' ? <><Circle cx={12} cy={12} r={8.5} {...line} /><Path d="M12 11V16.5M12 7.6V7.8" strokeLinecap="round" {...line} strokeWidth={2} /></> : null}
    </Svg>
  );
}

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
      setLife(t(`settings.lifeState.options.${cur ? choiceOf(cur) : 'none'}`));
    });
  }, [db, today, version, t]);
  const go = (path: string): (() => void) => () => router.push(path as Href);
  return (
    <Screen testID="screen-settings" title={t('settings.title')}>
      <Group>
        <SettingsRow testID="settings-life" leadingIcon={<Icon name="life" />} title={t('settings.lifeState.title')} description={life} onPress={go('/settings/lifestate')} />
        <SettingsRow testID="settings-health" leadingIcon={<Icon name="health" />} title={t('settings.health.title')} description={prefs.healthTypes.length ? t('settings.summary.healthN', { n: prefs.healthTypes.length }) : t('common.off')} onPress={go('/settings/health')} />
        <SettingsRow testID="settings-privacy" leadingIcon={<Icon name="privacy" />} title={t('settings.privacy.title')} description={`${t(prefs.appLock ? 'settings.summary.lockOn' : 'settings.summary.lockOff')} · ${t(prefs.cloudBackup ? 'settings.summary.backupOn' : 'settings.summary.backupOff')}`} onPress={go('/settings/privacy')} />
        <SettingsRow testID="settings-notifications" leadingIcon={<Icon name="notifications" />} title={t('settings.notifications.title')} description={t(prefs.notifications.enabled ? 'settings.summary.reminderOn' : 'settings.summary.reminderOff')} onPress={go('/settings/notifications')} />
        <SettingsRow testID="settings-appearance" leadingIcon={<Icon name="appearance" />} title={t('settings.appearance.title')} description={t(`settings.appearance.theme${prefs.theme === 'system' ? 'System' : prefs.theme === 'light' ? 'Light' : 'Dark'}`)} onPress={go('/settings/appearance')} />
        <SettingsRow testID="settings-tracking" leadingIcon={<Icon name="tracking" />} title={t('settings.tracking.title')} description={t('settings.summary.symptomsN', { n: prefs.symptoms.length })} onPress={go('/settings/tracking')} />
        <SettingsRow testID="settings-about" leadingIcon={<Icon name="about" />} title={t('settings.about.title')} onPress={go('/settings/about')} last />
      </Group>
    </Screen>
  );
}
