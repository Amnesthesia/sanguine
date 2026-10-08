import { Pressable, type PressableProps } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

/** Capsule button with a 48 pt minimum target. `accessibilityLabel` defaults to the label. */
export function Button({ label, kind = 'primary', ...rest }: Omit<PressableProps, 'children'> & { label: string; kind?: 'primary' | 'secondary' | 'text' | 'destructive' }) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.c.accent : kind === 'secondary' ? t.chipBg : 'transparent';
  const fg = kind === 'primary' ? (t.scheme === 'dark' ? '#3A0A14' : '#FFFFFF') : kind === 'destructive' ? t.c.period : t.c.textPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rest.accessibilityLabel ?? label}
      {...rest}
      style={({ pressed }) => [{ minHeight: 48, paddingHorizontal: 20, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, opacity: pressed ? 0.7 : 1 }, kind === 'text' ? { minHeight: 44 } : null]}>
      <Text variant="heading" style={{ color: fg, fontSize: 16, lineHeight: 22 }}>{label}</Text>
    </Pressable>
  );
}
