import type { ISODate } from '@sanguine/engine';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
import { formatLong } from '@/ui/format';
import { Text } from '@/ui/Text';
import type { MonthRow } from './calendarModel';

/** The small mark in front of a row, drawn like the grid: solid for what she logged, dashed, glowing or banded for an estimate. */
function RowMark({ row, period }: { row: MonthRow; period: boolean }) {
  const t = useTheme();
  const base = { width: 8, height: 8, borderRadius: 4, marginTop: 6 } as const;
  if (row.kind === 'logged') return <View style={{ ...base, backgroundColor: period ? t.c.period : t.c.textSecondary }} />;
  if (row.kind === 'fertile') return <View style={{ width: 10, height: 6, borderRadius: 3, marginTop: 7, backgroundColor: t.c.fertile, opacity: 0.5 }} />;
  if (row.kind === 'ovulation') return <View style={{ ...base, backgroundColor: t.c.bg, boxShadow: `0 0 0 1px ${t.c.ovulation}4D, 0 0 5px 1px ${t.c.ovulation}73` }} />;
  return <View style={{ ...base, borderWidth: 1, borderStyle: 'dashed', borderColor: t.c.period }} />;
}

/** The month as a list of what was logged and what is estimated, day by day (P8-22, D-119). The heading names the month, so dates carry none.
 *  Each row is one button that selects its first day. */
export function MonthList({ title, rows, periodDays, selected, today, onSelect }: { title: string; rows: MonthRow[]; periodDays: Set<ISODate>; selected: ISODate; today: ISODate; onSelect: (d: ISODate) => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <View testID="month-list" style={{ gap: 0 }}>
      <Text variant="heading" accessibilityRole="header" style={{ marginBottom: 8 }}>{title}</Text>
      {rows.length === 0 ? <Text variant="bodySmall" color="textSecondary" testID="month-list-empty">{tr('calendar.list.empty')}</Text> : null}
      {rows.map((row, i) => {
        const isToday = row.kind === 'logged' && row.from === today;
        const on = selected >= row.from && selected <= row.to;
        const words = row.from === row.to ? formatLong(row.from) : tr('calendar.list.rowRange', { from: formatLong(row.from), to: formatLong(row.to) });
        return (
          <Pressable
            key={`${row.kind}-${row.from}-${row.to}`} testID={`month-row-${row.kind}-${row.from}`} accessibilityRole="button"
            accessibilityLabel={`${isToday ? `${words}, ${tr('calendar.a11y.today')}` : words}: ${row.text}`} aria-selected={on}
            onPress={() => onSelect(row.from)}
            style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, minHeight: 44, borderTopWidth: 1, borderBottomWidth: i === rows.length - 1 ? 1 : 0, borderColor: t.hairline, backgroundColor: on ? t.chipBg : 'transparent' }}>
            <View style={{ width: 56 }}>
              <Text variant="body" tabular style={{ fontWeight: isToday ? '700' : '600', color: isToday ? t.c.onAccentSoft : t.c.textPrimary }}>{row.label}</Text>
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
