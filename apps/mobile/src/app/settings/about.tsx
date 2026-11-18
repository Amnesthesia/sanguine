import { ENGINE_BUILD_HASH, ENGINE_VERSION } from '@sanguine/engine';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
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


/** A hairline-separated row inside a card (glossary terms, licences); `last` drops the rule. */
function Rule({ last }: { last: boolean }) {
  const theme = useTheme();
  return last ? null : <View style={{ height: 1, backgroundColor: theme.hairline }} />;
}

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
  const terms = Object.entries(glossary.terms);
  return (
    <SubScreen testID="screen-about" title={t('settings.about.title')}>
      <View testID="about-band" accessible accessibilityRole="image" accessibilityLabel={t('app.name')} style={{ borderRadius: theme.radius.card, backgroundColor: brand.field, alignItems: 'center', paddingVertical: 28, gap: 18 }}>
        <Image source={theme.scheme === 'dark' ? lockupDark : lockup} style={{ width: 200, height: 200 * (881 / 780) }} resizeMode="contain" accessibilityIgnoresInvertColors />
        <View style={{ width: 200, height: 1, backgroundColor: brand.ink, opacity: 0.6 }} />
        {tagline ? <Text testID="about-tagline" caps variant="caption" style={{ color: brand.text, textAlign: 'center', paddingHorizontal: 24, fontSize: 13, lineHeight: 20 }}>{tagline}</Text> : null}
      </View>
      <Card style={{ padding: 0, gap: 0 }}>
        <Pressable testID="about-version" accessibilityRole="button" accessibilityLabel={`${t('settings.about.version', { v: version })}. ${checking ? t('settings.about.checking') : `${build}. ${t('settings.about.checkHint')}`}`} aria-disabled={checking} disabled={checking} onPress={() => void check()}
          style={{ minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: theme.hairline }}>
          <View style={{ flex: 1 }}>
            <Text>{t('settings.about.version', { v: version })}</Text>
            <Text variant="bodySmall" color="textSecondary">{build}</Text>
          </View>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center', backgroundColor: theme.chipBg, opacity: checking ? 0.5 : 1 }}>
            <Text variant="bodySmall" color="onAccentSoft" style={{ fontWeight: '600' }}>{checking ? t('settings.about.checking') : t('settings.about.checkAction')}</Text>
          </View>
        </Pressable>
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 2 }}>
          <Text testID="about-engine" variant="bodySmall" color="textSecondary">{t('settings.about.engine', { v: ENGINE_VERSION })}</Text>
          <Text testID="about-hash" variant="caption" color="textSecondary" selectable>{t('settings.about.engineHash', { h: ENGINE_BUILD_HASH.slice(0, 12) })}</Text>
        </View>
      </Card>
      <Card testID="about-disclaimer"><Text>{t('legal.aboutDisclaimer')}</Text><Text variant="bodySmall" color="textSecondary">{t('legal.notMedicalDevice')}</Text></Card>
      <Text variant="title" accessibilityRole="header">{t('settings.about.wording')}</Text>
      <Card><Text variant="bodySmall">{about.howToRead}</Text></Card>
      <Group><SettingsRow testID="about-how" leadingIcon={<Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Circle cx={12} cy={12} r={8.5} fill="none" stroke={theme.c.onAccentSoft} strokeWidth={1.8} /><Path d="M12 11V16.5M12 7.6V7.8" stroke={theme.c.onAccentSoft} strokeWidth={2} strokeLinecap="round" /></Svg>} title={t('settings.how.title')} description={t('settings.how.rowDesc')} onPress={() => router.push('/settings/how' as never)} last /></Group>
      <Card style={{ gap: 0 }}>
        {terms.map(([term, def], i) => (
          <View key={term}>
            <View style={{ paddingVertical: 10 }}><Text variant="bodySmall" style={{ fontWeight: '600' }}>{term}</Text><Text variant="bodySmall" color="textSecondary">{def}</Text></View>
            <Rule last={i === terms.length - 1} />
          </View>
        ))}
      </Card>
      <Text variant="title" accessibilityRole="header">{t('settings.about.sources')}</Text>
      <Text variant="bodySmall" color="textSecondary">{t('settings.about.sourcesDesc')}</Text>
      <Card testID="about-sources" style={{ gap: 8 }}>
        {about.sources.map((s, i) => (
          <View key={s.cite} style={{ flexDirection: 'row', gap: 8 }}>
            <Text variant="bodySmall" color="textSecondary" accessibilityElementsHidden>{i + 1}.</Text>
            <View style={{ flex: 1 }}><Text variant="bodySmall" style={{ fontWeight: '600' }}>{s.cite}</Text><Text variant="bodySmall" color="textSecondary">{s.use}</Text></View>
          </View>
        ))}
      </Card>
      {POLICIES.privacy.ready || POLICIES.consumerHealth.ready ? (
        <Group>
          {POLICIES.privacy.ready ? <SettingsRow testID="about-privacy-policy" title={t('settings.about.privacyPolicy')} onPress={() => router.push({ pathname: '/settings/legal', params: { doc: 'privacy' } } as never)} last={!POLICIES.consumerHealth.ready} /> : null}
          {POLICIES.consumerHealth.ready ? <SettingsRow testID="about-health-policy" title={t('settings.about.consumerHealthPolicy')} onPress={() => router.push({ pathname: '/settings/legal', params: { doc: 'consumerHealth' } } as never)} last /> : null}
        </Group>
      ) : null}
      <Text variant="title" accessibilityRole="header">{t('settings.about.licences')}</Text>
      <Card style={{ gap: 0 }}>
        {about.licences.map((l, i) => (
          <View key={l.name}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10 }}>
              <Text variant="bodySmall" style={{ flex: 1 }}>{l.name}</Text>
              <Text variant="bodySmall" color="textSecondary" style={{ flexShrink: 0, maxWidth: '45%', textAlign: 'right' }}>{l.licence}</Text>
            </View>
            <Rule last={i === about.licences.length - 1} />
          </View>
        ))}
      </Card>
    </SubScreen>
  );
}
