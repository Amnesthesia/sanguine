import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { GlassSurface, useChromeBottom } from './GlassBar';
import { useTheme } from '@/theme';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';

type ToastAction = { label: string; onPress: () => void };
// `seq` counts messages and `announced` is the last one read out, so a message is announced once even when the host showing it changes.
// `modals`: hosts mounted inside a native modal (the log sheet); the root host sits under the modal, so it yields while one exists.
const useToast = create<{ message: string | null; action?: ToastAction; seq: number; announced: number; modals: number }>(() => ({ message: null, seq: 0, announced: 0, modals: 0 }));
const dismiss = () => useToast.setState({ message: null, action: undefined });

// no animation: the app has none of its own (PLAN.md §8.9)
/** Shows a short message at the top of the screen for a few seconds; a tap dismisses it. One at a time: a new one replaces it. */
export const showToast = (message: string, action?: ToastAction) => useToast.setState((s) => ({ message, action, seq: s.seq + 1 }));

/** Mounted once in the root layout. A message queued before it mounts (at launch, under the splash) shows when it does.
 *  `modal`: mount one inside a native modal screen, which covers the root host; only the modal host shows and announces while it exists.
 *  `top`: distance from the host's top edge, for a host with no Screen toolbar above it. Default: just under the active screen's toolbar. */
export function ToastHost({ modal, top }: { modal?: boolean; top?: number } = {}) {
  const { message, action, seq, modals } = useToast();
  const chromeBottom = useChromeBottom((s) => s.bottom);
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!modal) return;
    useToast.setState((s) => ({ modals: s.modals + 1 }));
    return () => useToast.setState((s) => ({ modals: s.modals - 1 }));
  }, [modal]);
  const active = modal || modals === 0;
  useEffect(() => {
    if (!message || !active) return;
    if (useToast.getState().announced !== seq) {
      useToast.setState({ announced: seq });
      AccessibilityInfo.announceForAccessibility(action ? t('chrome.actionAvailable', { message, label: action.label }) : message);
    }
    const id = setTimeout(dismiss, action ? 6000 : 4000);
    return () => clearTimeout(id);
  }, [message, action, seq, active, t]);
  if (!message || !active) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: top ?? (chromeBottom || insets.top + theme.glass.inset + 60) + 8, left: theme.glass.inset, right: theme.glass.inset }}>
      <GlassSurface><View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 4, gap: 12 }}>
        <Pressable testID="toast" accessibilityRole="button" accessibilityLabel={message} onPress={dismiss} style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
          <Text variant="bodySmall" color="textOnGlass">{message}</Text>
        </Pressable>
        {action ? <Pressable accessibilityRole="button" accessibilityLabel={action.label} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }} onPress={() => {
          if (useToast.getState().action !== action) return;
          dismiss();
          action.onPress();
        }}><Text color="textOnGlass" style={{ fontWeight: '600', textDecorationLine: 'underline' }}>{action.label}</Text></Pressable> : null}
      </View></GlassSurface>
    </View>
  );
}
