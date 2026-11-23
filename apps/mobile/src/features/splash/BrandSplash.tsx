// The native splash continued in JS (PLAN.md §9.9, D-049, D-051, D-154): on iOS the lock-up sits exactly where the native splash image
// sits (centred, 260 pt), so the hand-over is seamless; Android 12+ masks the native image to a circle, so there the native splash
// is the bare field and the lock-up fades in here. Then the 200 px rule and the tagline fade in beneath it. To enter the app the
// lock-up narrows to a line like a card turned edge-on and the crescent moon widens out of it (D-154), then the bite of the crescent
// opens onto the app and everything scales up about the bite's centre, as if flying through it. Only 2D transforms, and no
// transformOrigin: the native driver ignores transformOrigin (the zoom ran to a corner), and a 3D rotation is clipped by the
// full-screen layers beneath it (half the lock-up vanished); both shipped once in P8-37 and were seen only on a phone. Under Reduce Motion nothing moves: the
// lock-up and tagline show at once and the splash ends without the flip or the zoom. Colours follow the system scheme, like the
// native splash. Prototype and frames: docs/design/splash-transition/.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, Easing, Image, Platform, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import lockupDark from '../../../assets/brand/splash-lockup-dark.png';
import lockup from '../../../assets/brand/splash-lockup.png';
import { circles, crescentPath, fieldWithHole, zoomShift, zoomToCover } from './crescent';
import { Text } from '@/ui/Text';

/** The brand field and ink (PLAN.md §9.9, D-051): the splash, the icon and the About band only, never the UI tokens. The moon is
 * the splash's crescent: ink on blush, moonlight yellow on plum (owner, D-154). */
export const BRAND = {
  light: { field: '#F5E8E2', ink: '#73393B', text: '#73393B', moon: '#73393B' },
  dark: { field: '#2A1518', ink: '#E3A7AD', text: '#F5E8E2', moon: '#F4D27A' },
} as const;
const LOCKUP_WIDTH = 260; // app.json expo-splash-screen imageWidth
const LOCKUP_ASPECT = 881 / 780; // tools/brand/build.ts lock-up canvas
const FADE_IN_MS = 700;
const LOGO_IN_MS = 300; // Android: the lock-up fades in over the bare native splash
const HOLD_MS = 3500; // long enough to read the longest tagline unhurried (owner, 2026-10-10: 2 s was too short)
const TAG_OUT_MS = 300;
const FLIP_MS = 800; // a line at the half-way point, where the lock-up hands over to the moon
const EDGE = 0.001; // scaleX at the half-way point: never 0, a singular transform
const MOON_HOLD_MS = 250;
const OPEN_MS = 150; // the bite clears from field to app
const ZOOM_MS = 850;
const TOTAL_MS = FADE_IN_MS + HOLD_MS + FLIP_MS + MOON_HOLD_MS + ZOOM_MS;
const RULE_WIDTH = 200;

export function BrandSplash({ tagline, onDone }: { tagline: string | undefined; onDone: () => void }) {
  const { t } = useTranslation();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = BRAND[scheme];
  // the splash's own size (the window until the first layout): the hole and the zoom are placed in its coordinates
  const win = useWindowDimensions();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const { w, h } = size ?? { w: win.width, h: win.height };
  const { bite } = circles(w / 2, h / 2);
  // at least 2: before a real size is known (0×0) the cover scale would be below 1, and an interpolation's range must rise
  const zoomMax = Math.max(zoomToCover(w, h, bite), 2);

  const reveal = useRef(new Animated.Value(0)).current; // rule and tagline
  const logo = useRef(new Animated.Value(Platform.OS === 'android' ? 0 : 1)).current; // the lock-up itself, Android only
  const flip = useRef(new Animated.Value(0)).current; // 0 lock-up face on, 0.5 edge-on, 1 moon face on
  const cover = useRef(new Animated.Value(1)).current; // the plain field over the bite; 0 shows the app through it
  const zoom = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    let finished = false;
    const finish = () => { if (!finished) { finished = true; onDone(); } };
    // The splash covers the app until it hands over, so it must hand over even if an animation never reports its end.
    const guard = setTimeout(finish, TOTAL_MS + 1500);
    const native = { useNativeDriver: true } as const;
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then((reduce) => {
      if (cancelled) return;
      anim = reduce
        ? Animated.sequence([Animated.parallel([Animated.timing(reveal, { toValue: 1, duration: 0, ...native }), Animated.timing(logo, { toValue: 1, duration: 0, ...native })]), Animated.delay(FADE_IN_MS + HOLD_MS)])
        : Animated.sequence([
            Animated.parallel([
              Animated.timing(logo, { toValue: 1, duration: LOGO_IN_MS, ...native }),
              Animated.timing(reveal, { toValue: 1, duration: FADE_IN_MS, ...native }),
            ]),
            Animated.delay(HOLD_MS),
            Animated.parallel([
              Animated.timing(reveal, { toValue: 0, duration: TAG_OUT_MS, ...native }),
              Animated.timing(flip, { toValue: 1, duration: FLIP_MS, easing: Easing.inOut(Easing.cubic), ...native }),
            ]),
            Animated.delay(MOON_HOLD_MS),
            Animated.parallel([
              Animated.timing(cover, { toValue: 0, duration: OPEN_MS, ...native }),
              Animated.timing(zoom, { toValue: zoomMax, duration: ZOOM_MS, easing: Easing.in(Easing.cubic), ...native }),
            ]),
          ]);
      anim.start(finish);
    });
    return () => { cancelled = true; clearTimeout(guard); anim?.stop(); };
  }, [reveal, logo, flip, cover, zoom, zoomMax, onDone]);

  const height = LOCKUP_WIDTH * LOCKUP_ASPECT;
  // the zoom about the bite's centre: an outer view shifts, an inner view scales about its own centre (see zoomShift)
  const [tx, ty] = zoomShift(bite.x, bite.y, w, h, zoomMax);
  const shift = { transform: [{ translateX: zoom.interpolate({ inputRange: [1, zoomMax], outputRange: [0, tx] }) }, { translateY: zoom.interpolate({ inputRange: [1, zoomMax], outputRange: [0, ty] }) }] };
  const grow = { transform: [{ scale: zoom }] };
  const front = {
    opacity: flip.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [1, 1, 0, 0] }),
    transform: [{ scaleX: flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, EDGE, EDGE] }) }],
  };
  const back = {
    opacity: flip.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [0, 0, 1, 1] }),
    transform: [{ scaleX: flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [EDGE, EDGE, 1] }) }],
  };
  return (
    <View testID="brand-splash" style={[StyleSheet.absoluteFill, styles.top]} onLayout={(e) => { const l = e.nativeEvent.layout; setSize({ w: l.width, h: l.height }); }}>
      {/* the field with the bite cut out, under a plain field that clears when the zoom starts */}
      <Animated.View style={[StyleSheet.absoluteFill, shift]} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, grow]}>
          <Svg width={w} height={h}><Path d={fieldWithHole(w, h, bite)} fill={c.field} fillRule="evenodd" /></Svg>
        </Animated.View>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.field, opacity: cover }]} pointerEvents="none" />
      <Animated.View style={[StyleSheet.absoluteFill, shift]} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Animated.View style={[StyleSheet.absoluteFill, grow]}>
          <Animated.View style={[StyleSheet.absoluteFill, back]}>
            <Svg width={w} height={h}><Path d={crescentPath(w / 2, h / 2)} fill={c.moon} /></Svg>
          </Animated.View>
        </Animated.View>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.centre, front]} pointerEvents="none">
        <Animated.View style={{ opacity: logo }}>
          <Image source={scheme === 'dark' ? lockupDark : lockup} style={{ width: LOCKUP_WIDTH, height }} resizeMode="contain" accessibilityIgnoresInvertColors accessible accessibilityRole="image" accessibilityLabel={t('app.name')} />
        </Animated.View>
      </Animated.View>
      {tagline ? (
        <Animated.View style={[styles.below, { top: '50%', marginTop: height / 2 + 28, opacity: reveal }]} pointerEvents="none">
          <View style={{ width: RULE_WIDTH, height: 1, backgroundColor: c.ink, opacity: 0.6 }} />
          <Text caps variant="caption" style={[styles.tagline, { color: c.text }]} maxFontSizeMultiplier={1.5}>{tagline}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { zIndex: 1000 },
  centre: { alignItems: 'center', justifyContent: 'center' },
  below: { position: 'absolute', left: 32, right: 32, alignItems: 'center', gap: 18 },
  tagline: { textAlign: 'center', fontSize: 14, lineHeight: 22 },
});
