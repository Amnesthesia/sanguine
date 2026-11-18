import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { GlassSurface } from './GlassBar';

/** The step platter for a glass header: past steps are dots, the current step a longer pill, later steps faint. The marks are
 *  non-text, so they stay accent; the one label ("Step n of total") is for screen readers and the platter is one element. */
export function ProgressDots({ step, total }: { step: number; total: number }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <GlassSurface accessible accessibilityRole="image" accessibilityLabel={tr('onboarding.progress', { n: step + 1, total })} style={{ borderRadius: 15 }}>
      <View style={{ height: 30, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        {Array.from({ length: total }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length list of identical dots
          <View key={i} testID="step-dot" style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i <= step ? t.c.accent : t.c.border }} />
        ))}
      </View>
    </GlassSurface>
  );
}
