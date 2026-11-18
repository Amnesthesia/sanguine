// Covers the app with the lock screen and hides content in the app switcher (PLAN.md §8.8).
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useApp } from '@/state/app';
import { useLock } from '@/state/lock';
import { useTheme } from '@/theme';
import { createTracker } from './appStateTracker';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';

/** The Face ID glyph beside "Unlock" (frame Lock-Screen): a face in four corner brackets, in the primary button's ink. It is a drawing; the button's label names the action. */
function FaceIdGlyph() {
  const c = useTheme().c.onAccent;
  return <Svg testID="unlock-glyph" width={20} height={20} viewBox="0 0 24 24"><Path d="M4 8.5V6.5A2.5 2.5 0 0 1 6.5 4H8.5M15.5 4H17.5A2.5 2.5 0 0 1 20 6.5V8.5M20 15.5V17.5A2.5 2.5 0 0 1 17.5 20H15.5M8.5 20H6.5A2.5 2.5 0 0 1 4 17.5V15.5M9 9.2V10.6M15 9.2V10.6M12.2 9.2V13.2H11.2M9.4 15.4C10.8 16.6 13.2 16.6 14.6 15.4" fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

export function LockGate({ children }: { children: ReactNode }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const { locked, decided, failed, evaluate, noteBackground, tryUnlock } = useLock();
  const ready = useApp((s) => s.status === 'ready' && s.onboarded);
  const appLock = useApp((s) => s.prefs.appLock);
  const [hidden, setHidden] = useState(false); // app switcher snapshot cover
  const track = useMemo(createTracker, []);

  useEffect(() => { if (ready) void evaluate(appLock, tr('lock.reason')); }, [ready, appLock, evaluate, tr]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      setHidden(s !== 'active');
      if (s === 'background') noteBackground();
      // only a return from the background re-checks the lock: the system Face ID sheet and the app switcher only pass through 'inactive'
      if (track(s) === 'evaluate' && ready) void evaluate(appLock, tr('lock.reason'));
    });
    return () => sub.remove();
  }, [ready, appLock, evaluate, noteBackground, track, tr]);

  // until the first lock decision is made the content stays covered: the check is asynchronous and must not show a frame of data first
  const undecided = ready && appLock && !decided;
  return (
    <View style={{ flex: 1 }}>
      {children}
      {locked ? (
        <View testID="lock-screen" accessibilityViewIsModal style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.screenBg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          {/* a narrow column, so the text stays readable on a tablet */}
          <View style={{ width: '100%', maxWidth: 420, alignItems: 'center', gap: 16 }}>
            <View testID="lock-glyph" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={32} height={32} viewBox="0 0 24 24">
                <Rect x={5} y={10.5} width={14} height={10} rx={3} fill="none" stroke={t.c.onAccentSoft} strokeWidth={1.7} />
                <Path d="M8.2 10.5V8A3.8 3.8 0 0 1 15.8 8V10.5M12 14.4V16.6" fill="none" stroke={t.c.onAccentSoft} strokeWidth={1.7} strokeLinecap="round" />
              </Svg>
            </View>
            <Text variant="title" accessibilityRole="header" style={{ textAlign: 'center', fontWeight: '700' }}>{tr('lock.title')}</Text>
            <Text color="textSecondary" style={{ textAlign: 'center', fontSize: 15, lineHeight: 21 }}>{tr('lock.explain')}</Text>
            {failed ? <Text variant="bodySmall" style={{ color: t.c.period, textAlign: 'center' }} accessibilityLiveRegion="polite">{tr('lock.failed')}</Text> : null}
            <Button testID="unlock-button" icon={<FaceIdGlyph />} label={tr('lock.unlock')} onPress={() => void tryUnlock(tr('lock.reason'))} style={{ marginTop: 8, minWidth: 200 }} />
          </View>
        </View>
      ) : null}
      {undecided && !locked ? <View pointerEvents="none" testID="lock-pending" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.screenBg }} /> : null}
      {hidden && !locked ? <View pointerEvents="none" testID="privacy-cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.screenBg }} /> : null}
    </View>
  );
}
