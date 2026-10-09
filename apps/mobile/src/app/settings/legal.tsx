// A policy document inside the app (PLAN.md §2.4, §2.5): generated from docs/ into the bundle, so it needs no network.
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { POLICIES } from '@/features/legal/policies.generated';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const policy = doc === 'consumerHealth' ? POLICIES.consumerHealth : POLICIES.privacy;
  return (
    <SubScreen testID="screen-legal" title={policy.title}>
      {policy.blocks.map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static document, never reordered
        <View key={i} style={b.type === 'li' ? { flexDirection: 'row', gap: 8, paddingRight: 8 } : undefined}>
          {b.type === 'li' ? <Text accessibilityElementsHidden>•</Text> : null}
          <Text variant={b.type === 'h' ? 'heading' : 'body'} accessibilityRole={b.type === 'h' ? 'header' : undefined} style={b.type === 'li' ? { flex: 1 } : undefined}>{b.text}</Text>
        </View>
      ))}
    </SubScreen>
  );
}
