// Analytics, crash-reporting, advertising and attribution SDKs (CLAUDE.md non-negotiable).
export const DENY_PATTERNS: RegExp[] = [
  /sentry/i, /bugsnag/i, /crashlytics/i, /firebase/i, /amplitude/i, /mixpanel/i, /segment/i,
  /posthog/i, /appsflyer/i, /adjust/i, /branch/i, /singular/i, /kochava/i, /datadog/i,
  /newrelic/i, /instabug/i, /logrocket/i, /smartlook/i, /heap/i, /clevertap/i, /onesignal/i,
  /braze/i, /facebook/i, /fbsdk/i, /google-mobile-ads/i, /admob/i, /applovin/i, /unity-ads/i,
  /ironsource/i, /appcenter/i, /countly/i, /matomo/i, /plausible/i, /telemetry/i,
  /analytics/i, /expo-tracking-transparency/i, /expo-ads/i, /expo-insights/i,
];
