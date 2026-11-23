import { type ReactNode, useEffect, useRef, useState } from 'react';
import { View, type ViewProps } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '@/theme';
import { GlassSurface } from '@/ui/GlassBar';
import { TAB_BAR_INSET } from '@/ui/Screen';
import { type Detent, dragHeight, SPRING, type Snaps, settle, shownAt, snapDetent } from './sheetSnap';

/** Gap above the tab bar (as Screen's floating action) and the room the large detent leaves under the status bar. */
const FLOAT_GAP = 12;
const LARGE_TOP = 40;
/** Frames Calendar-1-Closed and Calendar-2-SheetOpen: the bar and the small sheet sit 10 pt in from the screen edges; the bar's corners are 28 pt, the sheet's 34. */
const SIDE = 10;
const RADIUS = { bar: 28, sheet: 34 } as const;

export interface SheetMotionProps {
  detent: Detent;
  onDetent: (d: Detent) => void;
  /** The tallest the small detent may be (sheetMaxHeight). */
  maxSmall: number;
  /** The large detent's scrim (a labelled button); it fades in with the height. */
  scrim: ReactNode;
  /** Height of the settled bar or small sheet, so the screen behind can pad its content clear of it. */
  onInset: (h: number) => void;
  /** The content of a detent: `grip` is the part that drags the sheet (the bar, or the header), `body` the rest (it scrolls or taps, never drags), `root` the props of the
   *  view holding both. The drag handle itself lives here and stays mounted when the content changes, so a drag survives the swap a quarter of the way in. */
  children: (shown: Detent, largeH: number) => { grip: ReactNode; body?: ReactNode; root?: ViewProps };
}

/**
 * The day sheet's movement (P8-23, D-092 exception): one sheet whose height follows the finger on the UI thread across three detents
 * (compact bar, small, large) and settles with a spring carrying the finger's velocity; under Reduce Motion it settles with a short timing,
 * never without animation. Buttons in the content move it too (they change `detent`). The content shown follows the height (`shownAt`),
 * so the next detent's content is already there while the finger pulls the sheet towards it.
 */
export function SheetMotion({ detent, onDetent, maxSmall, scrim, onInset, children }: SheetMotionProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [measured, setMeasured] = useState<Snaps>({ closed: 0, small: 0, large: 0 });
  const [shown, setShown] = useState<Detent>(detent);
  // until a detent has been measured it gets a reasonable height, so the snapping order (bar < small < large) always holds
  const small = Math.max(measured.closed + 1, measured.small || Math.min(maxSmall, 320));
  const snapsNow: Snaps = { closed: measured.closed, small, large: Math.max(small + 1, measured.large) };
  const h = useSharedValue(0);
  const start = useSharedValue(0);
  const dragging = useSharedValue(false);
  const placed = useRef(false);
  /** The height the sheet is moving to or resting at, so a detent the drag already settles on is not restarted (it would lose the flick's velocity). */
  const aim = useSharedValue(-1);
  const snaps = useSharedValue<Snaps>(snapsNow);

  const go = (to: number, velocityY: number) => {
    'worklet';
    const m = settle(reduce, velocityY);
    aim.value = to;
    h.value = m.kind === 'timing' ? withTiming(to, { duration: m.duration }) : withSpring(to, { ...SPRING, velocity: m.velocity });
  };

  // a new detent from a button, or a remeasured one: move there (a drag in progress keeps the finger's height)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the three heights are the snaps; `go` is rebuilt every render
  useEffect(() => {
    snaps.value = snapsNow;
    if (!snapsNow.closed) return;
    const to = snapsNow[detent];
    // first placement: no animation from nothing (a ref, not the shared value: reading a shared value on the JS thread is not a reliable "unset" test)
    if (!placed.current) { placed.current = true; aim.value = to; h.value = to; return; }
    if (dragging.value || aim.value === to) return;
    go(to, 0);
  }, [detent, snapsNow.closed, snapsNow.small, snapsNow.large]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reports the settled height only when it changes
  useEffect(() => { onInset(snapsNow[detent === 'large' ? 'small' : detent]); }, [detent, snapsNow.closed, snapsNow.small]);

  useAnimatedReaction(() => shownAt(h.value, snaps.value), (cur, prev) => { if (cur !== prev) scheduleOnRN(setShown, cur); });

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-24, 24])
    .onStart(() => {
      dragging.value = true;
      start.value = h.value;
    })
    .onUpdate((e) => {
      h.value = dragHeight(start.value, e.translationY, snaps.value);
    })
    .onEnd((e) => {
      const d = snapDetent(h.value, e.velocityY, snaps.value);
      go(snaps.value[d], e.velocityY);
      scheduleOnRN(onDetent, d);
    })
    .onFinalize((_e, success) => {
      // a drag the system cancelled (a call, a system gesture) never reaches onEnd: settle where it is instead of leaving the sheet half-way
      if (!success && dragging.value) {
        const d = snapDetent(h.value, 0, snaps.value);
        go(snaps.value[d], 0);
        scheduleOnRN(onDetent, d);
      }
      dragging.value = false;
    });

  // full width and opaque at the large detent, inset glass below it; the scrim darkens in step
  // on iOS the closed bar and the small sheet line up with the tab bar's edges (D-158); the frames' 10 pt stays elsewhere
  const side = t.isIOS ? TAB_BAR_INSET : SIDE;
  const sheetStyle = useAnimatedStyle(() => ({ height: h.value, marginHorizontal: interpolate(h.value, [snaps.value.small, snaps.value.large], [side, 0], Extrapolation.CLAMP) }));
  const fillStyle = useAnimatedStyle(() => ({ minHeight: h.value }));
  const opaqueStyle = useAnimatedStyle(() => ({ opacity: interpolate(h.value, [snaps.value.small, snaps.value.large], [0, 1], Extrapolation.CLAMP) }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: interpolate(h.value, [snaps.value.small, snaps.value.large], [0, 0.6], Extrapolation.CLAMP) }));

  // switches with the content (a quarter of the way into a drag), so the corner change hides in the content change
  const radius = shown === 'closed' ? RADIUS.bar : RADIUS.sheet;
  const measure = (height: number) => {
    if (shown === 'large') return;
    const v = shown === 'small' ? Math.min(height, maxSmall) : height;
    if (Math.abs(v - measured[shown]) >= 1) setMeasured((m) => ({ ...m, [shown]: v }));
  };
  const content = children(shown, snapsNow.large);
  return (
    <>
      <Animated.View pointerEvents={detent === 'large' ? 'auto' : 'none'} style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.c.bg }, scrimStyle]}>{scrim}</Animated.View>
      <SafeAreaView edges={['bottom']} pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <View
          pointerEvents="box-none"
          onLayout={(e) => { const large = e.nativeEvent.layout.height - FLOAT_GAP - insets.top - LARGE_TOP; if (Math.abs(large - measured.large) >= 1) setMeasured((m) => ({ ...m, large })); }}
          style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: FLOAT_GAP }}>
          {/* until the bar has been measured the sheet takes its content's own height (so there is something to measure), then the animated height takes over at the same size */}
          <Animated.View style={[{ borderRadius: radius, boxShadow: '0 1px 2px rgba(31,26,28,0.06), 0 14px 36px rgba(31,26,28,0.16)' }, measured.closed > 0 ? sheetStyle : null]}>
            <View style={{ borderRadius: radius, overflow: 'hidden', ...(measured.closed > 0 ? { flex: 1 } : null) }}>
              {/* legible glass: the month list scrolling beneath must not read through the bar or the sheet (D-130, fix plan X1/C1) */}
              <GlassSurface flat legible="soft" style={{ borderRadius: radius }}>
                <Animated.View style={fillStyle}>
                  <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.screenBg }, opaqueStyle]} />
                  <View onLayout={(e) => measure(e.nativeEvent.layout.height)}>
                    <View {...content.root}>
                      {/* one drag handle for every detent: it is the same element while the content under it changes, so the gesture is not torn down mid-drag */}
                      <GestureDetector gesture={pan}><View collapsable={false}>{content.grip}</View></GestureDetector>
                      {content.body}
                    </View>
                  </View>
                </Animated.View>
              </GlassSurface>
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </>
  );
}
