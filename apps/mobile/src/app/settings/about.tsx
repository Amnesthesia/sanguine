import { ENGINE_BUILD_HASH, ENGINE_VERSION } from '@sanguine/engine';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import about from '../../../../../copy/about.en-AU.json';
import glossary from '../../../../../copy/glossary.en-AU.json';
import { BRAND_RED } from '@/features/splash/BrandSplash';
import { Card } from '@/ui/Card';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';


export default function AboutScreen() {
  const { t } = useTranslation();
  const version = Constants.expoConfig?.version ?? '0';
  return (
    <SubScreen testID="screen-about" title={t('settings.about.title')}>
      <View testID="about-band" accessible accessibilityRole="image" accessibilityLabel={t('app.name')} style={{ height: 96, borderRadius: 16, backgroundColor: BRAND_RED, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontFamily: 'DancingScript_700Bold', fontSize: 48, lineHeight: 60 }} accessibilityElementsHidden>{t('app.name')}</Text>
      </View>
      <Card>
        <Text testID="about-version">{t('settings.about.version', { v: version })}</Text>
        <Text testID="about-engine" variant="bodySmall" color="textSecondary">{t('settings.about.engine', { v: ENGINE_VERSION })}</Text>
        <Text testID="about-hash" variant="caption" color="textSecondary" selectable>{t('settings.about.engineHash', { h: ENGINE_BUILD_HASH.slice(0, 12) })}</Text>
      </Card>
      <Card testID="about-disclaimer"><Text>{t('legal.aboutDisclaimer')}</Text><Text variant="bodySmall" color="textSecondary">{t('legal.notMedicalDevice')}</Text></Card>
      <Text variant="heading" accessibilityRole="header">{t('settings.about.wording')}</Text>
      <Card><Text variant="bodySmall">{about.howToRead}</Text></Card>
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
      <Text variant="heading" accessibilityRole="header">{t('settings.about.licences')}</Text>
      <Card>
        {about.licences.map((l) => (
          <View key={l.name} style={{ marginBottom: 6 }}><Text variant="bodySmall">{l.name}</Text><Text variant="caption" color="textSecondary">{l.licence}</Text></View>
        ))}
      </Card>
    </SubScreen>
  );
}
