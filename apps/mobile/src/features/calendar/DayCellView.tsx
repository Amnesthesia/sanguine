import { Pressable, View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { useTheme } from '@/theme';
import { fertileAlpha } from '@/ui/fertileAlpha';
import { Text } from '@/ui/Text';
import { DropGlyph } from '@/features/logging/DropGlyph';
import type { DayCell } from './calendarModel';
import { MoonGlyph } from './MoonGlyph';

/** One day. Meaning is never colour alone: period is solid with a drop (D-088; two dots read as a count), predicted is hatched, the fertile band is an underline (§8.9). */
export function DayCellView({ cell, selected, onPress, southern = false }: { cell: DayCell; selected: boolean; onPress: () => void; southern?: boolean }) {
  const t = useTheme();
  const r = t.isIOS ? 10 : 12;
  const on = cell.period;
  return (
    <Pressable
      testID={`day-${cell.date}`} accessibilityRole="button" accessibilityLabel={cell.label} aria-selected={selected} onPress={onPress}
      style={{ width: `${100 / 7}%`, height: 52, padding: 2, opacity: cell.inMonth ? 1 : 0.4 }}>
      <View style={{ flex: 1, borderRadius: r, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.c.period : selected ? t.c.accentSoft : 'transparent', borderWidth: cell.isToday ? 2 : selected ? 1.5 : cell.predicted95Edge ? 1 : 0, borderColor: cell.isToday ? t.c.accent : selected ? t.c.textSecondary : t.c.periodPredicted, borderStyle: cell.predicted95Edge && !cell.isToday && !selected ? 'dashed' : 'solid' }}>
        {cell.predicted80 ? (
          <Svg style={{ position: 'absolute' }} width="100%" height="100%">
            <Defs>
              <Pattern id="hatch" patternUnits="userSpaceOnUse" width={6} height={6}>
                <Line x1={0} y1={6} x2={6} y2={0} stroke={t.c.periodPredicted} strokeWidth={1.5} />
              </Pattern>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#hatch)" />
          </Svg>
        ) : null}
        <Text variant="bodySmall" tabular style={{ color: on ? '#FFFFFF' : t.c.textPrimary, fontWeight: cell.isToday ? '700' : '400' }}>{cell.day}</Text>
        {on ? (
          <DropGlyph fill={1} size={9} color="#FFFFFF" />
        ) : cell.logged ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: t.c.textSecondary, marginTop: 1 }} /> : null}
        {cell.ovulation ? (
          <View style={{ position: 'absolute', bottom: 7, left: 0, right: 0, height: 2, backgroundColor: t.c.ovulation, opacity: cell.ovulation === 'point' ? 1 : 0.6 }}>
            {cell.ovulation === 'point' ? <View style={{ position: 'absolute', alignSelf: 'center', top: -2, width: 6, height: 6, borderRadius: 3, backgroundColor: t.c.ovulation }} /> : null}
          </View>
        ) : null}
        {cell.moon ? <View style={{ position: 'absolute', top: 3, right: 3 }}><MoonGlyph phase={cell.moon} southern={southern} size={9} color={on ? '#FFFFFF' : t.c.textSecondary} /></View> : null}
        {/* the faded fill carries p(d); the solid 1.5 pt edge keeps every fertile day at 3:1 against the cell (§8.9, D-093) */}
        {cell.fertile !== undefined ? <View style={{ position: 'absolute', bottom: 0, left: 2, right: 2, height: 6, borderRadius: 3, overflow: 'hidden' }}>
          <View style={{ flex: 1, backgroundColor: t.c.fertile, opacity: fertileAlpha(cell.fertile) }} />
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1.5, backgroundColor: t.c.fertile }} />
        </View> : null}
      </View>
    </Pressable>
  );
}
