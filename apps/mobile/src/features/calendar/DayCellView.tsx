import { Pressable, useWindowDimensions, View } from 'react-native';
import { type Theme, useTheme } from '@/theme';
import { fertileAlpha } from '@/ui/fertileAlpha';
import { Text } from '@/ui/Text';
import { type DayCell, showCycleDay } from './calendarModel';
import { MoonGlyph } from './MoonGlyph';

const DISC = 36;
/** Opacity of the fertile band's fill for p(d): 0.21 at the 0.1 floor to 0.50 at 1. */
export const bandOpacity = (p: number): number => 0.1 + 0.4 * fertileAlpha(p);

/** Opacity of what a day outside the shown month draws for itself (its date, cycle day and logged marks); estimates keep full strength. */
const OUT_OF_MONTH = 0.4;

/** The ovulation estimate's soft disc: page fill, a faint ring and a blue glow. In dark the ring is the full ovulation blue on the card grey,
 *  so the mark reaches 3:1 on black (frame Calendar-Dark, fix plan C11); `glow` is the blur and spread of the halo. */
export function ovulationGlow(t: Theme, glow: string): { backgroundColor: string; shadows: string[] } {
  return t.scheme === 'dark'
    ? { backgroundColor: t.c.surface, shadows: [`0 0 0 1.5px ${t.c.ovulation}`, `0 0 ${glow} ${t.c.ovulation}6B`] }
    : { backgroundColor: t.c.bg, shadows: [`0 0 0 1.5px ${t.c.ovulation}47`, `0 0 ${glow} ${t.c.ovulation}6B`] };
}

/** The day as a circle (P8-22, D-118). One rule: solid means logged, dashed or dotted or soft means estimate. Used by the grid cell and the day bar's disc.
 *  Period: filled period red. Period estimate (the 80% range and the rest of a period in progress): a 2 pt dashed period-red ring; the 95% edge
 *  (and the unlikely end of a period in progress): a 1 pt dotted one (calendar spec part 2; P8-23: a `periodPredicted` ring read as no circle).
 *  Ovulation point: a soft disc with a blue glow. Today: a 2 pt accent ring outside the disc. Selected: accentSoft fill (a ring on a filled disc).
 *  `faded`: a day outside the month; its date and a logged fill fade, an estimate ring does not, so an 80% day never looks weaker than a 95% day. */
export function DayDisc({ cell, selected, size = DISC, text, faded = false, testID }: { cell: DayCell; selected: boolean; size?: number; text?: string; faded?: boolean; testID?: string }) {
  const t = useTheme();
  const filled = cell.period;
  const point = cell.ovulation === 'point' && !filled;
  const ov = point ? ovulationGlow(t, '12px 3px') : undefined;
  const rings: string[] = [];
  if (cell.isToday) rings.push(`0 0 0 2px ${t.c.bg}`, `0 0 0 4px ${t.c.accent}`);
  else if (selected && (filled || point)) rings.push(`0 0 0 2px ${t.c.bg}`, `0 0 0 3.5px ${t.c.textPrimary}`);
  if (ov) rings.push(...ov.shadows);
  const estimate = !filled && cell.periodEstimate !== undefined;
  // white on the light red, near-black on the lighter dark-theme red (both >= 4.5:1)
  const color = filled ? (t.scheme === 'dark' ? t.c.bg : t.c.surface) : point ? t.c.ovulation : t.c.textPrimary;
  return (
    <View
      testID={testID}
      style={{
        width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: filled ? t.c.period : ov ? ov.backgroundColor : selected ? t.c.accentSoft : estimate ? t.c.bg : 'transparent',
        ...(estimate ? (cell.periodEstimate === 'core' ? { borderWidth: 2, borderStyle: 'dashed' } : { borderWidth: 1, borderStyle: 'dotted' }) : null),
        ...(estimate ? { borderColor: t.c.period } : null),
        ...(rings.length ? { boxShadow: rings.join(', ') } : null),
        ...(faded && filled ? { opacity: OUT_OF_MONTH } : null),
      }}>
      <Text
        testID={testID ? `${testID}-text` : undefined} variant="bodySmall" tabular maxFontSizeMultiplier={1.3}
        style={{ color, fontSize: size > DISC ? 17 : 15, lineHeight: size > DISC ? 22 : 20, fontWeight: cell.isToday ? '700' : point ? '600' : '400', ...(faded && !filled ? { opacity: OUT_OF_MONTH } : null) }}>
        {text ?? cell.day}
      </Text>
    </View>
  );
}

/** The other days of the ovulation 80% range: four 2 pt dots in a 14 pt row. Drawn as dots because iOS draws a one-sided dotted border solid. */
function DottedLine({ color, testID }: { color: string; testID: string }) {
  return <View testID={testID} style={{ width: 14, flexDirection: 'row', justifyContent: 'space-between' }}>{[0, 1, 2, 3].map((k) => <View key={k} style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />)}</View>;
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
      style={{ width: `${100 / 7}%`, minHeight: 56, paddingVertical: 2, alignItems: 'center' }}>
      {/* textSecondary reaches 4.5:1 on the page in both themes; past days and today read semibold, future ones regular */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 13, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
        {number ? <Text testID={`cycle-day-${cell.date}`} variant="caption" tabular maxFontSizeMultiplier={1.2} style={{ fontSize: 10, lineHeight: 13, letterSpacing: 0, fontWeight: cell.cycleDayPast ? '600' : '400', color: t.c.textSecondary, ...(cell.inMonth ? null : { opacity: OUT_OF_MONTH }) }}>{cell.cycleDay}</Text> : null}
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
        <DayDisc cell={cell} selected={selected} faded={!cell.inMonth} testID={`disc-${cell.date}`} />
      </View>
      {/* marks row: an accent dot for symptoms, a grey dot for anything else logged (both logged, so they fade outside the month), a short dotted blue line on the other days of the ovulation range */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 6, marginTop: fontScale > 1.3 ? 2 : 1, flexDirection: 'row', gap: 3, alignItems: 'center', justifyContent: 'center' }}>
        {cell.ovulation === 'range' ? <DottedLine color={t.c.ovulation} testID={`ov-range-${cell.date}`} /> : null}
        {cell.symptoms || cell.logged ? (
          <View
            testID={`dot-${cell.symptoms ? 'symptom' : 'logged'}-${cell.date}`}
            style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: cell.symptoms ? t.c.accent : t.c.textSecondary, opacity: cell.inMonth ? 1 : OUT_OF_MONTH }} />
        ) : null}
      </View>
    </Pressable>
  );
}
