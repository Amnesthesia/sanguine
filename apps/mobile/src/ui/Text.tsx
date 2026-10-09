import { type ColorToken, type } from '@sanguine/ui-tokens';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/theme';
import { capsSpacing, SERIF } from './fonts';

export type Variant = keyof typeof type;
export interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: ColorToken;
  tabular?: boolean;
  /** Brand tagline (splash and About band only): Cormorant Garamond capitals, letter-spacing 0.2em (PLAN.md §9.9, D-051). */
  caps?: boolean;
}

/** Type scale from PLAN.md §9.3. Scales with the system font size; layouts must tolerate 150%. */
export function Text({ variant = 'body', color = 'textPrimary', tabular, caps, style, ...rest }: TextProps) {
  const t = useTheme();
  const s = type[variant];
  return (
    <RNText
      {...rest}
      style={[
        { color: t.c[color], fontSize: s.size, lineHeight: s.line },
        // the brand face carries its own weight; setting fontWeight on top of it can pick a synthetic bold on Android
        caps ? { fontFamily: SERIF, textTransform: 'uppercase', letterSpacing: capsSpacing(s.size), fontVariant: ['lining-nums'] } : { fontWeight: s.weight as '400' | '500' | '600' },
        !caps && 'letterSpacing' in s ? { letterSpacing: s.letterSpacing } : null,
        tabular ? { fontVariant: caps ? ['lining-nums', 'tabular-nums'] : ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
}
