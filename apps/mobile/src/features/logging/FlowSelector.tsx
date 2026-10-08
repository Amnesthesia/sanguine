import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import type { FlowLevel } from '@/data/events';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import { DropGlyph } from './DropGlyph';

const LEVELS: Array<{ level: Exclude<FlowLevel, 'none'>; fill: number }> = [
  { level: 'spotting', fill: 0 }, { level: 'light', fill: 0.35 }, { level: 'medium', fill: 0.7 }, { level: 'heavy', fill: 1 },
];

export function FlowSelector({ value, onChange }: { value: FlowLevel | null; onChange: (l: Exclude<FlowLevel, 'none'>) => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
      {LEVELS.map(({ level, fill }) => {
        const on = value === level;
        return (
          <Pressable
            key={level} testID={`flow-${level}`} accessibilityRole="radio" accessibilityLabel={tr(`log.flowLevels.${level}`)} aria-checked={on} onPress={() => onChange(level)}
            style={{ flex: 1, minHeight: 72, borderRadius: t.radius.tile, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: on ? t.c.accentSoft : t.chipBg, borderWidth: 1.5, borderColor: on ? t.c.accent : 'transparent' }}>
            <DropGlyph fill={fill} />
            <Text variant="caption" color={on ? 'accent' : 'textPrimary'}>{tr(`log.flowLevels.${level}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
