// Local reminders only: no push token is ever requested (PLAN.md §6.1). The user's reminder rules, rescheduled whenever the prediction changes (D-090).
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import i18n from '@/i18n';
import { displayName } from './discreet';
import { type ReminderPlan, reminderText } from '@/features/notifications/plan';

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
    const text = reminderText(plan);
    await Notifications.scheduleNotificationAsync({
      identifier: `sanguine-${plan.id}`,
      content: {
        title: displayName(discreet),
        // discreet by default: no health words on the lock screen unless the user turned the details on (§8.8)
        body: plan.descriptive ? i18n.t(text.key, text.params) : i18n.t('notifications.defaultBody'),
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
