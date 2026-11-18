// A policy document inside the app (PLAN.md §2.4, §2.5): generated from docs/ into the bundle, so it needs no network.
// One document per screen; the list of policies lives in About.
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { POLICIES } from '@/features/legal/policies.generated';
import { useTheme } from '@/theme';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const t = useTheme();
  const policy = doc === 'consumerHealth' ? POLICIES.consumerHealth : POLICIES.privacy;
  return (
    <SubScreen testID="screen-legal" title={policy.title}>
      <View style={{ gap: 12, paddingHorizontal: 4 }}>
        {policy.blocks.map((b, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static document, never reordered
          <View key={i} style={b.type === 'li' ? { flexDirection: 'row', gap: 10 } : undefined}>
            {b.type === 'li' ? <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ color: t.c.accent, lineHeight: 23 }}>•</Text> : null}
            {/* the line under the title ("Last updated…") is a note, the numbered headings are the section titles */}
            {i === 0 && b.type === 'p'
              ? <Text variant="bodySmall" color="textSecondary">{b.text}</Text>
              : <Text variant={b.type === 'h' ? 'heading' : 'body'} accessibilityRole={b.type === 'h' ? 'header' : undefined} style={[{ lineHeight: b.type === 'h' ? 25 : 23 }, b.type === 'h' ? { fontSize: 20, fontWeight: '700', marginTop: 12 } : null, b.type === 'li' ? { flex: 1 } : null]}>{b.text}</Text>}
          </View>
        ))}
      </View>
    </SubScreen>
  );
}
