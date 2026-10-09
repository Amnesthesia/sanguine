import { CormorantGaramond_500Medium, useFonts } from '@expo-google-fonts/cormorant-garamond';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState, Text as RNText, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/i18n';
import { useApp } from '@/state/app';
import { LockGate } from '@/features/lock/LockGate';
import { ScreenProtection } from '@/features/lock/ScreenProtection';
import { BrandSplash } from '@/features/splash/BrandSplash';
import { taglineFor } from '@/features/splash/tagline';
import { isTeen } from '@/data/prefs';
import { ThemeProvider, useTheme } from '@/theme';
import { Button } from '@/ui/Button';

void SplashScreen.preventAutoHideAsync();

function Shell() {
  const t = useTheme();
  const status = useApp((s) => s.status);
  const onboarded = useApp((s) => s.onboarded);
  const error = useApp((s) => s.error);
  const keyMismatch = useApp((s) => s.keyMismatch);
  const startFresh = useApp((s) => s.startFresh);
  const { t: tr } = useTranslation();
  const nav = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
  if (status === 'error' && keyMismatch) {
    const confirm = () => Alert.alert(tr('errors.keyMismatch.confirmTitle'), tr('errors.keyMismatch.confirmBody'), [
      { text: tr('common.cancel'), style: 'cancel' },
      { text: tr('errors.keyMismatch.confirm'), style: 'destructive', onPress: () => void startFresh() },
    ]);
    return (
      <View testID="screen-key-mismatch" style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: t.screenBg }}>
        <RNText accessibilityRole="header" style={{ color: t.c.textPrimary, fontSize: 18, fontWeight: '600' }}>{tr('errors.keyMismatch.title')}</RNText>
        <RNText style={{ color: t.c.textPrimary, fontSize: 16, lineHeight: 24 }}>{tr('errors.keyMismatch.body')}</RNText>
        <Button testID="start-fresh" label={tr('errors.keyMismatch.action')} kind="destructive" onPress={confirm} />
      </View>
    );
  }
  if (status === 'error')
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: t.screenBg }}>
        <RNText style={{ color: t.c.textPrimary, fontSize: 16 }}>Could not open your data. {error}</RNText>
      </View>
    );
  return (
    <NavThemeProvider value={{ ...nav, colors: { ...nav.colors, background: t.screenBg, card: t.screenBg, text: t.c.textPrimary, primary: t.c.accent, border: t.hairline } }}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.screenBg } }}>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="log" options={{ presentation: 'modal' }} />
          <Stack.Screen name="day/[date]" />
          <Stack.Screen name="cycle/[id]" />
          <Stack.Screen name="settings/lifestate" />
          <Stack.Screen name="settings/health" />
          <Stack.Screen name="settings/privacy" />
          <Stack.Screen name="settings/backup" />
          <Stack.Screen name="settings/notifications" />
          <Stack.Screen name="settings/appearance" />
          <Stack.Screen name="settings/tracking" />
          <Stack.Screen name="settings/about" />
        </Stack.Protected>
        <Stack.Screen name="dev/seed" />
      </Stack>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ CormorantGaramond_500Medium });
  const status = useApp((s) => s.status);
  const theme = useApp((s) => s.prefs.theme);
  const init = useApp((s) => s.init);
  const refresh = useApp((s) => s.refresh);
  const [splashShown, setSplashShown] = useState(false);
  const splashDone = useCallback(() => setSplashShown(true), []);
  const launchCount = useApp((s) => s.launchCount);
  const birthYear = useApp((s) => s.profile.birthYear);
  const { t: trSplash } = useTranslation();

  useEffect(() => { void init(); }, [init]);
  // a new day, or coming back to the app, recomputes today's prediction
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void refresh(); });
    return () => sub.remove();
  }, [refresh]);
  const ready = fontsLoaded && status !== 'loading';
  useEffect(() => { if (ready) void SplashScreen.hideAsync(); }, [ready]);
  // the capture block must not wait for fonts and data: it is applied from the first frame (D-049, review finding)
  if (!ready) return <ScreenProtection />;

  return (
    <SafeAreaProvider>
      <ThemeProvider pref={theme}>
        <LockGate>
          <Shell />
        </LockGate>
        <ScreenProtection />
        {!splashShown && <BrandSplash tagline={taglineFor(launchCount, trSplash('app.taglines', { returnObjects: true }) as string[], isTeen(birthYear, new Date().getFullYear()))} onDone={splashDone} />}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
