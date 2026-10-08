// Local reminders only: no push token is ever requested (PLAN.md §6.1). One reminder, rescheduled whenever the prediction changes.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import i18n from '@/i18n';
import type { ReminderPlan } from '@/features/notifications/plan';

const ID = 'sanguine-period';
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

/** Replaces any scheduled reminder with `plan` (or none). Returns the fire date, or undefined. */
export async function syncReminder(plan: ReminderPlan | undefined): Promise<string | undefined> {
  if (!remindersSupported) return undefined;
  const Notifications = lib();
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
  if (!plan) return undefined;
  if (!(await Notifications.getPermissionsAsync()).granted) return undefined;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(CHANNEL, { name: i18n.t('notifications.channel'), importance: Notifications.AndroidImportance.DEFAULT });
  const [y, m, d] = plan.fireDate.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d, plan.hour, 0, 0);
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: {
      title: i18n.t('notifications.defaultTitle'),
      // discreet by default: no health words on the lock screen unless the user turned the details on (§8.8)
      body: plan.descriptive ? i18n.t('notifications.periodBody', { lo: plan.lo, hi: plan.hi }) : i18n.t('notifications.defaultBody'),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
  });
  return plan.fireDate;
}

export async function cancelReminder(): Promise<void> {
  if (!remindersSupported) return;
  await lib().cancelScheduledNotificationAsync(ID).catch(() => {});
}
