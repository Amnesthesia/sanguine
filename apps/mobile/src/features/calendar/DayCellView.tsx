import { Pressable, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { useTheme } from '@/theme';
import { fertileAlpha } from '@/ui/fertileAlpha';
import { Text } from '@/ui/Text';
import { DropGlyph } from '@/features/logging/DropGlyph';
import { type DayCell, showCycleDay } from './calendarModel';
import { MoonGlyph } from './MoonGlyph';

/** The cycle day as a small badge (D-101). It inverts its cell: rose with a number in the page colour on a plain day, the page colour
 * with a period-red number on a period day. Every pairing is at least 4.5:1 in both themes; white on rose would be 3.6:1 in dark.
 * The badge text grows at most 1.2x with the system size; the cell's VoiceOver label always says the cycle day. */
export function CycleDayBadge({ day, inverted }: { day: number; inverted: boolean }) {
  const t = useTheme();
  return (
    <View style={{ minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: inverted ? t.c.bg : t.c.accent }}>
      <Text variant="caption" tabular maxFontSizeMultiplier={1.2} style={{ fontSize: 9, lineHeight: 12, fontWeight: '600', letterSpacing: 0, color: inverted ? t.c.period : t.c.bg }}>{day}</Text>
    </View>
  );
}

/** One day: the date, with its cycle-day badge in the corner. Meaning is never colour alone: period is solid with a drop (D-088; two dots read as a count), predicted is hatched, the fertile band is an underline (§8.9). */
export function DayCellView({ cell, selected, onPress, southern = false }: { cell: DayCell; selected: boolean; onPress: () => void; southern?: boolean }) {
  const t = useTheme();
  const r = t.isIOS ? 10 : 12;
  const on = cell.period;
  const { fontScale } = useWindowDimensions();
  // the drop or log dot sits under the date; an equal spacer above keeps the date centred, level with unmarked days.
  // At large text sizes the spacer would push the mark out of the 48 pt box, so the date and mark stack as before.
  const mark = on ? 9 : cell.logged ? 5 : 0;
  const markH = 20 * fontScale + 2 * mark <= 44 ? mark : 0;
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
        {/* at large text sizes the date centres in the space right of the cycle-day badge, which would otherwise cover it */}
        <View style={{ alignItems: 'center', paddingLeft: fontScale > 1.15 && showCycleDay(cell) ? 22 : 0 }}>
          {markH ? <View style={{ height: markH }} /> : null}
          <Text variant="bodySmall" tabular style={{ color: on ? '#FFFFFF' : t.c.textPrimary, fontWeight: cell.isToday ? '700' : '400' }}>{cell.day}</Text>
          {on ? (
            <DropGlyph fill={1} size={9} color="#FFFFFF" />
          ) : cell.logged ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: t.c.textSecondary, marginTop: 1 }} /> : null}
        </View>
        {cell.ovulation ? (
          <View style={{ position: 'absolute', bottom: 7, left: 0, right: 0, height: 2, backgroundColor: t.c.ovulation, opacity: cell.ovulation === 'point' ? 1 : 0.6 }}>
            {cell.ovulation === 'point' ? <View style={{ position: 'absolute', alignSelf: 'center', top: -2, width: 6, height: 6, borderRadius: 3, backgroundColor: t.c.ovulation }} /> : null}
          </View>
        ) : null}
        {showCycleDay(cell) ? <View style={{ position: 'absolute', top: 3, left: 3 }}><CycleDayBadge day={cell.cycleDay as number} inverted={on} /></View> : null}
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
