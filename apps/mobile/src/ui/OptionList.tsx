import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme';
import { Text } from './Text';

export interface Option<T extends string> { value: T; label: string; hint?: string }

/** Single-select grouped inset list (radio semantics). Each row is a 52 pt+ target; the selected row has a checkmark and bold text, not colour alone. */
export function OptionList<T extends string>({ options, value, onChange, testIDPrefix }: { options: Option<T>[]; value: T | undefined; onChange: (v: T) => void; testIDPrefix?: string }) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ borderRadius: 24, backgroundColor: t.chipBg, overflow: 'hidden' }}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            aria-checked={on}
            onPress={() => onChange(o.value)}
            style={{ minHeight: 52, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.hairline }}>
            <View style={{ flex: 1 }}>
              <Text variant="body" style={{ fontSize: 17, lineHeight: 22, fontWeight: on ? '600' : '400' }}>{o.label}</Text>
              {o.hint ? <Text variant="bodySmall" color="textSecondary">{o.hint}</Text> : null}
            </View>
            {on ? (
              <View testID="option-check" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Svg width={18} height={18} viewBox="0 0 14 14"><Path d="M2.5 7.5L5.5 10.5L11.5 3.5" fill="none" stroke={t.c.accent} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
