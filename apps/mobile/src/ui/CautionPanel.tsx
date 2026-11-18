import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

export function CautionPanel({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, borderRadius: 16, padding: 12, backgroundColor: t.c.cautionBg }}>
      <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ color: t.c.caution }}>ⓘ</Text>
      <Text variant="caption" style={{ flex: 1, color: t.c.cautionText }}>{children}</Text>
    </View>
  );
}
