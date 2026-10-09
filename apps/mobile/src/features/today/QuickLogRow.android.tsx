// Period / Symptoms / Temperature on Android: the Material 3 Expressive floating toolbar through @expo/ui
// (PLAN.md §9.1, P3-4, D-046). Period is the toolbar's vibrant action button; Symptoms and Temperature are tonal
// buttons beside it. `Host` wraps its children in `MaterialExpressiveTheme` (spring motion scheme) seeded from the accent.
import { Button, Column, FilledTonalButton, HorizontalFloatingToolbar, Host, Text as M3Text } from '@expo/ui/jetpack-compose';
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
  const tonal = (section: LogSection) => (
    <FilledTonalButton key={section} onClick={() => go(section)} modifiers={[testID(`quick-${section}`)]}>
      <M3Text>{tr(`today.quick.${section}`)}</M3Text>
    </FilledTonalButton>
  );
  return (
    <View style={{ alignItems: 'center' }}>
      <Host matchContents seedColor={t.c.accent} colorScheme={t.scheme}>
        {stacked ? (
          <Column>
            <Button onClick={() => go('period')} modifiers={[testID('quick-period')]}>
              <M3Text>{tr('today.quick.period')}</M3Text>
            </Button>
            {tonal('symptoms')}
            {tonal('temperature')}
          </Column>
        ) : (
          <HorizontalFloatingToolbar
            variant="vibrant"
            // the plan's M3 roles (PLAN.md §9.2): Period on primary, the bar on primaryContainer; the seed alone puts the FAB on tertiary
            colors={{ toolbarContainerColor: m.primaryContainer, toolbarContentColor: t.c.textPrimary, fabContainerColor: m.primary, fabContentColor: m.onPrimary }}>
            <HorizontalFloatingToolbar.FloatingActionButton onPress={() => go('period')}>
              <M3Text modifiers={[testID('quick-period')]}>{tr('today.quick.period')}</M3Text>
            </HorizontalFloatingToolbar.FloatingActionButton>
            {tonal('symptoms')}
            {tonal('temperature')}
          </HorizontalFloatingToolbar>
        )}
      </Host>
    </View>
  );
}
