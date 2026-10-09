import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { Text } from './Text';

export const GUTTER = 16;

/** Scrollable screen on the theme's background with an optional large title. Content is padded clear of the tab bar. */
export function Screen({ title, children, testID, bottomInset = 96, header, noTopInset }: { title?: string; children: ReactNode; testID?: string; bottomInset?: number; header?: ReactNode; noTopInset?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fill, { backgroundColor: t.screenBg }]} testID={testID}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        // iOS: contentInsetAdjustmentBehavior already adds the top safe area, so padding it again stacked the inset twice (U-1, D-076)
        contentContainerStyle={{ paddingTop: (noTopInset || t.isIOS ? 0 : insets.top) + 8, paddingBottom: bottomInset + insets.bottom, paddingHorizontal: GUTTER, gap: 12 }}>
        {header}
        {title ? <Text variant="title" accessibilityRole="header" style={{ fontSize: t.isIOS ? 34 : 28, lineHeight: t.isIOS ? 41 : 34 }}>{title}</Text> : null}
        {children}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ fill: { flex: 1 } });
