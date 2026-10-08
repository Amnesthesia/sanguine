import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

/** Segmented control (iOS) / segmented buttons (Android). Radio semantics with an explicit selected state. */
export function Segmented<T extends string>({ options, value, onChange, testIDPrefix }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void; testIDPrefix?: string }) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: t.chipBg, borderRadius: t.isIOS ? 10 : 999, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value} testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined} accessibilityRole="radio" accessibilityLabel={o.label} aria-checked={on} onPress={() => onChange(o.value)}
            style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: t.isIOS ? 8 : 999, backgroundColor: on ? (t.isIOS ? t.cardBg : t.c.accentSoft) : 'transparent' }}>
            <Text variant="bodySmall" color={on ? 'accent' : 'textPrimary'} style={{ fontWeight: on ? '600' : '400' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
