// The native splash continued in JS so the tagline can fade in under the mark (D-042). It sits exactly where the
// native splash image sits (centred, 200pt), so the hand-over is seamless, then fades the whole screen out.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, Image, StyleSheet, View } from 'react-native';
import mark from '../../../assets/brand/splash-mark.png';

/** Brand red: the splash, the icon and the About band only (PLAN.md §9.9, D-042). */
export const BRAND_RED = '#B8324A';
const MARK = 200; // app.json expo-splash-screen imageWidth
const TAGLINE_IN_MS = 700;
const HOLD_MS = 900;
const OUT_MS = 350;

/** One of the splash taglines (copy `app.taglines`), a different draw on each launch. */
export function BrandSplash({ onDone, pick = Math.random }: { onDone: () => void; pick?: () => number }) {
  const { t } = useTranslation();
  const lines = t('app.taglines', { returnObjects: true }) as string[];
  const [line] = useState(() => lines[Math.floor(pick() * lines.length)] ?? lines[0]);
  const tagline = useRef(new Animated.Value(0)).current;
  const screen = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled) return;
      // Reduce Motion: no fades, the tagline is simply shown for the same time
      anim = reduce
        ? Animated.sequence([Animated.timing(tagline, { toValue: 1, duration: 0, useNativeDriver: true }), Animated.delay(TAGLINE_IN_MS + HOLD_MS)])
        : Animated.sequence([
            Animated.timing(tagline, { toValue: 1, duration: TAGLINE_IN_MS, useNativeDriver: true }),
            Animated.delay(HOLD_MS),
            Animated.timing(screen, { toValue: 0, duration: OUT_MS, useNativeDriver: true }),
          ]);
      anim.start(() => onDone());
    });
    return () => { cancelled = true; anim?.stop(); };
  }, [tagline, screen, onDone]);

  return (
    <Animated.View testID="brand-splash" style={[StyleSheet.absoluteFill, styles.bg, { opacity: screen }]}>
      <Image source={mark} style={{ width: MARK, height: MARK }} accessibilityIgnoresInvertColors accessible accessibilityRole="image" accessibilityLabel={t('app.name')} />
      <View style={styles.taglineRow} pointerEvents="none">
        <Animated.Text style={[styles.tagline, { opacity: tagline }]} maxFontSizeMultiplier={1.5} accessibilityRole="text">
          {line}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: BRAND_RED, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  taglineRow: { position: 'absolute', top: '50%', marginTop: MARK / 2 + 20, left: 16, right: 16, alignItems: 'center' },
  tagline: { color: '#FFFFFF', fontFamily: 'DancingScript_700Bold', fontSize: 28, lineHeight: 38, textAlign: 'center' },
});
