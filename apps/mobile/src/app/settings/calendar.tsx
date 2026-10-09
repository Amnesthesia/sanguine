// Add to someone's calendar (P8-2, roadmap R2-3, D-077 O-1, D-079): the predicted period range, and optionally the fertile range, as an
// .ics file sent through the share sheet. Discreet titles by default; no fertile option under 18 unless unlocked or with the estimate hidden.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { effectivePrefs } from '@/data/prefs';
import { buildIcs, calendarRanges } from '@/features/share/ics';
import { nextCalendarExport, shareCalendarFile } from '@/services/shareCalendar';
import { useApp } from '@/state/app';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Group, SwitchRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { formatRange } from '@/ui/format';

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
        <Card testID="calendar-export-preview">
          <Text>{t('settings.calendar.period', { range: formatRange(ranges.period.lo, ranges.period.hi) })}</Text>
          {ranges.fertile ? <Text>{t('settings.calendar.fertile', { range: formatRange(ranges.fertile.lo, ranges.fertile.hi) })}</Text> : null}
        </Card>
      ) : <Card testID="calendar-export-none"><Text>{t('settings.calendar.none')}</Text></Card>}
      <TextField testID="calendar-export-title" label={t('settings.calendar.eventTitle')} helper={t('settings.calendar.eventTitleHelp')} keyboardType="default" maxLength={40} value={title} onChangeText={setTitle} />
      {fertileAllowed ? (
        <>
          <Group>
            <SwitchRow testID="calendar-export-fertile" title={t('settings.calendar.includeFertile')} description={t('settings.calendar.includeFertileDesc')} value={fertile} onChange={setFertile} last />
          </Group>
          {fertile ? <TextField testID="calendar-export-fertile-title" label={t('settings.calendar.fertileTitle')} keyboardType="default" maxLength={40} value={fertileTitle} onChangeText={setFertileTitle} /> : null}
        </>
      ) : null}
      <Button testID="calendar-export-share" label={t('settings.calendar.share')} disabled={!ranges.period} onPress={() => void send()} />
      <Text variant="bodySmall" color="textSecondary">{t('settings.calendar.resend')}</Text>
      {msg ? <Text variant="bodySmall" accessibilityLiveRegion="polite">{msg}</Text> : null}
    </SubScreen>
  );
}
