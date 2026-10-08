import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme';

/** Content card: `surface` radius 16 on iOS, `surfaceContainer` radius 28 on Android; no shadow (§9.3). */
export function Card({ children, style, edge, ...rest }: ViewProps & { children: ReactNode; edge?: string }) {
  const t = useTheme();
  return (
    <View
      {...rest}
      style={[
        { backgroundColor: t.cardBg, borderRadius: t.radius.card, padding: 16, overflow: 'hidden', gap: 4 },
        t.isIOS ? { borderWidth: 1, borderColor: t.hairline } : null,
        edge ? { borderLeftWidth: 4, borderLeftColor: edge } : null,
        style,
      ]}>
      {children}
    </View>
  );
}
