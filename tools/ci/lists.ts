// PLAN.md §10 Expo Go allow-list for apps/mobile `dependencies` (Phases 0-2).
// Remove the allow-list test at P3-1. Entries marked "template" are Expo Go built-ins
// that the SDK 57 template needs; they are native modules already bundled in Expo Go.
export const EXPO_GO_ALLOW = [
  'expo-router', 'expo-sqlite', 'expo-secure-store', 'expo-local-authentication',
  'expo-notifications', 'expo-file-system', 'expo-sharing', 'expo-document-picker',
  'expo-font', 'expo-blur', 'expo-haptics', 'expo-localization', 'expo-crypto',
  'expo-auth-session', '@expo/ui', 'react-native-reanimated', 'react-native-gesture-handler',
  'react-native-svg', 'react-native-screens', 'zustand', 'i18next', '@noble/ciphers', '@noble/hashes',
  // §6.1 stack, pure JS
  'react-i18next',
  // template / peer requirements (all in Expo Go)
  'expo', 'react', 'react-native', 'react-native-safe-area-context', 'react-native-worklets',
  'expo-constants', 'expo-device', 'expo-image', 'expo-linking', 'expo-splash-screen',
  'expo-status-bar', 'expo-symbols', 'expo-system-ui', 'expo-web-browser',
  // workspace packages
  '@sanguine/engine', '@sanguine/crypto', '@sanguine/ui-tokens', '@sanguine/health-adapter',
];
export const EXPO_GO_ALSO_ALLOWED_PREFIX = ['@expo-google-fonts/'];

// Analytics, crash-reporting, advertising and attribution SDKs (CLAUDE.md non-negotiable).
export const DENY_PATTERNS: RegExp[] = [
  /sentry/i, /bugsnag/i, /crashlytics/i, /firebase/i, /amplitude/i, /mixpanel/i, /segment/i,
  /posthog/i, /appsflyer/i, /adjust/i, /branch/i, /singular/i, /kochava/i, /datadog/i,
  /newrelic/i, /instabug/i, /logrocket/i, /smartlook/i, /heap/i, /clevertap/i, /onesignal/i,
  /braze/i, /facebook/i, /fbsdk/i, /google-mobile-ads/i, /admob/i, /applovin/i, /unity-ads/i,
  /ironsource/i, /appcenter/i, /countly/i, /matomo/i, /plausible/i, /telemetry/i,
  /analytics/i, /expo-tracking-transparency/i, /expo-ads/i, /expo-insights/i,
];
