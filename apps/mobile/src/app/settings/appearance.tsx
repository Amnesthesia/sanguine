import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ThemePref } from '@/data/prefs';
import { useApp } from '@/state/app';
import { buildTheme, useTheme, type Theme } from '@/theme';
import { Card } from '@/ui/Card';
import { Group, SwitchRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

/** A small drawing of the app in one theme: a title bar, two rows and a period-coloured dot. `half`: one of the two halves of the system option. */
function Mini({ th, half }: { th: Theme; half: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: th.c.bg, paddingVertical: 12, paddingHorizontal: half ? 6 : 8, gap: 6 }}>
      <View style={{ height: 6, width: half ? 24 : 30, borderRadius: 3, backgroundColor: th.c.textPrimary }} />
      <View style={{ height: 14, borderRadius: 7, backgroundColor: th.c.surface2 }} />
      <View style={{ height: 14, borderRadius: 7, backgroundColor: th.c.surface2 }} />
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: th.c.period }} />
    </View>
  );
}

/** The theme as a radio group; each option is a small picture of the app in that theme (the system option shows both halves). */
function ThemePicker({ value, onChange }: { value: ThemePref; onChange: (v: ThemePref) => void }) {
  const { t: tr } = useTranslation();
  const t = useTheme();
  const light = buildTheme('light', 'ios');
  const dark = buildTheme('dark', 'ios');
  const opts: Array<{ value: ThemePref; label: string; pic: Theme[] }> = [
    { value: 'system', label: tr('settings.appearance.themeSystem'), pic: [light, dark] },
    { value: 'light', label: tr('settings.appearance.themeLight'), pic: [light] },
    { value: 'dark', label: tr('settings.appearance.themeDark'), pic: [dark] },
  ];
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
      {opts.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} testID={`theme-${o.value}`} accessibilityRole="radio" accessibilityLabel={o.label} aria-checked={on} accessibilityState={{ selected: on, checked: on }} onPress={() => onChange(o.value)} style={{ flex: 1, minHeight: 112, alignItems: 'center', gap: 8 }}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 74, height: 112, borderRadius: 18, overflow: 'hidden', flexDirection: 'row', borderWidth: on ? 2 : 1, borderColor: on ? t.c.accent : t.hairline }}>
              {o.pic.map((p) => <Mini key={p.scheme} th={p} half={o.pic.length > 1} />)}
            </View>
            <Text variant="bodySmall" style={{ fontWeight: on ? '600' : '400' }}>{o.label}</Text>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.c.accent : 'transparent', borderWidth: on ? 0 : 1.5, borderColor: t.c.textSecondary }}>
              {on ? <Svg width={12} height={12} viewBox="0 0 12 12"><Path d="M2 6.3L4.8 9L10 3" fill="none" stroke={t.scheme === 'dark' ? t.c.bg : t.c.surface} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" /></Svg> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Three days as the calendar draws them with the cycle-day number above each date: two logged period days (the second is today, with the calendar's two-point ring) and one predicted. */
function CycleDayPreview() {
  const { t: tr } = useTranslation();
  const t = useTheme();
  const onPeriod = t.scheme === 'dark' ? t.c.bg : t.c.surface;
  const days = [{ d: 1, n: 2, logged: true, today: false }, { d: 2, n: 3, logged: true, today: true }, { d: 3, n: 4, logged: false, today: false }];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={tr('settings.appearance.cycleDayPreview')} style={{ margin: 16, marginTop: 0, borderRadius: 16, backgroundColor: t.c.bg, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-around' }}>
      {days.map((x) => (
        <View key={x.d} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignItems: 'center', gap: 2 }}>
          <Text variant="caption" color="textSecondary" style={{ fontSize: 10, lineHeight: 13, fontWeight: x.logged ? '600' : '400' }}>{x.n}</Text>
          <View testID={`preview-day-${x.d}`} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: x.logged ? t.c.period : 'transparent', borderWidth: x.logged ? 0 : 1.5, borderStyle: 'dashed', borderColor: t.c.period, ...(x.today ? { boxShadow: `0 0 0 2px ${t.c.bg}, 0 0 0 4px ${t.c.accent}` } : null) }}>
            <Text style={{ color: x.logged ? onPeriod : t.c.textPrimary, fontWeight: x.today ? '700' : '400' }}>{x.d}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function AppearanceScreen() {
  const { t } = useTranslation();
  const { prefs, updatePrefs } = useApp();
  return (
    <SubScreen testID="screen-appearance" title={t('settings.appearance.title')}>
      <Card style={{ gap: 14 }}>
        <Text variant="heading" accessibilityRole="header">{t('settings.appearance.theme')}</Text>
        <ThemePicker value={prefs.theme} onChange={(v) => void updatePrefs({ theme: v })} />
      </Card>
      <Group>
        <SwitchRow testID="appearance-cycle-day" title={t('settings.appearance.cycleDay')} description={t('settings.appearance.cycleDayDesc')} value={prefs.calendarCycleDay} onChange={(v) => void updatePrefs({ calendarCycleDay: v })} last />
        <CycleDayPreview />
      </Group>
      <Text variant="bodySmall" color="textSecondary">{t('settings.appearance.motionNote')}</Text>
    </SubScreen>
  );
}
