// The system date picker (owner, 2026-10-10: the day/month/year steppers made far-back years slow to reach). iOS: the compact
// SwiftUI picker, a date button that opens the system calendar with its month-and-year wheel. Android: a field that opens the
// Material 3 date dialog, whose year list jumps straight to any year. Both through @expo/ui, so no new dependency.
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { formatDayYear } from './format';
import { Text } from './Text';

/** ISO day to a local Date at noon, so no time zone moves it to the neighbouring day. */
export const isoToDate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
};
export const dateToIso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function DateField({ value, onChange, min, max, testID }: { value: string; onChange: (iso: string) => void; min: string; max: string; testID?: string }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const [open, setOpen] = useState(false);
  const pick = (d: Date) => {
    const iso = dateToIso(d);
    onChange(iso < min ? min : iso > max ? max : iso); // the pickers already enforce the range; this keeps the contract if one does not
  };
  const picker = (
    <DateTimePicker
      testID={testID}
      value={isoToDate(value)}
      mode="date"
      display={Platform.OS === 'ios' ? 'compact' : 'default'}
      presentation="dialog"
      minimumDate={isoToDate(min)}
      maximumDate={isoToDate(max)}
      accentColor={t.c.accent}
      themeVariant={t.scheme}
      onValueChange={(_e, d) => { setOpen(false); pick(d); }}
      onDismiss={() => setOpen(false)}
    />
  );
  if (Platform.OS === 'ios') return picker;
  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={formatDayYear(value)}
        accessibilityHint={tr('date.change')}
        onPress={() => setOpen(true)}
        style={{ minHeight: 52, justifyContent: 'center', paddingHorizontal: 16, borderRadius: t.radius.tile, backgroundColor: t.chipBg }}>
        <Text>{formatDayYear(value)}</Text>
      </Pressable>
      {open ? picker : null}
    </>
  );
}
