import { TextInput, View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

/** Labelled numeric/text input. The label doubles as the accessibility label; errors are announced with the field. */
export function TextField({ label, value, onChangeText, error, helper, keyboardType = 'number-pad', maxLength, testID, placeholder, onSubmit }: {
  label: string; value: string; onChangeText: (s: string) => void; error?: string | undefined; helper?: string; keyboardType?: 'number-pad' | 'default' | 'numbers-and-punctuation' | 'decimal-pad'; maxLength?: number; testID?: string; placeholder?: string; onSubmit?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="bodySmall" color="textSecondary">{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={error ?? helper}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        returnKeyType={onSubmit ? 'done' : 'default'}
        onSubmitEditing={onSubmit}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={t.c.textSecondary}
        style={{ minHeight: 52, borderRadius: t.radius.tile, paddingHorizontal: 16, fontSize: 18, color: t.c.textPrimary, backgroundColor: t.chipBg, borderWidth: 1.5, borderColor: error ? t.c.period : 'transparent' }}
      />
      {error ? <Text variant="bodySmall" style={{ color: t.c.period }} accessibilityLiveRegion="polite">{error}</Text> : helper ? <Text variant="bodySmall" color="textSecondary">{helper}</Text> : null}
    </View>
  );
}
