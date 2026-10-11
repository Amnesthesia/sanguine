import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { Card } from './Card';
import { Text } from './Text';

const useToast = create<{ message: string | null }>(() => ({ message: null }));
const dismiss = () => useToast.setState({ message: null });

// no animation: the app has none of its own (PLAN.md §8.9)
/** Shows a short message at the top of the screen for a few seconds; a tap dismisses it. One at a time: a new one replaces it. */
export const showToast = (message: string) => useToast.setState({ message });

/** Mounted once in the root layout. A message queued before it mounts (at launch, under the splash) shows when it does. */
export function ToastHost() {
  const message = useToast((s) => s.message);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    AccessibilityInfo.announceForAccessibility(message);
    const id = setTimeout(dismiss, 4000);
    return () => clearTimeout(id);
  }, [message]);
  if (!message) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16 }}>
      <Pressable testID="toast" accessibilityRole="button" accessibilityLabel={message} onPress={dismiss} style={{ minHeight: 44 }}>
        <Card style={{ shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4, overflow: 'visible' }}>
          <Text variant="bodySmall">{message}</Text>
        </Card>
      </Pressable>
    </View>
  );
}
