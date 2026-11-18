import { Pressable, useWindowDimensions, View } from 'react-native';
import { useTheme } from '@/theme';
import { fertileAlpha } from '@/ui/fertileAlpha';
import { Text } from '@/ui/Text';
import { type DayCell, showCycleDay } from './calendarModel';
import { MoonGlyph } from './MoonGlyph';

const DISC = 36;
/** Opacity of the fertile band's fill for p(d): 0.21 at the 0.1 floor to 0.50 at 1. */
export const bandOpacity = (p: number): number => 0.1 + 0.4 * fertileAlpha(p);

/** The day as a circle (P8-22, D-118). One rule: solid means logged, dashed or soft means estimate. Used by the grid cell and the day card's disc.
 *  Period: filled period red. Period estimate: dashed period-red ring, 1.5 pt; its 95% edge a thinner 1 pt one (P8-23: the old `periodPredicted`
 *  edge ring reached about 2:1 on the page and read as no circle; period red keeps every ring above 3:1). Ovulation point: a disc in the page colour with a soft blue glow.
 *  Today: a 2 pt accent ring outside the disc. Selected: accentSoft fill (a ring on a filled disc). */
export function DayDisc({ cell, selected, size = DISC, text }: { cell: DayCell; selected: boolean; size?: number; text?: string }) {
  const t = useTheme();
  const dark = t.scheme === 'dark';
  const onPeriod = dark ? t.c.bg : t.c.surface; // white on the light red, near-black on the lighter dark-theme red (both >= 4.5:1)
  const filled = cell.period;
  const point = cell.ovulation === 'point' && !filled;
  const rings: string[] = [];
  if (cell.isToday) rings.push(`0 0 0 2px ${t.c.bg}`, `0 0 0 4px ${t.c.accent}`);
  else if (selected && (filled || point)) rings.push(`0 0 0 2px ${t.c.bg}`, `0 0 0 3.5px ${t.c.textPrimary}`);
  if (point) rings.push(`0 0 0 1.5px ${t.c.ovulation}47`, `0 0 12px 3px ${t.c.ovulation}6B`);
  const estimate = !filled && cell.periodEstimate !== undefined;
  const color = filled ? onPeriod : point ? t.c.ovulation : t.c.textPrimary;
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: filled ? t.c.period : point ? t.c.bg : selected ? t.c.accentSoft : estimate ? t.c.bg : 'transparent',
        ...(estimate ? { borderWidth: cell.periodEstimate === 'core' ? 1.5 : 1, borderStyle: 'dashed', borderColor: t.c.period } : null),
        ...(rings.length ? { boxShadow: rings.join(', ') } : null),
      }}>
      <Text variant="bodySmall" tabular maxFontSizeMultiplier={1.3} style={{ color, fontSize: size > DISC ? 17 : 15, lineHeight: size > DISC ? 22 : 20, fontWeight: cell.isToday ? '700' : point ? '600' : '400' }}>{text ?? cell.day}</Text>
    </View>
  );
}

/** One day of the grid (P8-22, D-118): the cycle day as a small number above a 36 pt circle, with one row of small marks below it.
 *  Meaning is never colour alone: period is filled, estimates are dashed, ovulation is a glowing disc, the fertile window is a band with a solid lower edge (§8.9).
 *  `bandStart` / `bandEnd` round the fertile band where it begins or ends (also at the week's edges). */
export function DayCellView({ cell, selected, onPress, southern = false, cycleDays = true, bandStart = true, bandEnd = true }: { cell: DayCell; selected: boolean; onPress: () => void; southern?: boolean; cycleDays?: boolean; bandStart?: boolean; bandEnd?: boolean }) {
  const t = useTheme();
  const { fontScale } = useWindowDimensions();
  const number = cycleDays && showCycleDay(cell);
  const r = DISC / 2 + 1;
  return (
    <Pressable
      testID={`day-${cell.date}`} accessibilityRole="button" accessibilityLabel={cell.label} aria-selected={selected} onPress={onPress}
      style={{ width: `${100 / 7}%`, minHeight: 56, paddingVertical: 2, alignItems: 'center', opacity: cell.inMonth ? 1 : 0.4 }}>
      {/* textSecondary reaches 4.5:1 on the page in both themes; past days and today read semibold, future ones regular */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 13, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
        {number ? <Text testID={`cycle-day-${cell.date}`} variant="caption" tabular maxFontSizeMultiplier={1.2} style={{ fontSize: 10, lineHeight: 13, letterSpacing: 0, fontWeight: cell.cycleDayPast ? '600' : '400', color: t.c.textSecondary }}>{cell.cycleDay}</Text> : null}
        {cell.moon && cell.inMonth ? <View style={{ position: 'absolute', top: 2, right: 4 }}><MoonGlyph phase={cell.moon} southern={southern} size={9} color={t.c.textSecondary} /></View> : null}
      </View>
      <View style={{ alignSelf: 'stretch', height: DISC + 2, alignItems: 'center', justifyContent: 'center' }}>
        {cell.fertile !== undefined ? (
          // the faded fill carries p(d), 0.21-0.50 as the frame's 0.16-0.40 band at the probabilities the engine gives (P8-23: 0.11-0.40 was too
          // faint on a device); the solid 1.5 pt lower edge keeps every fertile day at 3:1 against the page (§8.9, D-093)
          <View testID={`fertile-${cell.date}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden', borderTopLeftRadius: bandStart ? r : 0, borderBottomLeftRadius: bandStart ? r : 0, borderTopRightRadius: bandEnd ? r : 0, borderBottomRightRadius: bandEnd ? r : 0 }}>
            <View style={{ flex: 1, backgroundColor: t.c.fertile, opacity: bandOpacity(cell.fertile) }} />
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1.5, backgroundColor: t.c.fertile }} />
          </View>
        ) : null}
        <DayDisc cell={cell} selected={selected} />
      </View>
      {/* marks row: an accent dot for symptoms, a grey dot for anything else logged, a short dotted blue line on the other days of the ovulation range */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 6, marginTop: fontScale > 1.3 ? 2 : 1, flexDirection: 'row', gap: 3, alignItems: 'center', justifyContent: 'center' }}>
        {cell.ovulation === 'range' ? <View style={{ width: 14, height: 0, borderTopWidth: 2, borderStyle: 'dotted', borderColor: t.c.ovulation }} /> : null}
        {cell.symptoms ? <View testID={`dot-symptom-${cell.date}`} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.c.accent }} /> : cell.logged ? <View testID={`dot-logged-${cell.date}`} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.c.textSecondary }} /> : null}
      </View>
    </Pressable>
  );
}
