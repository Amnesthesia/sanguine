import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { BackButton } from './BackButton';
import { Screen } from './Screen';

/** A pushed page with a fixed Back button (the app uses no native navigation header). */
export function SubScreen({ title, testID, children }: { title: string; testID: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.screenBg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 12 }}><BackButton /></View>
      <Screen testID={testID} title={title} bottomInset={48} noTopInset>
        {children}
      </Screen>
    </View>
  );
}
