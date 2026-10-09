// The logging sheet (PLAN.md §8.3, §8.4): flow, symptoms, then "More". Writes are immediate; closing the sheet is the save.
import { addDays, type ISODate } from '@sanguine/engine';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FlowLevel } from '@/data/events';
import { dayEvents, dayState, fromC, periodContext, setFlow, setSymptom, type DayState } from './actions';
import { FlowSelector } from './FlowSelector';
import { MoreSection } from './MoreSection';
import { SymptomGrid } from './SymptomGrid';
import { describeEvent } from './describe';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Chips } from '@/ui/Chips';
import { GUTTER } from '@/ui/Screen';
import { formatDay, formatLong } from '@/ui/format';
import { Text } from '@/ui/Text';

type Section = 'period' | 'symptoms' | 'temperature';
const EMPTY: DayState = { flow: null, flowKind: null, clots: false, symptoms: {}, sex: null, hasNote: false };
type BleedKind = 'withdrawal_bleed' | 'on_contraception';

export function LogSheet() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ section?: Section; day?: string }>();
  const { db, store, prefs, today, settings, refresh } = useApp();
  const [day, setDay] = useState<ISODate>((params.day as ISODate | undefined) ?? today);
  const [state, setState] = useState<DayState>(EMPTY);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [startsHere, setStartsHere] = useState(false);
  const [bleedKind, setBleedKind] = useState<BleedKind>('withdrawal_bleed');
  const [afterPregnancy, setAfterPregnancy] = useState(false); // D-053: within the post-pregnancy window, bleeding defaults to not a period
  const [ppKind, setPpKind] = useState<'post_pregnancy' | 'period'>('post_pregnancy');
  const section = params.section;
  const quick = section === 'period' || section === 'symptoms';
  const hormonal = (settings?.lifeStates ?? []).some((s) => s.kind === 'hormonal_contraception' && s.since <= day && (!s.until || day <= s.until));

  const reload = useCallback(async () => {
    if (!db || !store) return;
    const [s, evs, cyc, ctx] = await Promise.all([dayState(db, day), dayEvents(store, day), db.get('SELECT 1 AS x FROM cycle WHERE start_day = ?', [day]), periodContext(db, day)]);
    setState(s);
    setAfterPregnancy(Boolean(ctx.afterPregnancy));
    if (s.flowKind === 'period' || s.flowKind === 'post_pregnancy') setPpKind(s.flowKind);
    setStartsHere(Boolean(cyc));
    const sum: Record<string, string> = {};
    for (const e of evs) {
      if (e.kind !== 'biomarker') { if (e.kind === 'sex') sum.sex = describeEvent(e, tr, prefs.tempUnit); if (e.kind === 'note') sum.note = tr('day.entry.note'); continue; }
      const d = e.data as { type: string; value: Record<string, string | number>; measured_at?: string; source: string };
      if (d.type === 'bbt') sum.temperature = `${fromC(d.value.valueC as number, prefs.tempUnit).toFixed(2)} °${prefs.tempUnit}`;
      else if (d.type === 'lh') sum.lh = tr(`log.lh.${d.value.result}`);
      else if (d.type === 'mucus') sum.mucus = tr(`log.mucusLevels.${d.value.quality}`);
      else if (d.type === 'cervix') sum.cervix = tr(`log.cervixValues.position.${d.value.position}`);
    }
    setSummaries(sum);
  }, [db, store, day, tr, prefs.tempUnit]);
  useEffect(() => { void reload(); }, [reload]);
  const saved = useCallback(async () => { await refresh(); await reload(); }, [refresh, reload]);

  async function onFlow(level: Exclude<FlowLevel, 'none'>) {
    if (!db || !store) return;
    const kind = hormonal ? bleedKind : afterPregnancy ? ppKind : 'period';
    if (state.flow === level) { await setFlow(store, day, 'none', { kind }); await saved(); return; }
    const ctx = await periodContext(db, day);
    const write = async (answer: { splitAt?: string; mergeAt?: string; askedOn?: string } = {}) => {
      await setFlow(store, day, level, { kind, ...answer });
      await saved();
      if (quick) router.back();
    };
    // within a week of another period (D-052): the answer is written on the later of the two days, so it survives cleared days in the gap
    const joins = ctx.joins;
    const later = ctx.startsNew && joins ? joins : day;
    if (kind === 'period' && level !== 'spotting' && joins) {
      Alert.alert(tr('day.joinPrompt', { date: formatDay(joins) }), undefined, [
        { text: tr('day.samePeriod'), onPress: () => void write({ mergeAt: later, askedOn: day }) },
        { text: tr('day.newPeriod'), onPress: () => void write({ splitAt: later, askedOn: day }) },
        { text: tr('common.cancel'), style: 'cancel' },
      ]);
      return;
    }
    await write();
  }
  async function onSymptom(code: string, n: 0 | 1 | 2 | 3) {
    if (!store) return;
    await setSymptom(store, day, code, n);
    await saved();
  }

  const symptomCodes = useMemo(() => prefs.symptoms, [prefs.symptoms]);
  const isToday = day >= today;
  const heading = (key: string) => <Text variant="heading" accessibilityRole="header">{tr(key)}</Text>;
  return (
    <View style={{ flex: 1, backgroundColor: t.cardBg }} testID="screen-log">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, paddingTop: Platform.OS === 'android' ? insets.top + 8 : 16, paddingBottom: 8 }}>
        <Pressable testID="log-prev" accessibilityRole="button" accessibilityLabel={tr('log.previousDay')} onPress={() => setDay(addDays(day, -1))} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="heading">‹</Text>
        </Pressable>
        <Text variant="heading" accessibilityRole="header" testID="log-title" style={{ flex: 1, textAlign: 'center' }}>{formatLong(day)}</Text>
        <Pressable testID="log-next" accessibilityRole="button" accessibilityLabel={tr('log.nextDay')} aria-disabled={isToday} disabled={isToday} onPress={() => setDay(addDays(day, 1))} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: isToday ? 0.3 : 1 }}>
          <Text variant="heading">›</Text>
        </Pressable>
        <Pressable testID="log-done" accessibilityRole="button" accessibilityLabel={tr('common.done')} onPress={() => router.back()} style={{ minWidth: 56, minHeight: 48, alignItems: 'flex-end', justifyContent: 'center' }}>
          <Text variant="heading" color="accent">{tr('common.done')}</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 32, gap: 16 }}>
        {heading(hormonal || afterPregnancy ? 'log.bleeding' : 'log.flow')}
        {hormonal ? (
          <Chips testIDPrefix="bleed-kind" value={bleedKind} onChange={setBleedKind} options={[{ value: 'withdrawal_bleed', label: tr('log.withdrawalBleed') }, { value: 'on_contraception', label: tr('log.otherBleed') }]} />
        ) : afterPregnancy ? (
          <Chips testIDPrefix="pp-kind" value={ppKind} onChange={setPpKind} options={[{ value: 'post_pregnancy', label: tr('log.afterPregnancyBleed') }, { value: 'period', label: tr('log.periodBleed') }]} />
        ) : null}
        <FlowSelector value={state.flow === 'none' ? null : state.flow} onChange={(l) => void onFlow(l)} />
        {startsHere && !hormonal && state.flow && state.flow !== 'none' && state.flow !== 'spotting' ? <Text variant="caption" color="textSecondary" testID="new-period-caption">{tr('log.newPeriod', { date: formatDay(day) })}</Text> : null}
        {heading('log.symptoms')}
        <SymptomGrid codes={symptomCodes} values={state.symptoms} onSet={(c, n) => void onSymptom(c, n)} />
        {heading('log.more')}
        {db && store ? <MoreSection day={day} db={db} store={store} prefs={prefs} state={state} summaries={summaries} openRow={section === 'temperature' ? 'temperature' : undefined} onSaved={() => void saved()} /> : null}
      </ScrollView>
    </View>
  );
}
