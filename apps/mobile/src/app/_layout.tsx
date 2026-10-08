import { DancingScript_700Bold, useFonts } from '@expo-google-fonts/dancing-script';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Text as RNText, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '@/i18n';
import { useApp } from '@/state/app';
import { ThemeProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

function Shell() {
  const t = useTheme();
  const status = useApp((s) => s.status);
  const onboarded = useApp((s) => s.onboarded);
  const error = useApp((s) => s.error);
  const nav = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
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
        </Stack.Protected>
        <Stack.Screen name="dev/seed" />
      </Stack>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ DancingScript_700Bold });
  const status = useApp((s) => s.status);
  const theme = useApp((s) => s.prefs.theme);
  const init = useApp((s) => s.init);
  const refresh = useApp((s) => s.refresh);

  useEffect(() => { void init(); }, [init]);
  // a new day, or coming back to the app, recomputes today's prediction
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void refresh(); });
    return () => sub.remove();
  }, [refresh]);
  const ready = fontsLoaded && status !== 'loading';
  useEffect(() => { if (ready) void SplashScreen.hideAsync(); }, [ready]);
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider pref={theme}>
        <Shell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
