// Discreet icon (PLAN.md §8.8, P3-6, D-048): the alternate app icon "Notes" (a leaf on neutral grey) and the display
// name that follows it, used by the notification title and the widget. The native switch is a lazy require: the
// module exists only in the dev client.
import { Platform } from 'react-native';
import i18n from '@/i18n';

export const DISCREET_ICON = 'Notes';

type Icons = typeof import('expo-alternate-app-icons');
const icons = (): Icons | null => {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-alternate-app-icons') as Icons;
  } catch {
    return null;
  }
};

export const discreetIconSupported = (): boolean => icons()?.supportsAlternateIcons ?? false;

/** Switches the home-screen icon. Resolves to the icon now in use (null = the Sanguine icon). */
export async function setDiscreetIcon(on: boolean): Promise<boolean> {
  const m = icons();
  if (!m?.supportsAlternateIcons) return false;
  const name = await m.setAlternateAppIcon(on ? DISCREET_ICON : null);
  return name === DISCREET_ICON;
}

/** The name the phone shows for the app right now: "Notes" while the discreet icon is on. */
export function displayName(discreet: boolean): string {
  return discreet ? i18n.t('app.discreetName') : i18n.t('app.name');
}
