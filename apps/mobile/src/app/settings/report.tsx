// Report for a doctor (P8-6, roadmap R2-1, D-084): the user picks how many cycles and which sections; the PDF is made on the phone.
import { addDays, ENGINE_BUILD_HASH, ENGINE_VERSION } from '@sanguine/engine';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ageOn } from '@/data/age';
import { effectivePrefs } from '@/data/prefs';
import { CHOICE_OF } from '@/features/settings/lifeState';
import { buildReport, closedCycles, DEFAULT_REPORT, type ReportOptions } from '@/features/report/report';
import { shareReportPdf } from '@/services/report';
import { useApp } from '@/state/app';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CautionPanel } from '@/ui/CautionPanel';
import { Chips } from '@/ui/Chips';
import { Group, SwitchRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';
import { formatDayYear } from '@/ui/format';

const COUNTS = ['3', '6', '12', 'all'] as const;

export default function ReportScreen() {
  const { t } = useTranslation();
  const { history, prediction, prefs, profile, settings, today } = useApp();
  const { fertilityTools } = effectivePrefs(prefs, profile, today);
  const [o, setO] = useState<ReportOptions>(DEFAULT_REPORT);
  const [count, setCount] = useState<(typeof COUNTS)[number]>('6');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const set = (patch: Partial<ReportOptions>) => setO({ ...o, ...patch });
  const state = settings?.lifeStates.find((s) => s.kind !== 'none' && (s.until === undefined || s.until >= today));
  const age = profile.birthDate ? ageOn(profile.birthDate, today) : profile.birthYear ? Number(today.slice(0, 4)) - profile.birthYear : undefined;
  // the cycles the PDF will cover: the most recent closed ones, as buildReport picks them
  const covered = history && settings ? closedCycles(history, settings, count === 'all' ? Number.MAX_SAFE_INTEGER : Number(count)) : [];
  const first = covered[0];
  const lastCycle = covered[covered.length - 1];
  async function share() {
    if (!history || !settings) return;
    setBusy(true);
    setMsg(undefined);
    try {
      const html = buildReport({
        history, settings, flags: prediction?.flags ?? [], today,
        age, lifeStateKey: state && CHOICE_OF[state.kind] ? `settings.lifeState.options.${CHOICE_OF[state.kind]}` : undefined,
        engine: { version: ENGINE_VERSION, hash: ENGINE_BUILD_HASH.slice(0, 12) }, fertilityTools,
      }, { ...o, cycles: count === 'all' ? Number.MAX_SAFE_INTEGER : Number(count) }, (k, p) => String(t(k, p as never)));
      await shareReportPdf(html);
    } catch (e) { setMsg(`${t('report.failed')} ${(e as Error).message}`); } finally { setBusy(false); }
  }
  const heading = { variant: 'caption', color: 'textSecondary', accessibilityRole: 'header', style: { marginHorizontal: 4, fontWeight: '600' } } as const;
  return (
    <SubScreen testID="screen-report" title={t('report.screenTitle')}>
      <Card style={{ gap: 10 }}><Text>{t('report.intro')}</Text><Text variant="bodySmall" color="textSecondary">{t('legal.aboutDisclaimer')}</Text></Card>
      <View style={{ gap: 8 }}>
        <Text {...heading}>{t('report.cyclesN')}</Text>
        <Chips testIDPrefix="report-cycles" value={count} onChange={setCount} options={COUNTS.map((c) => ({ value: c, label: c === 'all' ? t('report.all') : c }))} />
        <Text testID="report-covered" variant="bodySmall" color="textSecondary" style={{ marginHorizontal: 4 }}>
          {first && lastCycle ? t('report.covered', { count: covered.length, n: covered.length, from: formatDayYear(first.start), to: formatDayYear(addDays(lastCycle.start, (lastCycle.length as number) - 1)) }) : t('report.noCycles')}
        </Text>
      </View>
      <View style={{ gap: 6 }}>
        <Text {...heading}>{t('report.alsoInclude')}</Text>
        <Group>
          <SwitchRow testID="report-symptoms" title={t('report.includeSymptoms')} value={o.symptoms} onChange={(v) => set({ symptoms: v })} />
          <SwitchRow testID="report-temperatures" title={t('report.includeTemperatures')} value={o.temperatures} onChange={(v) => set({ temperatures: v })} />
          <SwitchRow testID="report-flags" title={t('report.includeFlags')} value={o.flags} onChange={(v) => set({ flags: v })} last={!fertilityTools} />
          {fertilityTools ? <SwitchRow testID="report-ovulation" title={t('report.includeOvulation')} value={o.ovulation} onChange={(v) => set({ ovulation: v })} last /> : null}
        </Group>
      </View>
      <Text variant="bodySmall" color="textSecondary" style={{ marginHorizontal: 4 }}>{t('report.alwaysIncluded')}</Text>
      {msg ? <View testID="report-message" accessibilityLiveRegion="polite"><CautionPanel>{msg}</CautionPanel></View> : null}
      <Button testID="report-share" label={t('report.share')} disabled={busy || !history || !settings} onPress={() => void share()} />
    </SubScreen>
  );
}
