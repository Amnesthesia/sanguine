// Add to someone's calendar (P8-2, roadmap R2-3, D-077 O-1, D-079): the predicted period range, and optionally the fertile range, as an
// .ics file sent through the share sheet. Discreet titles by default; no fertile option under 18 unless unlocked or with the estimate hidden.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { effectivePrefs } from '@/data/prefs';
import { buildIcs, calendarRanges } from '@/features/share/ics';
import { nextCalendarExport, shareCalendarFile } from '@/services/shareCalendar';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CautionPanel } from '@/ui/CautionPanel';
import { EstimateTag } from '@/ui/EstimateTag';
import { Group, SwitchRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { formatRange } from '@/ui/format';

/** One line of the preview: a small picture of the range (a dashed ring for the period, a soft band for the fertile window, never one day), its words and the estimate tag. */
function RangeLine({ kind, text }: { kind: 'period' | 'fertile'; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={kind === 'period' ? { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.c.period } : { width: 18, height: 10, borderRadius: 5, marginLeft: -2, backgroundColor: t.c.fertile, opacity: 0.45 }} />
      <Text style={{ flex: 1 }}>{text}</Text>
      <EstimateTag />
    </View>
  );
}

export default function CalendarExportScreen() {
  const { t } = useTranslation();
  const { db, prefs, profile, prediction, today } = useApp();
  const fertileAllowed = effectivePrefs(prefs, profile, today).showOvulationEstimate;
  const [fertile, setFertile] = useState(false);
  const [title, setTitle] = useState('S');
  const [fertileTitle, setFertileTitle] = useState('F');
  const [msg, setMsg] = useState<string>();
  const ranges = prediction ? calendarRanges(prediction, { fertile: fertile && fertileAllowed }) : {};
  async function send() {
    if (!db || !ranges.period) return;
    try {
      const { installId, sequence } = await nextCalendarExport(db);
      await shareCalendarFile(buildIcs({ period: ranges.period, ...(ranges.fertile ? { fertile: ranges.fertile } : {}), title: title.trim() || 'S', fertileTitle: fertileTitle.trim() || 'F', installId, sequence, now: new Date().toISOString() }));
      setMsg(undefined);
    } catch (e) { setMsg(`${t('settings.calendar.failed')} ${(e as Error).message}`); }
  }
  return (
    <SubScreen testID="screen-calendar-export" title={t('settings.calendar.title')}>
      <Card><Text>{t('settings.calendar.intro')}</Text></Card>
      {ranges.period ? (
        <Card testID="calendar-export-preview" style={{ gap: 10 }}>
          <RangeLine kind="period" text={t('settings.calendar.period', { range: formatRange(ranges.period.lo, ranges.period.hi) })} />
          {ranges.fertile ? <RangeLine kind="fertile" text={t('settings.calendar.fertile', { range: formatRange(ranges.fertile.lo, ranges.fertile.hi) })} /> : null}
        </Card>
      ) : <View testID="calendar-export-none"><CautionPanel>{t('settings.calendar.none')}</CautionPanel></View>}
      <TextField testID="calendar-export-title" label={t('settings.calendar.eventTitle')} helper={t('settings.calendar.eventTitleHelp')} keyboardType="default" maxLength={40} value={title} onChangeText={setTitle} />
      {fertileAllowed ? (
        <>
          <Group>
            <SwitchRow testID="calendar-export-fertile" title={t('settings.calendar.includeFertile')} description={t('settings.calendar.includeFertileDesc')} value={fertile} onChange={setFertile} last />
          </Group>
          {fertile ? <TextField testID="calendar-export-fertile-title" label={t('settings.calendar.fertileTitle')} keyboardType="default" maxLength={40} value={fertileTitle} onChangeText={setFertileTitle} /> : null}
        </>
      ) : null}
      {msg ? <View testID="calendar-export-message" accessibilityLiveRegion="polite"><CautionPanel>{msg}</CautionPanel></View> : null}
      <Button testID="calendar-export-share" label={t('settings.calendar.share')} disabled={!ranges.period} onPress={() => void send()} />
      <Text variant="bodySmall" color="textSecondary" style={{ marginHorizontal: 4 }}>{t('settings.calendar.resend')}</Text>
    </SubScreen>
  );
}
