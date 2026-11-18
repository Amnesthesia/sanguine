import type { ISODate } from '@sanguine/engine';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { formatLong } from '@/ui/format';
import { Text } from '@/ui/Text';
import type { MonthRow } from './calendarModel';
import { ovulationGlow } from './DayCellView';

/** The small mark in front of a row, drawn like the grid: solid for what she logged, dashed, glowing or banded for an estimate. */
function RowMark({ row, period }: { row: MonthRow; period: boolean }) {
  const t = useTheme();
  const base = { width: 8, height: 8, borderRadius: 4, marginTop: 6 } as const;
  if (row.kind === 'logged') return <View style={{ ...base, backgroundColor: period ? t.c.period : t.c.textSecondary }} />;
  if (row.kind === 'fertile') return <View style={{ width: 10, height: 6, borderRadius: 3, marginTop: 7, backgroundColor: t.c.fertile, opacity: 0.5 }} />;
  if (row.kind === 'ovulation') { const ov = ovulationGlow(t, '5px 1px'); return <View style={{ ...base, backgroundColor: ov.backgroundColor, boxShadow: ov.shadows.join(', ') }} />; }
  return <View style={{ ...base, borderWidth: 1, borderStyle: 'dashed', borderColor: t.c.period }} />;
}

/** Text inside the screen gutter sits this far in from the rows' hairlines and the selected row's tint, so it never runs flush to an edge (P8-23). */
export const ROW_INSET = 8;
/** The frame's date column; the list widens it for its longest label, never per row (fix plan C7). */
const MIN_DATE_COLUMN = 48;

/** The month as a list of what was logged and what is estimated, day by day (P8-22, D-119). The heading names the month alone, so dates carry
 *  no month name except a range that runs into another month. Each row is one button that selects its first day. One date column width for
 *  the whole list, measured from its longest label, so the text column never jumps between rows; a label too wide for 40% of the row wraps. */
export function MonthList({ title, rows, periodDays, selected, today, onSelect }: { title: string; rows: MonthRow[]; periodDays: Set<ISODate>; selected: ISODate; today: ISODate; onSelect: (d: ISODate) => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const [widths, setWidths] = useState<Record<string, number>>({});
  const labels = [...new Set(rows.map((r) => r.label))];
  const column = Math.ceil(Math.max(MIN_DATE_COLUMN, ...labels.map((l) => widths[l] ?? 0), widths[''] ?? 0));
  const dateStyle = (isToday: boolean) => ({ fontWeight: isToday ? '700' : '600', color: isToday ? t.c.onAccentSoft : t.c.textPrimary }) as const;
  return (
    <View testID="month-list" style={{ gap: 0 }}>
      {/* the labels laid out unconstrained and invisible, once each, to size the column ('' is the Today caption) */}
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', top: 0, left: 0, opacity: 0, alignItems: 'flex-start' }}>
        {labels.map((l) => <Text key={l} variant="body" tabular style={dateStyle(true)} onLayout={(e) => { const w = e.nativeEvent.layout.width; setWidths((m) => (m[l] === w ? m : { ...m, [l]: w })); }}>{l}</Text>)}
        <Text variant="caption" style={{ fontWeight: '600' }} onLayout={(e) => { const w = e.nativeEvent.layout.width; setWidths((m) => (m[''] === w ? m : { ...m, '': w })); }}>{tr('calendar.today')}</Text>
      </View>
      <Text variant="heading" accessibilityRole="header" style={{ marginBottom: 8, paddingHorizontal: ROW_INSET }}>{title}</Text>
      {rows.length === 0 ? <Text variant="bodySmall" color="textSecondary" testID="month-list-empty" style={{ paddingHorizontal: ROW_INSET }}>{tr('calendar.list.empty')}</Text> : null}
      {rows.map((row, i) => {
        const isToday = row.kind === 'logged' && row.from === today;
        const on = selected >= row.from && selected <= row.to;
        const words = row.from === row.to ? formatLong(row.from) : tr('calendar.list.rowRange', { from: formatLong(row.from), to: formatLong(row.to) });
        return (
          <Pressable
            key={`${row.kind}-${row.from}-${row.to}`} testID={`month-row-${row.kind}-${row.from}`} accessibilityRole="button"
            accessibilityLabel={`${isToday ? `${words}, ${tr('calendar.a11y.today')}` : words}: ${row.text}`} aria-selected={on}
            onPress={() => onSelect(row.from)}
            style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, paddingHorizontal: ROW_INSET, minHeight: 44, borderTopWidth: 1, borderBottomWidth: i === rows.length - 1 ? 1 : 0, borderColor: t.hairline, backgroundColor: on ? t.chipBg : 'transparent' }}>
            <View testID={`month-date-${row.kind}-${row.from}`} style={{ width: column, maxWidth: '40%' }}>
              <Text variant="body" tabular style={dateStyle(isToday)}>{row.label}</Text>
              {isToday ? <Text variant="caption" style={{ fontWeight: '600', color: t.c.onAccentSoft }}>{tr('calendar.today')}</Text> : null}
            </View>
            <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><RowMark row={row} period={periodDays.has(row.from)} /></View>
              <Text variant="bodySmall" style={{ flex: 1 }} color={row.estimate ? 'textSecondary' : 'textPrimary'}>{row.text}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
