import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

/** Capsule button with a 44 pt minimum target. `accessibilityLabel` defaults to the label. */
export function Button({ label, kind = 'primary', icon, style, ...rest }: Omit<PressableProps, 'children'> & { label: string; icon?: ReactNode; kind?: 'primary' | 'secondary' | 'text' | 'destructive' }) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.c.accent : kind === 'secondary' ? t.cardBg : 'transparent';
  const fg = kind === 'primary' ? (t.scheme === 'dark' ? t.c.bg : t.c.surface) : kind === 'destructive' ? t.c.period : kind === 'text' ? t.c.onAccentSoft : t.c.textPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={rest.disabled ?? undefined}
      accessibilityLabel={rest.accessibilityLabel ?? label}
      {...rest}
      style={(state) => [{ minHeight: kind === 'primary' ? 52 : 44, paddingHorizontal: 20, borderRadius: 999, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderWidth: kind === 'secondary' ? 1 : 0, borderColor: t.hairline, opacity: rest.disabled ? 0.5 : 1, transform: [{ scale: state.pressed ? 0.98 : 1 }] }, kind === 'text' ? { minHeight: 44, alignSelf: 'flex-start', paddingHorizontal: 12 } : null, typeof style === 'function' ? style(state) : style]}>
      {icon != null ? <Text style={{ color: fg }} accessibilityElementsHidden>{icon}</Text> : null}
      <Text variant="heading" style={{ color: fg, fontSize: kind === 'primary' ? 17 : 15, lineHeight: 22 }}>{label}</Text>
    </Pressable>
  );
}
