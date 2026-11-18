import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { GlassSurface } from './GlassBar';
import { useTheme } from '@/theme';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';

type ToastAction = { label: string; onPress: () => void };
const useToast = create<{ message: string | null; action?: ToastAction }>(() => ({ message: null }));
const dismiss = () => useToast.setState({ message: null, action: undefined });

// no animation: the app has none of its own (PLAN.md §8.9)
/** Shows a short message at the top of the screen for a few seconds; a tap dismisses it. One at a time: a new one replaces it. */
export const showToast = (message: string, action?: ToastAction) => useToast.setState({ message, action });

/** Mounted once in the root layout. A message queued before it mounts (at launch, under the splash) shows when it does. */
export function ToastHost() {
  const { message, action } = useToast();
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    AccessibilityInfo.announceForAccessibility(action ? t('chrome.actionAvailable', { message, label: action.label }) : message);
    const id = setTimeout(dismiss, action ? 6000 : 4000);
    return () => clearTimeout(id);
  }, [message, action, t]);
  if (!message) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 80, left: theme.glass.inset, right: theme.glass.inset }}>
      <GlassSurface><View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 4, gap: 12 }}>
        <Pressable testID="toast" accessibilityRole="button" accessibilityLabel={message} onPress={dismiss} style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
          <Text variant="bodySmall" color="textOnGlass">{message}</Text>
        </Pressable>
        {action ? <Pressable accessibilityRole="button" accessibilityLabel={action.label} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }} onPress={() => {
          if (useToast.getState().action !== action) return;
          dismiss();
          action.onPress();
        }}><Text color="accent">{action.label}</Text></Pressable> : null}
      </View></GlassSurface>
    </View>
  );
}
