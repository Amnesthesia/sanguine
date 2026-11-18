import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { useFontScale } from '@/ui/useFontScale';
import { Text } from '@/ui/Text';

/** Each tap steps the strength: off, mild, moderate, strong, off; press and hold clears (D-097). A selected pill names it (D-088). Frames: two columns of pills, name left, dots right. */
export function SymptomGrid({ codes, values, onSet }: { codes: string[]; values: Record<string, number>; onSet: (code: string, intensity: 0 | 1 | 2 | 3) => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const scale = useFontScale();
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
            accessibilityLabel={on ? tr('a11y.symptomSelected', { symptom: name, strength: tr(`log.strength.${n}`).toLocaleLowerCase(), n }) : name} // the checkbox role already says checked or not
            accessibilityHint={tr('a11y.symptomHint')}
            onPress={() => onSet(code, ((n + 1) % 4) as 0 | 1 | 2 | 3)}
            onLongPress={() => onSet(code, 0)}
            style={{ width: '48%', flexGrow: 1, minHeight: 56, borderRadius: 999, paddingVertical: 6, paddingLeft: 16, paddingRight: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: on ? t.c.accentSoft : t.chipBg, borderWidth: 1.5, borderColor: on ? t.c.accent : 'transparent' }}>
            <View style={{ flexShrink: 1 }}>
              <Text variant="bodySmall" color={on ? 'onAccentSoft' : 'textPrimary'} style={on ? { fontWeight: '600' } : undefined}>{name}</Text>
              {/* the dots alone read as a count; the word says what they measure (D-088) */}
              {on ? <Text variant="caption" color="onAccentSoft">{tr(`log.strength.${n}`)}</Text> : null}
            </View>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: 3 }}>
              {[1, 2, 3].map((i) => <View key={i} testID="intensity-dot" style={i <= n ? { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: t.c.accent } : { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: t.c[on ? 'onAccentSoft' : 'textPrimary'], opacity: on ? 0.25 : 0.16 }} />)}
            </View>
          </Pressable>
        );
      })}
      <Text variant="caption" color="textSecondary" style={{ width: '100%', marginTop: 4 }}>{tr('log.tapHint')}</Text>
    </View>
  );
}
