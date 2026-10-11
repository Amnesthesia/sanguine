import { ENGINE_BUILD_HASH, ENGINE_VERSION } from '@sanguine/engine';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, View } from 'react-native';
import lockupDark from '../../../assets/brand/splash-lockup-dark.png';
import lockup from '../../../assets/brand/splash-lockup.png';
import { isTeen } from '@/data/prefs';
import { BRAND } from '@/features/splash/BrandSplash';
import { taglineFor } from '@/features/splash/tagline';
import { checkAndApply, updatesOn } from '@/features/updates/updates';
import { todayLocal } from '@/services/clock';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import about from '../../../../../copy/about.en-AU.json';
import glossary from '../../../../../copy/glossary.en-AU.json';
import { POLICIES } from '@/features/legal/policies.generated';
import { Card } from '@/ui/Card';
import { Group, SettingsRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';
import { formatDayYear } from '@/ui/format';
import { showToast } from '@/ui/Toast';


export default function AboutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const brand = BRAND[theme.scheme]; // the brand field lives here and on the splash only (D-051)
  const launchCount = useApp((s) => s.launchCount);
  const profile = useApp((s) => s.profile);
  const today = useApp((s) => s.today);
  const tagline = taglineFor(launchCount, t('app.taglines', { returnObjects: true }) as string[], isTeen(profile, today));
  const version = Constants.expoConfig?.version ?? '0';
  const [checking, setChecking] = useState(false);
  // the running bundle: the store build's own, or an over-the-air update and the day it was published (D-103)
  const build = !updatesOn() ? t('settings.about.devBuild') : Updates.isEmbeddedLaunch || !Updates.createdAt ? t('settings.about.builtIn') : t('settings.about.updated', { d: formatDayYear(todayLocal(Updates.createdAt)) });
  const check = async () => {
    setChecking(true);
    const r = await checkAndApply();
    setChecking(false);
    if (r !== 'reloading') showToast(t(`settings.about.check.${r}`));
  };
  return (
    <SubScreen testID="screen-about" title={t('settings.about.title')}>
      <View testID="about-band" accessible accessibilityRole="image" accessibilityLabel={t('app.name')} style={{ borderRadius: theme.radius.card, backgroundColor: brand.field, alignItems: 'center', paddingVertical: 28, gap: 18 }}>
        <Image source={theme.scheme === 'dark' ? lockupDark : lockup} style={{ width: 200, height: 200 * (881 / 780) }} resizeMode="contain" accessibilityIgnoresInvertColors />
        <View style={{ width: 200, height: 1, backgroundColor: brand.ink, opacity: 0.6 }} />
        {tagline ? <Text testID="about-tagline" caps variant="caption" style={{ color: brand.text, textAlign: 'center', paddingHorizontal: 24, fontSize: 13, lineHeight: 20 }}>{tagline}</Text> : null}
      </View>
      <Group>
        <SettingsRow testID="about-version" title={t('settings.about.version', { v: version })} description={checking ? t('settings.about.checking') : `${build}. ${t('settings.about.checkHint')}`} onPress={() => void check()} disabled={checking} last />
      </Group>
      <Card>
        <Text testID="about-engine" variant="bodySmall" color="textSecondary">{t('settings.about.engine', { v: ENGINE_VERSION })}</Text>
        <Text testID="about-hash" variant="caption" color="textSecondary" selectable>{t('settings.about.engineHash', { h: ENGINE_BUILD_HASH.slice(0, 12) })}</Text>
      </Card>
      <Card testID="about-disclaimer"><Text>{t('legal.aboutDisclaimer')}</Text><Text variant="bodySmall" color="textSecondary">{t('legal.notMedicalDevice')}</Text></Card>
      <Text variant="heading" accessibilityRole="header">{t('settings.about.wording')}</Text>
      <Card><Text variant="bodySmall">{about.howToRead}</Text></Card>
      <Group><SettingsRow testID="about-how" title={t('settings.how.title')} description={t('settings.how.rowDesc')} onPress={() => router.push('/settings/how' as never)} last /></Group>
      <Card>
        {Object.entries(glossary.terms).map(([term, def]) => (
          <View key={term} style={{ marginBottom: 6 }}><Text variant="bodySmall" style={{ fontWeight: '600' }}>{term}</Text><Text variant="bodySmall" color="textSecondary">{def}</Text></View>
        ))}
      </Card>
      <Text variant="heading" accessibilityRole="header">{t('settings.about.sources')}</Text>
      <Text variant="bodySmall" color="textSecondary">{t('settings.about.sourcesDesc')}</Text>
      <Card testID="about-sources">
        {about.sources.map((s) => (
          <View key={s.cite} style={{ marginBottom: 6 }}><Text variant="bodySmall" style={{ fontWeight: '600' }}>{s.cite}</Text><Text variant="bodySmall" color="textSecondary">{s.use}</Text></View>
        ))}
      </Card>
      {POLICIES.privacy.ready || POLICIES.consumerHealth.ready ? (
        <Group>
          {POLICIES.privacy.ready ? <SettingsRow testID="about-privacy-policy" title={t('settings.about.privacyPolicy')} onPress={() => router.push({ pathname: '/settings/legal', params: { doc: 'privacy' } } as never)} last={!POLICIES.consumerHealth.ready} /> : null}
          {POLICIES.consumerHealth.ready ? <SettingsRow testID="about-health-policy" title={t('settings.about.consumerHealthPolicy')} onPress={() => router.push({ pathname: '/settings/legal', params: { doc: 'consumerHealth' } } as never)} last /> : null}
        </Group>
      ) : null}
      <Text variant="heading" accessibilityRole="header">{t('settings.about.licences')}</Text>
      <Card>
        {about.licences.map((l) => (
          <View key={l.name} style={{ marginBottom: 6 }}><Text variant="bodySmall">{l.name}</Text><Text variant="caption" color="textSecondary">{l.licence}</Text></View>
        ))}
      </Card>
    </SubScreen>
  );
}
