// Period / Symptoms / Temperature on Android: the Material 3 Expressive floating toolbar through @expo/ui
// (PLAN.md §9.1, P3-4, D-046, D-054). Three equal pill buttons on a neutral bar: Period filled on primary, Symptoms and
// Temperature elevated on surface, so the controls separate from the bar and the bar from the page without any pink
// container tones. `Host` wraps its children in `MaterialExpressiveTheme` (spring motion scheme) seeded from the accent.
import { Button, Column, ElevatedButton, HorizontalFloatingToolbar, Host, Text as M3Text } from '@expo/ui/jetpack-compose';
import { m3 } from '@sanguine/ui-tokens';
import { testID } from '@expo/ui/jetpack-compose/modifiers';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { LARGE, useFontScale } from '@/ui/useFontScale';

export type LogSection = 'period' | 'symptoms' | 'temperature';

export function QuickLogRow() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const stacked = useFontScale() > LARGE; // big text: one button per line instead of breaking words
  const m = m3[t.scheme === 'dark' ? 'dark' : 'light'];
  const go = (section: LogSection) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/log', params: { section } });
  };
  const period = (
    <Button onClick={() => go('period')} colors={{ containerColor: m.primary, contentColor: m.onPrimary }} modifiers={[testID('quick-period')]}>
      <M3Text>{tr('today.quick.period')}</M3Text>
    </Button>
  );
  const tonal = (section: LogSection) => (
    <ElevatedButton key={section} onClick={() => go(section)} colors={{ containerColor: t.c.surface, contentColor: t.c.textPrimary }} modifiers={[testID(`quick-${section}`)]}>
      <M3Text>{tr(`today.quick.${section}`)}</M3Text>
    </ElevatedButton>
  );
  return (
    <View style={{ alignItems: 'center' }}>
      <Host matchContents seedColor={t.c.accent} colorScheme={t.scheme}>
        {stacked ? (
          <Column>
            {period}
            {tonal('symptoms')}
            {tonal('temperature')}
          </Column>
        ) : (
          <HorizontalFloatingToolbar
            variant="standard"
            // neutral bar (D-054): the seed's primaryContainer and the FAB's tertiary tones both read pink on pink and the FAB was a small square
            colors={{ toolbarContainerColor: m.surfaceContainerHigh, toolbarContentColor: t.c.textPrimary }}>
            {period}
            {tonal('symptoms')}
            {tonal('temperature')}
          </HorizontalFloatingToolbar>
        )}
      </Host>
    </View>
  );
}
