import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { swipeMonthDelta } from './calendarModel';

/**
 * Horizontal swipe between months on the calendar grid. The grid follows the finger; past the threshold it slides
 * out and the new month slides in from the other side (a cross-fade under Reduce Motion). The pan only claims
 * mostly-horizontal drags, so the screen still scrolls vertically and a tap still selects a day.
 */
export function SwipeMonth({ month, onSwipe, children }: { month: string; onSwipe: (delta: -1 | 1) => void; children: ReactNode }) {
  const reduce = useReducedMotion();
  const width = useSharedValue(0);
  const x = useSharedValue(0);
  const opacity = useSharedValue(1);
  const prev = useRef(month);

  // every month change (swipe, arrows, Today) enters from the side it lies on
  useLayoutEffect(() => {
    if (prev.current === month) return;
    const dir = month > prev.current ? 1 : -1; // 'YYYY-MM' sorts as text
    prev.current = month;
    if (reduce) {
      x.value = 0;
      opacity.value = 0;
      opacity.value = withTiming(1, { duration: 120 });
    } else {
      x.value = dir * width.value;
      x.value = withTiming(0, { duration: 200 });
    }
  }, [month, reduce, x, opacity, width]);

  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      x.value = e.translationX;
    })
    .onEnd((e) => {
      const d = swipeMonthDelta(e.translationX, e.velocityX, width.value);
      if (d === 0) {
        x.value = withSpring(0, { damping: 20, stiffness: 220 });
        return;
      }
      x.value = withTiming(-d * width.value, { duration: 160 }, (done) => {
        if (done) scheduleOnRN(onSwipe, d);
      });
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], opacity: opacity.value }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View testID="cal-swipe" style={{ overflow: 'hidden' }} onLayout={(e) => { width.value = e.nativeEvent.layout.width; }}>
        <Animated.View style={style}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
