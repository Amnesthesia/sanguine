import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { Button } from './Button';
import { Screen } from './Screen';

/** A pushed page with a fixed Back button (the app uses no native navigation header). */
export function SubScreen({ title, testID, children }: { title: string; testID: string; children: ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.screenBg, paddingTop: insets.top }}>
      <View style={{ alignItems: 'flex-start', paddingHorizontal: 4 }}>
        <Button kind="text" testID="back" label={t('common.back')} onPress={() => router.back()} />
      </View>
      <Screen testID={testID} title={title} bottomInset={48} noTopInset>
        {children}
      </Screen>
    </View>
  );
}
