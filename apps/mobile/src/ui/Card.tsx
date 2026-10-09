import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme';

/** Content card: white (`surface`) on both platforms; iOS radius 16 with a hairline, Android radius 28 with M3 level-1 elevation so
 *  the card lifts off the screen instead of reading flat (§9.3, D-066). */
export function Card({ children, style, edge, ...rest }: ViewProps & { children: ReactNode; edge?: string }) {
  const t = useTheme();
  return (
    <View
      {...rest}
      style={[
        { backgroundColor: t.cardBg, borderRadius: t.radius.card, padding: 16, overflow: 'hidden', gap: 4 },
        t.isIOS ? { borderWidth: 1, borderColor: t.hairline } : { elevation: 1 },
        edge ? { borderLeftWidth: 4, borderLeftColor: edge } : null,
        style,
      ]}>
      {children}
    </View>
  );
}
