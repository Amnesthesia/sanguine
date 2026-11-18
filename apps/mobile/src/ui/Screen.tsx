import { type ReactNode, type Ref, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { useChromeBottom } from './GlassBar';

export const GUTTER = 16;

/** Gap between a floating action and the tab bar: taps at the bar's edge land on a tab (D-093). */
const FLOAT_GAP = 12;

/** Scrollable screen on the theme's background with an optional large title (tab roots: the title is drawn once, large, with no bar).
 *  `chrome`: a floating glass toolbar (GlassBar) the content scrolls beneath; a pushed page puts its title in the bar, not in `title`.
 *  `floating`: the screen's one primary action, pinned above the tab bar within thumb reach (D-099); the content is padded by its
 *  measured height, so nothing (the §2.3 footer included) ever sits under it, at any font scale.
 *  `scrollRef`: the scroll view, for the dev-only `?scroll=` link (features/dev/devParams.ts). */
export function Screen({ title, children, testID, bottomInset = 96, header, noTopInset, floating, chrome, scrollRef }: { title?: string; children: ReactNode; testID?: string; bottomInset?: number; header?: ReactNode; noTopInset?: boolean; floating?: ReactNode; chrome?: ReactNode; scrollRef?: Ref<ScrollView> }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [floatH, setFloatH] = useState(0);
  const [chromeH, setChromeH] = useState(60);
  const toolbar = chrome ?? null;
  const hasToolbar = toolbar !== null;
  const chromeBottom = insets.top + t.glass.inset + chromeH;
  // the toast sits under whichever toolbar is on screen; the cleanup only clears its own value, so a screen mounting next keeps its own
  useEffect(() => {
    if (!hasToolbar) return;
    useChromeBottom.setState({ bottom: chromeBottom });
    return () => { if (useChromeBottom.getState().bottom === chromeBottom) useChromeBottom.setState({ bottom: 0 }); };
  }, [hasToolbar, chromeBottom]);
  return (
    <View style={[styles.fill, { backgroundColor: t.screenBg }]} testID={testID}>
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior={toolbar ? 'never' : 'automatic'}
        // iOS: contentInsetAdjustmentBehavior already adds the top safe area, so padding it again stacked the inset twice (U-1, D-076)
        contentContainerStyle={{ paddingTop: (toolbar ? chromeBottom : noTopInset || t.isIOS ? 0 : insets.top) + 8, paddingBottom: bottomInset + insets.bottom + (floating ? floatH : 0), paddingHorizontal: GUTTER, gap: 20 }}>
        {header}
        {title ? <Text variant="title" accessibilityRole="header" style={{ fontSize: t.isIOS ? 34 : 28, lineHeight: t.isIOS ? 41 : 34 }}>{title}</Text> : null}
        {children}
      </ScrollView>
      {/* a solid band behind the status bar, so scrolled content never shows through it above the floating toolbar */}
      {toolbar ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: t.screenBg }} /> : null}
      {toolbar ? <View onLayout={(e) => setChromeH(e.nativeEvent.layout.height)} style={{ position: 'absolute', top: insets.top + t.glass.inset, left: t.glass.inset, right: t.glass.inset }}>{toolbar}</View> : null}
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
