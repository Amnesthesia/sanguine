import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import type { FlowLevel } from '@/data/events';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import { LARGE, useFontScale } from '@/ui/useFontScale';
import { DropGlyph } from './DropGlyph';

const LEVELS: Array<{ level: Exclude<FlowLevel, 'none'>; fill: number }> = [
  { level: 'spotting', fill: 0 }, { level: 'light', fill: 0.35 }, { level: 'medium', fill: 0.7 }, { level: 'heavy', fill: 1 },
];

export function FlowSelector({ value, onChange }: { value: FlowLevel | null; onChange: (l: Exclude<FlowLevel, 'none'>) => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const wide = useFontScale() > LARGE; // two by two, so the words are never squeezed or split
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {LEVELS.map(({ level, fill }) => {
        const on = value === level;
        return (
          <Pressable
            key={level} testID={`flow-${level}`} accessibilityRole="radio" accessibilityLabel={tr(`log.flowLevels.${level}`)} aria-checked={on} onPress={() => onChange(level)}
            style={{ flexGrow: 1, flexShrink: 1, flexBasis: wide ? '47%' : 0, minHeight: 76, borderRadius: 999, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: on ? t.c.accentSoft : t.chipBg, borderWidth: 1.5, borderColor: on ? t.c.accent : 'transparent' }}>
            <DropGlyph fill={fill} size={26} />
            <Text variant="caption" color={on ? 'onAccentSoft' : 'textPrimary'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={on ? { fontWeight: '600' } : undefined}>{tr(`log.flowLevels.${level}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
