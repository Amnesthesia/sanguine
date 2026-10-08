import { type ColorToken, type } from '@sanguine/ui-tokens';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/theme';

export type Variant = keyof typeof type;
export interface TextProps extends RNTextProps { variant?: Variant; color?: ColorToken; tabular?: boolean }

/** Type scale from PLAN.md §9.3. Scales with the system font size; layouts must tolerate 150%. */
export function Text({ variant = 'body', color = 'textPrimary', tabular, style, ...rest }: TextProps) {
  const t = useTheme();
  const s = type[variant];
  return (
    <RNText
      {...rest}
      style={[
        { color: t.c[color], fontSize: s.size, lineHeight: s.line, fontWeight: s.weight as '400' | '500' | '600' },
        'letterSpacing' in s ? { letterSpacing: s.letterSpacing } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
