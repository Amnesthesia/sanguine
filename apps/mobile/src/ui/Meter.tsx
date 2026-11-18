import type { Confidence } from '@sanguine/engine';
import { View } from 'react-native';
import type { Evidence } from '@/features/guidance/guidance';
import { useTheme } from '@/theme';
import { Text } from './Text';

type Level = 0 | 1 | 2 | 3;
export const confidenceLevel = (c: Confidence): Level => ({ none: 0, low: 1, medium: 2, high: 3 } as const)[c];
export const evidenceLevel = (e: Evidence): Level => ({ general: 0, early: 1, some: 2, strong: 3 } as const)[e];

export function Meter({ level, word }: { level: Level; word: string }) {
  const t = useTheme();
  return (
    <View accessible accessibilityLabel={word} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View accessibilityElementsHidden style={{ flexDirection: 'row', gap: 2 }}>
        {[0, 1, 2].map(i => <View key={i} testID="meter-bar" style={{ width: 4, height: 11, borderRadius: 2, backgroundColor: i < level ? t.c.textPrimary : t.c.border }} />)}
      </View>
      <Text variant="caption">{word}</Text>
    </View>
  );
}
