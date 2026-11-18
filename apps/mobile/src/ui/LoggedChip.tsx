import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

export function LoggedChip({ label, mark, onRemove }: { label: string; mark: 'flow' | 'symptom' | 'other'; onRemove: () => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, borderRadius: 18, backgroundColor: t.cardBg, borderWidth: 1, borderColor: t.hairline }}>
      <View accessibilityElementsHidden style={{ width: mark === 'flow' ? 9 : 6, height: mark === 'flow' ? 10 : 6, borderRadius: mark === 'flow' ? 5 : 3, borderTopLeftRadius: mark === 'flow' ? 0 : 3, transform: [{ rotate: mark === 'flow' ? '45deg' : '0deg' }], backgroundColor: mark === 'flow' ? t.c.period : mark === 'symptom' ? t.c.accent : t.c.textSecondary }} />
      <Text variant="bodySmall">{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={tr('contentKit.remove', { label })} onPress={onRemove} style={{ minWidth: 44, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
        <Text color="textSecondary">✕</Text>
      </Pressable>
    </View>
  );
}
