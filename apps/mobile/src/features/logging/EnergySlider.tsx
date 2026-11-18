// Five-step energy slider (D-123): tap a step to log it, "Clear" removes the value. Unset shows no thumb.
// ponytail: tap only; dragging across steps is not implemented, add a pan responder if testers ask.
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type EnergyLevel = 0 | 1 | 2 | 3 | 4 | 5;
const LEVELS = [1, 2, 3, 4, 5] as const;

/** Screen-reader increment and decrement: one step, inside 1 to 5; from "Not logged" only increment writes. */
export function stepEnergy(value: EnergyLevel, dir: 'increment' | 'decrement'): EnergyLevel {
  if (value === 0 && dir === 'decrement') return 0;
  return Math.min(5, Math.max(1, value + (dir === 'increment' ? 1 : -1))) as EnergyLevel;
}

export function EnergySlider({ value, onChange }: { value: EnergyLevel; onChange: (v: EnergyLevel) => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const word = value ? tr(`log.energyLevels.${value}`) : tr('log.energyNotLogged');
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44 }}>
        <Text variant="body" color={value ? 'onAccentSoft' : 'textSecondary'} style={{ fontWeight: value ? '600' : '400', flexShrink: 1 }}>{word}</Text>
        {value ? (
          <Pressable testID="energy-clear" accessibilityRole="button" accessibilityLabel={tr('log.energyClearLabel')} onPress={() => onChange(0)}
            style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center', backgroundColor: t.chipBg }}>
            <Text variant="bodySmall" color="textOnGlass">{tr('log.energyClear')}</Text>
          </Pressable>
        ) : <Text variant="caption" color="textSecondary" style={{ flexShrink: 1 }}>{tr('log.energyHint')}</Text>}
      </View>
      <View
        accessible accessibilityRole="adjustable" accessibilityLabel={tr('log.energy')}
        aria-valuemin={1} aria-valuemax={5} aria-valuetext={word} {...(value ? { 'aria-valuenow': value } : {})}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => { const next = stepEnergy(value, e.nativeEvent.actionName as 'increment' | 'decrement'); if (next !== value) onChange(next); }}>
        <View style={{ flexDirection: 'row' }}>
          <View pointerEvents="none" style={{ position: 'absolute', top: 16, left: 0, right: 0, height: 12, borderRadius: 6, backgroundColor: t.chipBg, borderWidth: 1, borderColor: t.hairline }} />
          {value ? <View pointerEvents="none" style={{ position: 'absolute', top: 16, left: 0, width: `${((value - 0.5) / 5) * 100}%`, height: 12, borderRadius: 6, backgroundColor: `${t.c.accent}8C` }} /> : null}
          {LEVELS.map((n) => (
            <Pressable key={n} testID={`energy-${n}`} accessible={false} importantForAccessibility="no-hide-descendants" onPress={() => onChange(n)} style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              {n === value
                ? <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.c.surface, borderWidth: 2, borderColor: t.c.accent, boxShadow: '0 3px 8px rgba(31,26,28,0.22)' }} />
                : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: n < value ? t.c.surface : t.c.border }} />}
            </Pressable>
          ))}
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row' }}>
          {LEVELS.map((n) => <Text key={n} variant="caption" color={n === value ? 'onAccentSoft' : 'textSecondary'} style={{ flex: 1, textAlign: 'center', fontWeight: n === value ? '700' : '400' }}>{tr(`log.energyLevels.${n}`)}</Text>)}
        </View>
      </View>
    </View>
  );
}
