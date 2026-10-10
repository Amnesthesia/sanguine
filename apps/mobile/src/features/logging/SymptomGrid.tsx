import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { LARGE, useFontScale } from '@/ui/useFontScale';
import { Text } from '@/ui/Text';

export const DEFAULT_INTENSITY = 2;

/** Tap toggles at intensity 2; press and hold steps the intensity 1 → 2 → 3 (PLAN.md §8.4). A selected tile names it: mild, moderate, strong (D-088). */
export function SymptomGrid({ codes, values, onSet }: { codes: string[]; values: Record<string, number>; onSet: (code: string, intensity: 0 | 1 | 2 | 3) => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const scale = useFontScale();
  const wide = scale > LARGE; // two columns so words are never split
  const dot = Math.round(6 * Math.min(scale, 2)); // the intensity dots grow with the text (U-15)
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {codes.map((code) => {
        const n = values[code] ?? 0;
        const on = n > 0;
        const name = tr(`symptom.${code}`, { defaultValue: code });
        return (
          <Pressable
            key={code} testID={`symptom-${code}`} accessibilityRole="checkbox" aria-checked={on}
            accessibilityLabel={on ? tr('a11y.symptomSelected', { symptom: name, strength: tr(`log.strength.${n}`).toLocaleLowerCase(), n }) : tr('a11y.symptomUnselected', { symptom: name })}
            accessibilityHint={tr('log.longPressHint')}
            onPress={() => onSet(code, on ? 0 : DEFAULT_INTENSITY)}
            onLongPress={() => onSet(code, on ? (((n % 3) + 1) as 1 | 2 | 3) : 1)}
            style={{ width: wide ? '48%' : '23%', flexGrow: 1, minHeight: 72, borderRadius: t.radius.tile, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: on ? t.c.accentSoft : t.chipBg, borderWidth: 1.5, borderColor: on ? t.c.accent : 'transparent' }}>
            <Text variant="caption" color={on ? 'accent' : 'textPrimary'} style={{ textAlign: 'center' }}>{name}</Text>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {[1, 2, 3].map((i) => <View key={i} style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: i <= n ? t.c.accent : t.c.border }} />)}
            </View>
            {/* the dots alone read as a count; the word says what they measure (D-088) */}
            {on ? <Text variant="caption" color="accent" style={{ textAlign: 'center' }}>{tr(`log.strength.${n}`)}</Text> : null}
          </Pressable>
        );
      })}
      <Text variant="caption" color="textSecondary" style={{ width: '100%', marginTop: 4 }}>{tr('log.longPressHint')}</Text>
    </View>
  );
}
