import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

export interface Option<T extends string> { value: T; label: string; hint?: string }

/** Single-select list (radio semantics). Each row is a 48 pt+ target with an explicit selected state, not colour alone. */
export function OptionList<T extends string>({ options, value, onChange, testIDPrefix }: { options: Option<T>[]; value: T | undefined; onChange: (v: T) => void; testIDPrefix?: string }) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            aria-checked={on}
            onPress={() => onChange(o.value)}
            style={{
              minHeight: 52, paddingHorizontal: 16, paddingVertical: 10, borderRadius: t.radius.tile, flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: on ? t.c.accentSoft : t.chipBg, borderWidth: 1.5, borderColor: on ? t.c.accent : 'transparent',
            }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? t.c.accent : t.c.textSecondary, alignItems: 'center', justifyContent: 'center' }}>
              {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.c.accent }} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="body">{o.label}</Text>
              {o.hint ? <Text variant="bodySmall" color="textSecondary">{o.hint}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
