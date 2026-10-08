import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme';
import { type Unit, stepDate } from './dateStep';
import { formatDayYear, MONTHS_SHORT } from './format';
import { Text } from './Text';

const UNITS: Unit[] = ['day', 'month', 'year'];

/** Day / month / year steppers. Plain React Native, so it behaves the same in Expo Go on both platforms and is easy to automate. */
export function DateField({ value, onChange, min, max, testID }: { value: string; onChange: (iso: string) => void; min: string; max: string; testID?: string }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const [y, m, d] = value.split('-');
  const shown: Record<Unit, string> = { day: String(Number(d)), month: MONTHS_SHORT[Number(m) - 1] as string, year: y as string };
  const btn = (unit: Unit, delta: 1 | -1) => (
    <Pressable
      testID={`${testID ?? 'date'}-${unit}-${delta > 0 ? 'up' : 'down'}`}
      accessibilityRole="button"
      accessibilityLabel={tr(delta > 0 ? 'date.later' : 'date.earlier', { unit: tr(`date.${unit}`).toLowerCase() })}
      onPress={() => onChange(stepDate(value, unit, delta, min, max))}
      style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: t.chipBg }}>
      <Text variant="heading">{delta > 0 ? '+' : '−'}</Text>
    </Pressable>
  );
  return (
    <View testID={testID} accessible={false} style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        {UNITS.map((u) => (
          <View key={u} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
            <Text variant="caption" color="textSecondary">{tr(`date.${u}`)}</Text>
            {btn(u, 1)}
            <Text variant="title" tabular style={{ minWidth: 56, textAlign: 'center' }}>{shown[u]}</Text>
            {btn(u, -1)}
          </View>
        ))}
      </View>
      <Text variant="bodySmall" color="textSecondary" style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">{formatDayYear(value)}</Text>
    </View>
  );
}
