// The native splash continued in JS so the wordmark and a tagline can fade in under the mark (D-042, D-044). It sits
// exactly where the native splash image sits (centred, 200pt), so the hand-over is seamless, then fades the whole screen out.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import mark from '../../../assets/brand/splash-mark.png';

/** Brand red: the splash, the icon and the About band only (PLAN.md §9.9, D-042). */
export const BRAND_RED = '#B8324A';
/** The vignette edge, as on the icon (tools/brand/build.ts WINE_EDGE). */
const BRAND_RED_EDGE = '#962439';
const MARK = 200; // app.json expo-splash-screen imageWidth
const TAGLINE_IN_MS = 700;
const HOLD_MS = 2000; // long enough to read the longest tagline
const OUT_MS = 350;

/** One of the splash taglines (copy `app.taglines`), a different draw on each launch. */
export function BrandSplash({ onDone, pick = Math.random }: { onDone: () => void; pick?: () => number }) {
  const { t } = useTranslation();
  const lines = t('app.taglines', { returnObjects: true }) as string[];
  const [line] = useState(() => lines[Math.floor(pick() * lines.length)] ?? lines[0]);
  const reveal = useRef(new Animated.Value(0)).current; // vignette, wordmark and tagline
  const screen = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled) return;
      // Reduce Motion: no fades, the wordmark and tagline are simply shown for the same time
      anim = reduce
        ? Animated.sequence([Animated.timing(reveal, { toValue: 1, duration: 0, useNativeDriver: true }), Animated.delay(TAGLINE_IN_MS + HOLD_MS)])
        : Animated.sequence([
            Animated.timing(reveal, { toValue: 1, duration: TAGLINE_IN_MS, useNativeDriver: true }),
            Animated.delay(HOLD_MS),
            Animated.timing(screen, { toValue: 0, duration: OUT_MS, useNativeDriver: true }),
          ]);
      anim.start(() => onDone());
    });
    return () => { cancelled = true; anim?.stop(); };
  }, [reveal, screen, onDone]);

  return (
    <Animated.View testID="brand-splash" style={[StyleSheet.absoluteFill, styles.bg, { opacity: screen }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: reveal }]} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="v" cx="50%" cy="40%" r="75%">
              <Stop offset="0.55" stopColor={BRAND_RED} />
              <Stop offset="1" stopColor={BRAND_RED_EDGE} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#v)" />
        </Svg>
      </Animated.View>
      <Image source={mark} style={{ width: MARK, height: MARK }} accessibilityIgnoresInvertColors accessible accessibilityRole="image" accessibilityLabel={t('app.name')} />
      <View style={styles.wordmarkRow} pointerEvents="none">
        <Animated.Text style={[styles.wordmark, { opacity: reveal }]} maxFontSizeMultiplier={1.2} accessibilityElementsHidden importantForAccessibility="no">
          {t('app.name')}
        </Animated.Text>
      </View>
      <View style={styles.taglineRow} pointerEvents="none">
        <Animated.Text style={[styles.tagline, { opacity: reveal }]} maxFontSizeMultiplier={1.5} accessibilityRole="text">
          {line}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: BRAND_RED, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  wordmarkRow: { position: 'absolute', top: '50%', marginTop: MARK / 2 + 8, left: 16, right: 16, alignItems: 'center' },
  wordmark: { color: '#FFFFFF', fontFamily: 'Cinzel_600SemiBold', fontSize: 40, lineHeight: 52, letterSpacing: 4, textTransform: 'uppercase', textAlign: 'center' },
  taglineRow: { position: 'absolute', bottom: 72, left: 24, right: 24, alignItems: 'center' },
  tagline: { color: '#FFFFFF', fontFamily: 'Cinzel_400Regular', fontSize: 14, lineHeight: 24, letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center' },
});
