// Five-step energy slider (D-123): tap a step or slide across them to log it, "Clear" removes the value. Unset shows no thumb.
import { useEffect, useRef, useState } from 'react';
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

/** The step under a horizontal position on a track that starts at `left` and is `width` wide; clamped to 1 to 5. */
export function energyAt(x: number, left: number, width: number): 1 | 2 | 3 | 4 | 5 {
  if (width <= 0) return 1;
  return Math.min(5, Math.max(1, Math.floor(((x - left) / width) * 5) + 1)) as 1 | 2 | 3 | 4 | 5;
}

const DRAG_SLOP = 8; // below this a touch is a tap, which the step buttons handle

export function EnergySlider({ value: committed, onChange }: { value: EnergyLevel; onChange: (v: EnergyLevel) => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  // while a finger slides, the thumb follows it and one write happens on release (every step crossed would append an event)
  const [preview, setPreview] = useState<EnergyLevel | null>(null);
  const value = preview ?? committed;
  const track = useRef<View>(null);
  const box = useRef({ left: 0, width: 0 });
  const startX = useRef(0);
  const previewRef = useRef<EnergyLevel | null>(null);
  const show = (v: EnergyLevel | null) => { previewRef.current = v; setPreview(v); };
  // a committed release keeps the thumb where the finger left it until the saved value arrives, so it does not jump back for a moment
  // biome-ignore lint/correctness/useExhaustiveDependencies: the reset runs when the saved value arrives, not when `show` is recreated
  useEffect(() => show(null), [committed]);
  const finish = (commit: boolean) => {
    const v = previewRef.current;
    if (commit && v !== null && v !== committed) onChange(v);
    else show(null);
  };
  const drag = {
    onStartShouldSetResponderCapture: (e: { nativeEvent: { pageX: number } }) => { startX.current = e.nativeEvent.pageX; return false; },
    onMoveShouldSetResponderCapture: (e: { nativeEvent: { pageX: number } }) => Math.abs(e.nativeEvent.pageX - startX.current) > DRAG_SLOP,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: { nativeEvent: { pageX: number } }) => {
      const x = e.nativeEvent.pageX;
      track.current?.measureInWindow((left, _y, width) => { box.current = { left, width }; show(energyAt(x, left, width)); });
    },
    onResponderMove: (e: { nativeEvent: { pageX: number } }) => show(energyAt(e.nativeEvent.pageX, box.current.left, box.current.width)),
    onResponderRelease: () => finish(true),
    onResponderTerminate: () => finish(false),
  };
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
        <View ref={track} testID="energy-track" {...drag} style={{ flexDirection: 'row' }}>
          <View pointerEvents="none" style={{ position: 'absolute', top: 16, left: 0, right: 0, height: 12, borderRadius: 6, backgroundColor: t.chipBg, borderWidth: 1, borderColor: t.hairline }} />
          {value ? <View pointerEvents="none" style={{ position: 'absolute', top: 16, left: 0, width: `${((value - 0.5) / 5) * 100}%`, height: 12, borderRadius: 6, backgroundColor: `${t.c.accent}8C` }} /> : null}
          {LEVELS.map((n) => (
            <Pressable key={n} testID={`energy-${n}`} accessibilityLabel={tr(`log.energyLevels.${n}`)} accessible={false} importantForAccessibility="no-hide-descendants" onPress={() => onChange(n)} style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}>
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
