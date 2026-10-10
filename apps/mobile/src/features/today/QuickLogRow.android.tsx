// Log today on Android (floating above the navigation bar, D-099; Calendar reuses it for the selected day): one filled Material 3 button through @expo/ui, the single way into the log sheet (D-097; colours
// from D-054). `Host` wraps it in `MaterialExpressiveTheme` (spring motion scheme) seeded from the accent.
import { Button, Host, Text as M3Text } from '@expo/ui/jetpack-compose';
import { testID } from '@expo/ui/jetpack-compose/modifiers';
import type { ISODate } from '@sanguine/engine';
import { m3 } from '@sanguine/ui-tokens';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useTheme } from '@/theme';

// ponytail: accessibilityLabel is iOS only; the Compose button announces its text. Add a Compose semantics modifier if TalkBack needs the date.
export function QuickLogRow({ day, label, testID: id = 'quick-log' }: { day?: ISODate; label?: string; accessibilityLabel?: string; testID?: string } = {}) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const m = m3[t.scheme === 'dark' ? 'dark' : 'light'];
  const go = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(day ? { pathname: '/log', params: { day } } : '/log');
  };
  return (
    <View style={{ alignItems: 'center' }}>
      <Host matchContents seedColor={t.c.accent} colorScheme={t.scheme}>
        <Button onClick={go} colors={{ containerColor: m.primary, contentColor: m.onPrimary }} modifiers={[testID(id)]}>
          <M3Text>{label ?? tr('today.quick.log')}</M3Text>
        </Button>
      </Host>
    </View>
  );
}
