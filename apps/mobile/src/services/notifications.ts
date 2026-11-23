// Local reminders only: no push token is ever requested (PLAN.md §6.1). The user's reminder rules, rescheduled whenever the prediction changes (D-090).
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import i18n from '@/i18n';
import { displayName } from './discreet';
import { type ReminderPlan, reminderBody } from '@/features/notifications/plan';

const CHANNEL = 'reminders';

/** Android in Expo Go cannot even import expo-notifications (it throws since SDK 53), so reminders there wait for the dev client (P3-1). */
export const remindersSupported = !(Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient);

type NotificationsModule = typeof import('expo-notifications');
let loaded: NotificationsModule | undefined;
function lib(): NotificationsModule {
  if (!loaded) {
    loaded = require('expo-notifications') as NotificationsModule;
    loaded.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  }
  return loaded;
}

export async function ensurePermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  const Notifications = lib();
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Replaces every scheduled reminder with `plans`. Returns the earliest fire date, or undefined. */
export async function syncReminders(plans: ReminderPlan[], discreet = false): Promise<string | undefined> {
  if (!remindersSupported) return undefined;
  const Notifications = lib();
  // only Sanguine's own reminders exist (local, no push), so clearing all is clearing ours, including the one-id reminder before D-090
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  if (plans.length === 0) return undefined;
  if (!(await Notifications.getPermissionsAsync()).granted) return undefined;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(CHANNEL, { name: i18n.t('notifications.channel'), importance: Notifications.AndroidImportance.DEFAULT });
  for (const plan of plans) {
    const [y, m, d] = plan.fireDate.split('-').map(Number) as [number, number, number];
    await Notifications.scheduleNotificationAsync({
      identifier: `sanguine-${plan.id}`,
      content: {
        title: displayName(discreet),
        // discreet by default: no health words on the lock screen unless the user turned the details on or wrote the text themselves (§8.8, D-152)
        body: reminderBody(plan, (key, params) => i18n.t(key, params)),
        // a tap opens today's log sheet (D-152)
        data: { url: '/log' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(y, m - 1, d, plan.hour, 0, 0), ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
    });
  }
  return plans[0]?.fireDate;
}

export async function cancelReminders(): Promise<void> {
  if (!remindersSupported) return;
  await lib().cancelAllScheduledNotificationsAsync().catch(() => {});
}

let lastHandled: string | undefined;
/** Tapping a reminder opens today's log sheet (D-152), through the same route as the in-app buttons and the quick actions (D-085), so the app
 *  lock still applies. Only the one known route is followed, whatever a notification's data says. A tap that cold-starts the app is read once. */
export function useReminderTapRouting(): void {
  const router = useRouter();
  useEffect(() => {
    if (!remindersSupported) return;
    const N = lib();
    const open = (r: import('expo-notifications').NotificationResponse | null) => {
      if (!r) return;
      const key = `${r.notification.request.identifier}@${r.notification.date}`;
      if (key === lastHandled || r.notification.request.content.data?.url !== '/log') return;
      lastHandled = key;
      N.clearLastNotificationResponse(); // a JS reload (an applied update) must not reopen the sheet
      router.navigate('/log');
    };
    try { open(N.getLastNotificationResponse()); } catch { /* a cold-start response that cannot be read is dropped */ }
    const sub = N.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [router]);
}
