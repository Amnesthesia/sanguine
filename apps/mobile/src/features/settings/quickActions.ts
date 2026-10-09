// Home-screen quick actions (P8-8, D-085): hold the app icon for "Log period" or "Log temperature", opening the logging sheet through
// the same route as the in-app buttons (so the app lock still applies). Off by default and absent while the discreet icon is on (§8.8):
// the menu shows its titles under the icon. Siri, App Shortcuts and Control Center wait for expo-app-intents (SDK 58).
export interface QuickItem { id: string; title: string; icon: string; params: { href: string } }

export function quickActionItems(on: boolean, discreetIcon: boolean, t: (key: string) => string): QuickItem[] {
  if (!on || discreetIcon) return [];
  return [
    { id: 'log-period', title: t('settings.notifications.quickPeriod'), icon: 'symbol:drop', params: { href: '/log?section=period' } },
    { id: 'log-temperature', title: t('settings.notifications.quickTemperature'), icon: 'symbol:thermometer.medium', params: { href: '/log?section=temperature' } },
  ];
}
