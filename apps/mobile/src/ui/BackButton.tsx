import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button } from './Button';

/** The app's own Back control (no native navigation header): a system-style chevron and the word, left-aligned. */
export function BackButton({ testID = 'back' }: { testID?: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <View style={{ alignItems: 'flex-start', marginLeft: -8 }}>
      <Button kind="text" testID={testID} label={`‹ ${t('common.back')}`} accessibilityLabel={t('common.back')} onPress={() => router.back()} />
    </View>
  );
}
