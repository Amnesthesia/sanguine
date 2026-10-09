// Screenshots and the recent-apps picture (PLAN.md §8.8, P3-6, D-048). Android: FLAG_SECURE blocks both. iOS: capture
// is blocked the same way and the app-switcher picture is blurred. The recovery code screen blocks capture whatever the
// setting says, because a screenshot of those words defeats the backup's point.
import { allowScreenCaptureAsync, disableAppSwitcherProtectionAsync, enableAppSwitcherProtectionAsync, preventScreenCaptureAsync, usePreventScreenCapture } from 'expo-screen-capture';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useApp } from '@/state/app';

const APP_KEY = 'sanguine.app';

/** Renders nothing; applies the user's setting for the whole app. */
export function ScreenProtection() {
  const on = useApp((s) => s.prefs.screenProtection);
  useEffect(() => {
    // Debug builds never block capture: it also blanks the simulators' own screenshots, which the Maestro flows depend on
    // (unseeded flows such as onboarding included). Release builds are unaffected (D-055).
    if (Platform.OS === 'web' || __DEV__) return;
    if (on) {
      void preventScreenCaptureAsync(APP_KEY).catch(() => {});
      if (Platform.OS === 'ios') void enableAppSwitcherProtectionAsync(0.5).catch(() => {});
    } else {
      void allowScreenCaptureAsync(APP_KEY).catch(() => {});
      if (Platform.OS === 'ios') void disableAppSwitcherProtectionAsync().catch(() => {});
    }
  }, [on]);
  return null;
}

function Block() {
  usePreventScreenCapture('sanguine.recovery');
  return null;
}

/** Mount inside a screen that must never be captured (the recovery code). Inert in debug builds, like the app-wide block. */
export function NoCapture() {
  return __DEV__ ? null : <Block />;
}
