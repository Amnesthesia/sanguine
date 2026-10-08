import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export const DEFAULT_INTENSITY = 2;

/** Tap toggles at intensity 2; press and hold steps the intensity 1 → 2 → 3 (PLAN.md §8.4). */
export function SymptomGrid({ codes, values, onSet }: { codes: string[]; values: Record<string, number>; onSet: (code: string, intensity: 0 | 1 | 2 | 3) => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {codes.map((code) => {
        const n = values[code] ?? 0;
        const on = n > 0;
        const name = tr(`symptom.${code}`, { defaultValue: code });
        return (
          <Pressable
            key={code} testID={`symptom-${code}`} accessibilityRole="checkbox" aria-checked={on}
            accessibilityLabel={on ? tr('a11y.symptomSelected', { symptom: name, n }) : tr('a11y.symptomUnselected', { symptom: name })}
            accessibilityHint={tr('log.longPressHint')}
            onPress={() => onSet(code, on ? 0 : DEFAULT_INTENSITY)}
            onLongPress={() => onSet(code, on ? (((n % 3) + 1) as 1 | 2 | 3) : 1)}
            style={{ width: '23%', flexGrow: 1, minHeight: 72, borderRadius: t.radius.tile, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: on ? t.c.accentSoft : t.chipBg, borderWidth: 1.5, borderColor: on ? t.c.accent : 'transparent' }}>
            <Text variant="caption" color={on ? 'accent' : 'textPrimary'} style={{ textAlign: 'center' }}>{name}</Text>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {[1, 2, 3].map((i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i <= n ? t.c.accent : t.c.border }} />)}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
