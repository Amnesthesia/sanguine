import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme';

/** Opaque content card with the shared soft elevation. */
export function Card({ children, style, edge, ...rest }: ViewProps & { children: ReactNode; edge?: string }) {
  const t = useTheme();
  return (
    <View
      {...rest}
      style={[
        { backgroundColor: t.cardBg, borderRadius: t.radius.card, padding: 16, gap: 4 },
        t.elevation.card,
        edge ? { borderLeftWidth: 4, borderLeftColor: edge } : null,
        style,
      ]}>
      {children}
    </View>
  );
}
