import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

/** Wrapping row of selectable chips (radio semantics). */
export function Chips<T extends string>({ options, value, onChange, testIDPrefix }: { options: Array<{ value: T; label: string }>; value: T | undefined; onChange: (v: T) => void; testIDPrefix?: string }) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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
            style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? t.c.accentSoft : t.chipBg, borderWidth: 1.5, borderColor: on ? t.c.accent : 'transparent' }}>
            <Text variant="bodySmall" color={on ? 'onAccentSoft' : 'textPrimary'} style={{ fontWeight: on ? '600' : '400' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
