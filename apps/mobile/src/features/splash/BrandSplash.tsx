// The native splash continued in JS (PLAN.md §9.9, D-049, D-051): on iOS the lock-up sits exactly where the native splash image sits
// (centred, 260 pt), so the hand-over is seamless; Android 12+ masks the native image to a circle, so there the native splash
// is the bare field and the lock-up fades in here. Then the 200 px rule and the tagline fade in beneath it and the whole
// screen fades out. The native splash stays up until JS is ready (the app renders nothing before that). Opacity only; no
// fades under Reduce Motion. Colours follow the system scheme, like the native splash.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, Image, Platform, StyleSheet, useColorScheme, View } from 'react-native';
import lockupDark from '../../../assets/brand/splash-lockup-dark.png';
import lockup from '../../../assets/brand/splash-lockup.png';
import { Text } from '@/ui/Text';

/** The brand field and ink (PLAN.md §9.9, D-051): the splash, the icon and the About band only, never the UI tokens. */
export const BRAND = {
  light: { field: '#F5E8E2', ink: '#73393B', text: '#73393B' },
  dark: { field: '#2A1518', ink: '#E3A7AD', text: '#F5E8E2' },
} as const;
const LOCKUP_WIDTH = 260; // app.json expo-splash-screen imageWidth
const LOCKUP_ASPECT = 881 / 780; // tools/brand/build.ts lock-up canvas
const FADE_IN_MS = 700;
const LOGO_IN_MS = 300; // Android: the lock-up fades in over the bare native splash
const HOLD_MS = 2000; // long enough to read the longest tagline
const OUT_MS = 350;
const RULE_WIDTH = 200;

export function BrandSplash({ tagline, onDone }: { tagline: string | undefined; onDone: () => void }) {
  const { t } = useTranslation();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = BRAND[scheme];
  const reveal = useRef(new Animated.Value(0)).current; // rule and tagline
  const logo = useRef(new Animated.Value(Platform.OS === 'android' ? 0 : 1)).current; // the lock-up itself, Android only
  const screen = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled) return;
      anim = reduce
        ? Animated.sequence([Animated.parallel([Animated.timing(reveal, { toValue: 1, duration: 0, useNativeDriver: true }), Animated.timing(logo, { toValue: 1, duration: 0, useNativeDriver: true })]), Animated.delay(FADE_IN_MS + HOLD_MS)])
        : Animated.sequence([
            Animated.parallel([
              Animated.timing(logo, { toValue: 1, duration: LOGO_IN_MS, useNativeDriver: true }),
              Animated.timing(reveal, { toValue: 1, duration: FADE_IN_MS, useNativeDriver: true }),
            ]),
            Animated.delay(HOLD_MS),
            Animated.timing(screen, { toValue: 0, duration: OUT_MS, useNativeDriver: true }),
          ]);
      anim.start(() => onDone());
    });
    return () => { cancelled = true; anim?.stop(); };
  }, [reveal, logo, screen, onDone]);

  const height = LOCKUP_WIDTH * LOCKUP_ASPECT;
  return (
    <Animated.View testID="brand-splash" style={[StyleSheet.absoluteFill, styles.bg, { backgroundColor: c.field, opacity: screen }]}>
      <Animated.View style={{ opacity: logo }}>
        <Image source={scheme === 'dark' ? lockupDark : lockup} style={{ width: LOCKUP_WIDTH, height }} resizeMode="contain" accessibilityIgnoresInvertColors accessible accessibilityRole="image" accessibilityLabel={t('app.name')} />
      </Animated.View>
      {tagline ? (
        <Animated.View style={[styles.below, { top: '50%', marginTop: height / 2 + 28, opacity: reveal }]} pointerEvents="none">
          <View style={{ width: RULE_WIDTH, height: 1, backgroundColor: c.ink, opacity: 0.6 }} />
          <Text caps variant="caption" style={[styles.tagline, { color: c.text }]} maxFontSizeMultiplier={1.5}>{tagline}</Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bg: { alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  below: { position: 'absolute', left: 32, right: 32, alignItems: 'center', gap: 18 },
  tagline: { textAlign: 'center', fontSize: 14, lineHeight: 22 },
});
