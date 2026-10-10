import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme';

/** The app's own Back control (no native navigation header): a system-style chevron only; the word is the accessibility label. */
export function BackButton({ testID = 'back', onPress }: { testID?: string; onPress?: () => void }) {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      onPress={onPress ?? (() => router.back())}
      hitSlop={4}
      style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
      <Svg width={13} height={22} viewBox="0 0 13 22">
        <Path d="M11 2 2 11l9 9" stroke={theme.c.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </Pressable>
  );
}
