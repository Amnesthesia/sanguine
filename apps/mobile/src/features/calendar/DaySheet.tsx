import type { ISODate } from '@sanguine/engine';
import { type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { GlassSurface } from '@/ui/GlassBar';
import { GUTTER } from '@/ui/Screen';
import { LoggedChip } from '@/ui/LoggedChip';
import { formatLong, formatWeekday } from '@/ui/format';
import { Text } from '@/ui/Text';
import type { DayCell } from './calendarModel';
import { DayDisc } from './DayCellView';

/** closed: the glass day card above the tab bar; small: the open sheet; large: the full detail (estimate and food and movement sections). */
export type Detent = 'closed' | 'small' | 'large';

/** The detent a vertical drag of `dy` points ends in: up opens one step, down closes one step, a short drag stays. */
export function nextDetent(d: Detent, dy: number): Detent {
  if (dy < -40) return d === 'closed' ? 'small' : 'large';
  if (dy > 40) return d === 'large' ? 'small' : 'closed';
  return d;
}

export interface SheetEntry { id: string; label: string; mark: 'flow' | 'symptom' | 'other' }

export interface DaySheetProps {
  date: ISODate;
  today: ISODate;
  /** The grid cell of the day: the card's disc is drawn like it. */
  cell: DayCell | undefined;
  cycleDay: number | undefined;
  period: boolean;
  detent: Detent;
  onDetent: (d: Detent) => void;
  entries: SheetEntry[];
  onRemove: (id: string) => void;
  /** The marks of the day in words, each with its range and confidence (D-104). */
  estimates: string[];
  isFuture: boolean;
  onLog: () => void;
  onDetails: () => void;
  /** The large detent's sections (estimates, food and movement). */
  detail?: ReactNode;
}

const Plus = ({ color }: { color: string }) => <Svg width={16} height={16} viewBox="0 0 16 16"><Path d="M8 2V14M2 8H14" stroke={color} strokeWidth={2.2} strokeLinecap="round" /></Svg>;

/** A vertical drag on whatever it is spread onto moves the sheet one detent (iOS/Android: PanResponder, so a tap still presses). */
function useDrag(detent: Detent, onDetent: (d: Detent) => void) {
  return useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 10 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderRelease: (_e, g) => onDetent(nextDetent(detent, g.dy)),
  }).panHandlers, [detent, onDetent]);
}

/** The day sheet (P8-22, D-118). One filled control: the Log button. Chips are never filled; every control is fully rounded. Text on the glass is `textOnGlass`
 *  (the accent fails contrast on glass, 2.4:1). Place the closed and small detents above the tab bar and the large one over the screen. */
export function DaySheet(p: DaySheetProps) {
  const { t: tr } = useTranslation();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const drag = useDrag(p.detent, p.onDetent);
  const onGlass = { color: t.c.textOnGlass } as const;
  const title = formatLong(p.date);
  const subline = [p.date === p.today ? tr('calendar.today') : null, p.cycleDay ? tr('calendar.summaryDay', { day: p.cycleDay }) : null, p.period ? tr('calendar.list.period') : null].filter(Boolean).join(' · ');
  const onPrimary = t.scheme === 'dark' ? t.c.bg : t.c.surface;
  const empty = p.entries.length === 0;
  const circle = (label: string, glyph: string, onPress: () => void, testID: string) => (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: t.cardBg, borderWidth: 1, borderColor: t.hairline }}>
      <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ ...onGlass, fontSize: 15 }}>{glyph}</Text>
    </Pressable>
  );
  const chips = p.entries.length ? (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {p.entries.map((e) => <LoggedChip key={e.id} label={e.label} mark={e.mark} onRemove={() => p.onRemove(e.id)} />)}
    </View>
  ) : null;
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
  const actions = (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      {p.isFuture ? null : <Button testID="day-log" label={tr('calendar.edit')} accessibilityLabel={`${tr('calendar.edit')}: ${title}`} icon={<Plus color={onPrimary} />} onPress={p.onLog} style={{ flex: 1 }} />}
      <Button testID="day-details" kind="secondary" label={tr('calendar.details')} accessibilityLabel={`${tr('calendar.details')}: ${title}`} onPress={p.onDetails} style={{ minHeight: 52, ...(p.isFuture ? { flex: 1 } : null) }} />
    </View>
  );

  if (p.detent === 'closed') {
    // the card: everything left of Log is one button that opens the sheet (owner)
    const shown = p.estimates.slice(0, 2);
    const summary = [title, subline, ...p.entries.map((e) => e.label), ...(empty && !p.isFuture ? [tr('calendar.summaryNothing')] : []), ...shown, tr('calendar.sheet.open')].filter(Boolean).join('. ');
    return (
      <View {...drag} testID="day-card">
        <GlassSurface style={{ borderRadius: 28 }}>
          <View style={{ padding: 16, gap: 10 }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: `${t.c.textOnGlass}38`, marginTop: -6 }} />
            <Pressable testID="day-card-open" accessibilityRole="button" accessibilityLabel={summary} onPress={() => p.onDetent('small')} style={{ gap: 10, minHeight: 52, paddingRight: p.isFuture ? 0 : 64 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {p.cell ? <View style={{ width: 52, alignItems: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><DayDisc cell={p.cell} selected={false} size={46} /><Text style={{ ...onGlass, fontSize: 10, lineHeight: 13, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 4 }}>{formatWeekday(p.date).slice(0, 3)}</Text></View> : null}
                <View style={{ flex: 1 }}>
                  <Text variant="heading" accessibilityRole="header" style={onGlass}>{p.date === p.today ? `${tr('calendar.today')}, ${title}` : title}</Text>
                  {subline ? <Text variant="bodySmall" style={onGlass}>{subline}</Text> : null}
                </View>
              </View>
              {chips ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {p.entries.map((e) => <View key={e.id} style={{ borderRadius: 14, paddingHorizontal: 10, minHeight: 28, justifyContent: 'center', backgroundColor: t.cardBg, borderWidth: 1, borderColor: t.hairline }}><Text variant="caption" style={onGlass}>{e.label}</Text></View>)}
                </View>
              ) : nothing}
              {shown.length ? <View style={{ borderRadius: 16, backgroundColor: t.chipBg, padding: 10, gap: 6 }}>{lines(shown)}</View> : null}
              {futureNote}
            </Pressable>
            {p.isFuture ? null : (
              <Pressable testID="day-log" accessibilityRole="button" accessibilityLabel={`${tr('calendar.sheet.logRound')}: ${title}`} onPress={p.onLog} style={{ position: 'absolute', top: 16, right: 16, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: t.c.accent }}>
                <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" variant="heading" style={{ color: onPrimary, fontSize: 15 }}>{tr('calendar.sheet.logRound')}</Text>
              </Pressable>
            )}
          </View>
        </GlassSurface>
      </View>
    );
  }

  const header = (
    <View {...drag} style={{ gap: 8 }}>
      <Pressable testID="sheet-grabber" accessibilityRole="button" accessibilityLabel={tr(p.detent === 'small' ? 'calendar.sheet.showDetailsA11y' : 'calendar.sheet.hideDetailsA11y')} onPress={() => p.onDetent(p.detent === 'small' ? 'large' : 'small')} style={{ alignSelf: 'center', width: 60, height: 44, marginVertical: -12, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: p.detent === 'small' ? `${t.c.textOnGlass}38` : t.hairline }} />
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text variant="heading" accessibilityRole="header" style={p.detent === 'small' ? onGlass : undefined}>{title}</Text>
          {subline ? <Text variant="bodySmall" style={p.detent === 'small' ? onGlass : { color: t.c.textSecondary }}>{subline}</Text> : null}
        </View>
        {circle(tr('calendar.sheet.closeA11y'), '✕', () => p.onDetent(p.detent === 'small' ? 'closed' : 'small'), 'day-sheet-close')}
      </View>
    </View>
  );

  if (p.detent === 'small') {
    return (
      <GlassSurface testID="day-sheet" style={{ borderRadius: 34 }}>
        <View style={{ padding: 16, paddingTop: 8, gap: 12 }}>
          {header}
          {chips ?? nothing}
          {lines(p.estimates)}
          {futureNote}
          <Pressable testID="sheet-expand" accessibilityRole="button" accessibilityLabel={tr('calendar.sheet.showDetailsA11y')} onPress={() => p.onDetent('large')} style={{ alignSelf: 'center', minHeight: 44, paddingHorizontal: 16, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.cardBg, borderWidth: 1, borderColor: t.hairline }}>
            <Svg width={12} height={8} viewBox="0 0 12 8" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Path d="M1 7L6 2L11 7" fill="none" stroke={t.c.textOnGlass} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
            <Text variant="bodySmall" style={{ ...onGlass, fontWeight: '600' }}>{tr('calendar.sheet.showDetails')}</Text>
          </Pressable>
          {actions}
        </View>
      </GlassSurface>
    );
  }

  // large: opaque, over a scrim that fades the calendar (content stays opaque; glass is navigation only)
  return (
    <View testID="day-sheet-large" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Pressable testID="sheet-scrim" accessibilityRole="button" accessibilityLabel={tr('calendar.sheet.hideDetailsA11y')} onPress={() => p.onDetent('small')} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, minHeight: 44, backgroundColor: t.c.bg, opacity: 0.6 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: insets.top + 40, borderTopLeftRadius: t.radius.sheet, borderTopRightRadius: t.radius.sheet, backgroundColor: t.screenBg, overflow: 'hidden', boxShadow: '0 -4px 30px rgba(31,26,28,0.16)' }}>
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 8 }}>{header}</View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 16, gap: 16 }}>
          {chips ?? (p.isFuture ? <Text variant="caption" color="textSecondary" testID="cal-future-note">{tr('calendar.futureNote')}</Text> : <Text variant="bodySmall" color="textSecondary" testID="sheet-nothing">{tr('calendar.summaryNothing')}</Text>)}
          {p.detail}
        </ScrollView>
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: t.screenBg, borderTopWidth: 1, borderTopColor: t.hairline }}>{actions}</View>
      </View>
    </View>
  );
}
