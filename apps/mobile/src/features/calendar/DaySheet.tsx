import type { ISODate } from '@sanguine/engine';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import type { DayEvent } from '@/features/logging/actions';
import { describeEvent } from '@/features/logging/describe';
import { LoggedEntries } from '@/features/logging/LoggedEntries';
import { useApp } from '@/state/app';
import { useChromeBottom } from '@/ui/GlassBar';
import { GUTTER } from '@/ui/Screen';
import { formatLong } from '@/ui/format';
import { Text } from '@/ui/Text';
import type { DayCell } from './calendarModel';
import { DayDisc } from './DayCellView';
import { SheetMotion } from './SheetMotion';
import { type Detent, nextDetent } from './sheetSnap';

export type { Detent } from './sheetSnap';

/** Space the open sheet leaves under itself (the gap above the tab bar plus a breath) and the least it ever offers. */
const SHEET_GAP = 20;
const SHEET_MIN_HEIGHT = 240;
/** The tallest the small detent may be: the window below the toolbar and above the tab bar. At 150% text the toolbar is taller, so the bound
 *  follows its measured bottom edge (`chromeBottom`) instead of a fixed number, and the sheet's own list scrolls inside what is left. */
export function sheetMaxHeight(windowHeight: number, chromeBottom: number, bottomInset: number): number {
  return Math.max(SHEET_MIN_HEIGHT, windowHeight - chromeBottom - bottomInset - SHEET_GAP);
}

export interface DaySheetProps {
  date: ISODate;
  today: ISODate;
  /** The grid cell of the day: the bar's disc is drawn like it. */
  cell: DayCell | undefined;
  /** Undefined while estimates are paused: no "Day N" then. */
  cycleDay: number | undefined;
  /** The life state that pauses estimates ("Pregnant"), named where the cycle day would be (calendar spec part 2, fix plan C5). */
  paused?: string | undefined;
  period: boolean;
  detent: Detent;
  onDetent: (d: Detent) => void;
  /** Height of the settled bar or small sheet, so the screen pads its content clear of it. */
  onInset: (h: number) => void;
  /** The day's visible entries (visibleEntries): chips with a remove button, wired by the shared LoggedEntries. */
  entries: DayEvent[];
  /** Runs after a removal and after its Undo, so the screen reloads. */
  onChanged: () => void | Promise<void>;
  /** The marks of the day in words, each with its range and confidence (D-104). */
  estimates: string[];
  isFuture: boolean;
  onLog: () => void;
  /** Opens the full day screen (the large detent's Open day). */
  onDetails: () => void;
  /** The large detent's sections (estimates, food and movement), built only once the sheet shows them. */
  detail?: () => ReactNode;
}

/** Three dots: "More" (not a chevron, which reads as a popover that is already open). */
const Dots = ({ color }: { color: string }) => <Svg width={16} height={16} viewBox="0 0 16 16"><Circle cx={3} cy={8} r={1.7} fill={color} /><Circle cx={8} cy={8} r={1.7} fill={color} /><Circle cx={13} cy={8} r={1.7} fill={color} /></Svg>;

const Plus = ({ color, size = 16 }: { color: string; size?: number }) => <Svg width={size} height={size} viewBox="0 0 16 16"><Path d="M8 2.5V13.5M2.5 8H13.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" /></Svg>;

/** The day sheet (P8-22, D-118; P8-23): a compact bar, the open sheet and the full detail, moved by a drag on its bar or header (SheetMotion)
 *  or by its buttons. One filled control: the Log button. Text on the glass is `textOnGlass` (the accent fails contrast on glass, 2.4:1). */
export function DaySheet(p: DaySheetProps) {
  const { t: tr } = useTranslation();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { prefs } = useApp();
  const { height: windowH } = useWindowDimensions();
  const chromeBottom = useChromeBottom((c) => c.bottom);
  const [headH, setHeadH] = useState(0);
  const [footH, setFootH] = useState(0);
  // Android: the screen ends at the tab bar, so the window's navigation-bar inset is not under the sheet (floatEdges, D-159)
  const maxH = sheetMaxHeight(windowH, chromeBottom, t.isIOS ? insets.bottom : 0);
  // the small detent's list scrolls inside what is left once the pinned header and actions (their measured heights) and the paddings and gaps are taken off
  const scrollMax = Math.max(96, maxH - headH - footH - 8 - 16 - 12 * 2);
  const onGlass = { color: t.c.textOnGlass } as const;
  const title = formatLong(p.date);
  const subline = [p.date === p.today ? tr('calendar.today') : null, p.paused ?? (p.cycleDay ? tr('calendar.summaryDay', { day: p.cycleDay }) : null), p.period ? tr('calendar.list.period') : null].filter(Boolean).join(' · ');
  // the bar's one line, as the frame's day card: "Day 3 of your cycle · Period"; while paused, the state instead of the cycle day
  const barLine = [p.paused ?? (p.cycleDay ? tr('day.subline.cycleDay', { day: p.cycleDay }) : null), p.period ? tr('calendar.list.period') : null].filter(Boolean).join(' · ');
  const empty = p.entries.length === 0;
  const chips = empty ? null : <LoggedEntries entries={p.entries} onChanged={p.onChanged} />;
  const futureNote = p.isFuture ? <Text variant="caption" testID="cal-future-note" style={onGlass}>{tr('calendar.futureNote')}</Text> : null;
  const nothing = !p.isFuture && empty ? <Text variant="bodySmall" style={onGlass} testID="sheet-nothing">{tr('calendar.summaryNothing')}</Text> : null;
  const tag = (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ borderRadius: 9, borderWidth: 1, borderColor: `${t.c.ovulation}73`, paddingHorizontal: 7 }}>
      <Text style={{ ...onGlass, fontSize: 11, lineHeight: 17, fontWeight: '600', letterSpacing: 0.3 }}>{tr('contentKit.estimate')}</Text>
    </View>
  );
  const lines = (list: string[]) => list.map((l) => (
    <View key={l} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      {tag}
      <Text variant="bodySmall" testID="sheet-estimate" style={{ ...onGlass, flex: 1 }}>{l}</Text>
    </View>
  ));
  const log = p.isFuture ? null : <Button testID="day-log" label={tr('calendar.edit')} accessibilityLabel={`${tr('calendar.edit')}: ${title}`} icon={<Plus color={t.c.onAccent} />} onPress={p.onLog} style={{ flex: 2 }} />;
  const grabber = (color: string) => <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: color }} />;

  const header = (large: boolean) => (
    <View style={{ gap: 8 }}>
      <Pressable testID="sheet-grabber" accessibilityRole="button" accessibilityLabel={tr(large ? 'calendar.sheet.hideDetailsA11y' : 'calendar.sheet.showDetailsA11y')} onPress={() => p.onDetent(nextDetent(large ? 'large' : 'small', large ? -1 : 1))} style={{ alignSelf: 'center', width: 60, height: 44, marginVertical: -12, alignItems: 'center', justifyContent: 'center' }}>
        {grabber(large ? t.hairline : `${t.c.textOnGlass}38`)}
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text variant="heading" accessibilityRole="header" style={large ? undefined : onGlass}>{title}</Text>
          {subline ? <Text variant="bodySmall" style={large ? { color: t.c.textSecondary } : onGlass}>{subline}</Text> : null}
        </View>
        <Pressable testID="day-sheet-close" accessibilityRole="button" accessibilityLabel={tr(large ? 'calendar.sheet.hideDetailsA11y' : 'calendar.sheet.closeA11y')} onPress={() => p.onDetent(nextDetent(large ? 'large' : 'small', -1))} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: t.cardBg, borderWidth: 1, borderColor: t.hairline }}>
          <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ color: large ? t.c.textPrimary : t.c.textOnGlass, fontSize: 15 }}>✕</Text>
        </Pressable>
      </View>
    </View>
  );

  const bar = () => {
    const labels = p.entries.map((e) => describeEvent(e, tr, prefs.tempUnit));
    const heading = p.date === p.today ? `${tr('calendar.today')}, ${title}` : title;
    const summary = [heading, barLine, ...labels, ...(empty && !p.isFuture ? [tr('calendar.summaryNothing')] : []), ...p.estimates.slice(0, 2), tr('calendar.sheet.open')].filter(Boolean).join('. ');
    return { grip: (
      <View testID="day-card" style={{ paddingLeft: 12, paddingRight: 10, paddingTop: 6, paddingBottom: 10, gap: 4 }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignItems: 'center' }}>{grabber(`${t.c.textOnGlass}38`)}</View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* the date circle and the line are one button that opens the sheet; its label carries the whole day, so a screen reader loses nothing the old card said */}
          <Pressable testID="day-card-open" accessibilityRole="button" accessibilityLabel={summary} onPress={() => p.onDetent('small')} style={{ flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* drawn exactly like its grid cell, which is always the selected one (fix plan C12) */}
            {p.cell ? <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><DayDisc cell={p.cell} selected size={44} testID="bar-disc" /></View> : null}
            <Text variant="bodySmall" style={{ ...onGlass, flex: 1, fontWeight: '600' }}>{barLine || title}</Text>
          </Pressable>
          {p.isFuture ? null : (
            <Pressable testID="day-log" accessibilityRole="button" accessibilityLabel={`${tr('calendar.sheet.logRound')}: ${title}`} onPress={p.onLog} style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: t.c.accentFill }}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Plus color={t.c.onAccent} size={20} /></View>
            </Pressable>
          )}
        </View>
      </View>
    ) };
  };

  // the open sheet: the header drags; the list scrolls; the footer is one row: More (a third) then Log this day (two thirds). The full sheet keeps the same row with Open day in the first place, so Log this day stays where it is.
  const small = () => ({
    root: { testID: 'day-sheet', style: { padding: 16, paddingTop: 8, gap: 12 } } as const,
    grip: <View onLayout={(e) => setHeadH(e.nativeEvent.layout.height)}>{header(false)}</View>,
    body: (
      <>
        {/* the entries and estimate lines scroll; the header above and the actions below stay put (a tall list or 150% text never pushes the title off screen) */}
        <ScrollView testID="sheet-scroll" style={{ maxHeight: scrollMax }} contentContainerStyle={{ gap: 12 }}>
          {chips ?? nothing}
          {lines(p.estimates)}
          {futureNote}
        </ScrollView>
        <View onLayout={(e) => setFootH(e.nativeEvent.layout.height)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable testID="sheet-expand" accessibilityRole="button" accessibilityLabel={tr('calendar.sheet.showDetailsA11y')} onPress={() => p.onDetent('large')} style={{ flex: 1, minHeight: 52, paddingHorizontal: 12, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: t.cardBg, borderWidth: 1, borderColor: t.hairline }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Dots color={t.c.textOnGlass} /></View>
            <Text variant="bodySmall" style={{ ...onGlass, fontWeight: '600' }}>{tr('calendar.sheet.showDetails')}</Text>
          </Pressable>
          {log}
        </View>
      </>
    ),
  });

  // large: opaque (SheetMotion fades the glass to the page colour), over a scrim; content stays opaque, glass is navigation only
  const large = (height: number) => ({
    root: { testID: 'day-sheet-large', accessibilityViewIsModal: true, 'aria-modal': true, style: { height } } as const,
    grip: <View style={{ paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 8 }}>{header(true)}</View>,
    body: (
      <>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 16, gap: 16 }}>
          {chips ?? (p.isFuture ? <Text variant="caption" color="textSecondary" testID="cal-future-note">{tr('calendar.futureNote')}</Text> : <Text variant="bodySmall" color="textSecondary" testID="sheet-nothing">{tr('calendar.summaryNothing')}</Text>)}
          {p.detail?.()}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: GUTTER, paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.hairline }}>
          <Button testID="day-open" kind="secondary" label={tr('calendar.sheet.openDay')} accessibilityLabel={`${tr('calendar.sheet.openDayA11y')}: ${title}`} onPress={p.onDetails} style={{ minHeight: 52, flex: 1 }} />
          {log}
        </View>
      </>
    ),
  });

  return (
    <SheetMotion
      detent={p.detent} onDetent={p.onDetent} maxSmall={maxH} onInset={p.onInset}
      scrim={<Pressable testID="sheet-scrim" accessibilityRole="button" accessibilityLabel={tr('calendar.sheet.hideDetailsA11y')} onPress={() => p.onDetent('small')} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, minHeight: 44 }} />}>
      {(shown, largeH) => (shown === 'closed' ? bar() : shown === 'small' ? small() : large(largeH))}
    </SheetMotion>
  );
}
