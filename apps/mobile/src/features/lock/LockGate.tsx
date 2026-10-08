// Covers the app with the lock screen and hides content in the app switcher (PLAN.md §8.8).
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, View } from 'react-native';
import { useApp } from '@/state/app';
import { useLock } from '@/state/lock';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';

export function LockGate({ children }: { children: ReactNode }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const { locked, failed, evaluate, noteBackground, tryUnlock } = useLock();
  const ready = useApp((s) => s.status === 'ready' && s.onboarded);
  const appLock = useApp((s) => s.prefs.appLock);
  const [hidden, setHidden] = useState(false); // app switcher snapshot cover
  const last = useRef(AppState.currentState);

  useEffect(() => { if (ready) void evaluate(appLock, tr('lock.reason')); }, [ready, appLock, evaluate, tr]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      setHidden(s !== 'active');
      if (s === 'background') noteBackground();
      // only a return from the background re-checks the lock: the system Face ID sheet and the app switcher only pass through 'inactive'
      if (s === 'active' && last.current === 'background' && ready) void evaluate(appLock, tr('lock.reason'));
      last.current = s;
    });
    return () => sub.remove();
  }, [ready, appLock, evaluate, noteBackground, tr]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {locked ? (
        <View testID="lock-screen" accessibilityViewIsModal style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.screenBg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <Text variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>{tr('lock.title')}</Text>
          <Text color="textSecondary" style={{ textAlign: 'center' }}>{tr('lock.explain')}</Text>
          {failed ? <Text variant="bodySmall" style={{ color: t.c.period }} accessibilityLiveRegion="polite">{tr('lock.failed')}</Text> : null}
          <Button testID="unlock-button" label={tr('lock.unlock')} onPress={() => void tryUnlock(tr('lock.reason'))} />
        </View>
      ) : null}
      {hidden && !locked ? <View pointerEvents="none" testID="privacy-cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.screenBg }} /> : null}
    </View>
  );
}
