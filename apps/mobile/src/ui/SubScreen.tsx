import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { BackButton } from './BackButton';
import { Screen } from './Screen';
import { Text } from './Text';

/** A pushed page with a fixed header: the Back chevron and the title on one row (the app uses no native navigation header). */
export function SubScreen({ title, testID, backTestID, bottomInset = 48, children }: { title: string; testID: string; backTestID?: string; bottomInset?: number; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.screenBg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingLeft: 4, paddingRight: 16 }}>
        <BackButton testID={backTestID} />
        <Text variant="heading" accessibilityRole="header" numberOfLines={2} style={{ flex: 1, fontSize: 18, lineHeight: 23 }}>{title}</Text>
      </View>
      <Screen testID={testID} bottomInset={bottomInset} noTopInset>
        {children}
      </Screen>
    </View>
  );
}
