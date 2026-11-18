// Widget snapshot (PLAN.md §8.3, §8.8, P3-5, D-047). The app writes a small snapshot after every prediction refresh;
// the widget renders only that. Default content is the ring and the day count; the headline goes in only when the
// user turns widget details on. iOS only: expo-widgets' Android renderer is a placeholder in SDK 57 (D-047).
import { addDays, diffDays, type Prediction } from '@sanguine/engine';
import { Platform } from 'react-native';
import i18n from '@/i18n';
import { buildToday } from '@/features/today/todayModel';
import type { TodayWidgetProps } from '@/widgets/TodayWidget';

export const widgetsSupported = Platform.OS === 'ios';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const MIN_RING_DAYS = 21;

/** How far round the ring today is: cycle day over the expected cycle length (at least 21 days, 28 without a next period). 0 when there is no cycle or estimates are paused. */
function ringProgress(p: Prediction | undefined, hasCycles: boolean, today: string): number {
  if (!hasCycles || !p || p.suspended) return 0;
  const day = p.currentPhase?.dayOfCycle ?? 1;
  const length = Math.max(MIN_RING_DAYS, p.nextPeriod ? diffDays(p.nextPeriod.point, addDays(today, -(day - 1))) : 28);
  return clamp01(day / length);
}

/** Pure: the snapshot for today. Exported for tests. */
export function widgetSnapshot(i: { prediction: Prediction | undefined; hasCycles: boolean; today: string; descriptive: boolean; appName: string }): TodayWidgetProps {
  const model = buildToday({ prediction: i.prediction, hasCycles: i.hasCycles, today: i.today, showEstimate: false, todayFlow: undefined });
  const day = model.dayOfCycle ?? 0;
  const progress = ringProgress(i.prediction, i.hasCycles, i.today);
  const base: TodayWidgetProps = { day, progress, appName: i.appName, details: i.descriptive };
  if (!i.descriptive) return base;
  const headline = i18n.t(model.headline.key, model.headline.params);
  const detail = model.subtitle ? i18n.t(model.subtitle.key, model.subtitle.params) : undefined;
  return { ...base, headline, ...(detail ? { detail } : {}) };
}

export async function syncWidget(props: TodayWidgetProps): Promise<void> {
  if (!widgetsSupported) return;
  // required lazily: the native module exists only in the dev client on iOS
  const { default: TodayWidget } = require('@/widgets/TodayWidget') as typeof import('@/widgets/TodayWidget');
  TodayWidget.updateSnapshot(props);
}
