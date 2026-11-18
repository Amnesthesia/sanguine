// How Sanguine estimates (P8-3, roadmap R2-6): fixed reference text, not an article feed (PLAN.md §8.1). Under 18, until the
// fertility tools are unlocked, the sentence about dating ovulation is replaced by one without fertility terms (§8.6), and the
// signal chips show only the period start.
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import about from '../../../../../copy/about.en-AU.json';
import { effectivePrefs } from '@/data/prefs';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Meter } from '@/ui/Meter';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

/** A static label chip (a drawing of a signal, not a control). */
function Tag({ label }: { label: string }) {
  const t = useTheme();
  return <View style={{ minHeight: 32, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center', backgroundColor: t.chipBg }}><Text variant="bodySmall">{label}</Text></View>;
}

export default function HowScreen() {
  const { t } = useTranslation();
  const { prefs, profile, today } = useApp();
  const { fertilityTools } = effectivePrefs(prefs, profile, today);
  const signals: string[] = fertilityTools ? ['period', 'temperature', 'ovulationTest', 'mucus', 'position'] : ['period'];
  const section = (title: string, ...body: string[]) => (
    <>
      <Text variant="title" accessibilityRole="header">{t(title)}</Text>
      <Card style={{ gap: 12 }}>{body.map((b) => <Text key={b} variant="bodySmall">{t(b)}</Text>)}</Card>
    </>
  );
  // "Confident: at least six cycles…": the lead word goes on the three-bar meter the day sheet uses, the rest is the rule
  const confidence = (key: string, level: 0 | 1 | 2 | 3) => {
    const [word = '', ...rest] = t(key).split(': ');
    return (
      <View key={key} style={{ gap: 4 }}>
        <Meter level={level} word={word} />
        <Text variant="bodySmall">{rest.join(': ')}</Text>
      </View>
    );
  };
  return (
    <SubScreen testID="screen-how" title={t('settings.how.title')}>
      {section('settings.how.rangeTitle', 'settings.how.rangeBody')}
      <Text variant="title" accessibilityRole="header">{t('settings.how.confidenceTitle')}</Text>
      <Card style={{ gap: 14 }}>
        {confidence('settings.how.confidenceHigh', 3)}
        {confidence('settings.how.confidenceMedium', 2)}
        {confidence('settings.how.confidenceLow', 1)}
        {confidence('settings.how.confidenceNone', 0)}
      </Card>
      <Text variant="title" accessibilityRole="header">{t('settings.how.narrowTitle')}</Text>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{signals.map((s) => <Tag key={s} label={t(`settings.how.signals.${s}`)} />)}</View>
        <Text variant="bodySmall">{t(fertilityTools ? 'settings.how.narrowBody' : 'settings.how.narrowBodyTeen')}</Text>
      </Card>
      <Text variant="title" accessibilityRole="header">{t('settings.how.symptomsTitle')}</Text>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['symptoms', 'mood', 'notes'] as const).map((s) => <Tag key={s} label={t(`settings.how.notChange.${s}`)} />)}</View>
        <Text variant="bodySmall">{t('settings.how.symptomsBody')}</Text>
      </Card>
      {section('settings.how.accuracyTitle', 'settings.how.accuracyBody')}
      <Text variant="title" accessibilityRole="header">{t('settings.about.sources')}</Text>
      <Card style={{ gap: 8 }}>
        {[about.sources[0], about.sources[3]].flatMap((s) => (s ? [s] : [])).map((s) => <Text key={s.cite} variant="bodySmall"><Text variant="bodySmall" style={{ fontWeight: '600' }}>{s.cite}</Text>{`: ${s.use}`}</Text>)}
      </Card>
    </SubScreen>
  );
}
