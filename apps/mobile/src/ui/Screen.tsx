import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { Text } from './Text';

export const GUTTER = 16;

/** Gap between a floating action and the tab bar: taps at the bar's edge land on a tab (D-093). */
const FLOAT_GAP = 12;

/** Scrollable screen on the theme's background with an optional large title. Content is padded clear of the tab bar.
 *  `floating`: the screen's one primary action, pinned above the tab bar within thumb reach (D-099); the content is padded by its
 *  measured height, so nothing (the §2.3 footer included) ever sits under it, at any font scale. */
export function Screen({ title, children, testID, bottomInset = 96, header, noTopInset, floating }: { title?: string; children: ReactNode; testID?: string; bottomInset?: number; header?: ReactNode; noTopInset?: boolean; floating?: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [floatH, setFloatH] = useState(0);
  return (
    <View style={[styles.fill, { backgroundColor: t.screenBg }]} testID={testID}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        // iOS: contentInsetAdjustmentBehavior already adds the top safe area, so padding it again stacked the inset twice (U-1, D-076)
        contentContainerStyle={{ paddingTop: (noTopInset || t.isIOS ? 0 : insets.top) + 8, paddingBottom: bottomInset + insets.bottom + (floating ? floatH : 0), paddingHorizontal: GUTTER, gap: 20 }}>
        {header}
        {title ? <Text variant="title" accessibilityRole="header" style={{ fontSize: t.isIOS ? 34 : 28, lineHeight: t.isIOS ? 41 : 34 }}>{title}</Text> : null}
        {children}
      </ScrollView>
      {/* the view's own bottom safe area: inside the native tab controller it includes the tab bar */}
      {floating ? (
        <SafeAreaView edges={['bottom']} style={styles.float}>
          <View style={{ paddingHorizontal: GUTTER, paddingBottom: FLOAT_GAP, pointerEvents: 'box-none' }} onLayout={(e) => setFloatH(e.nativeEvent.layout.height)}>{floating}</View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({ fill: { flex: 1 }, float: { position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'box-none' } });
