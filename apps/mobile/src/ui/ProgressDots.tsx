import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';

export function ProgressDots({ step, total }: { step: number; total: number }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <View accessible accessibilityLabel={tr('onboarding.progress', { n: step + 1, total })} style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length list of identical dots
        <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i <= step ? t.c.accent : t.c.border }} />
      ))}
    </View>
  );
}
