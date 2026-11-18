// The logging sheet (PLAN.md §8.3, §8.4): flow, symptoms, then "More". Writes are immediate; closing the sheet is the save.
import { addDays, type ISODate } from '@sanguine/engine';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FlowLevel } from '@/data/events';
import { dayEvents, dayState, fromC, periodContext, setFlow, setSymptom, setEnergy, type DayEvent, type DayState } from './actions';
import { EnergySlider, type EnergyLevel } from './EnergySlider';
import { FlowSelector } from './FlowSelector';
import { MoreSection } from './MoreSection';
import { SymptomGrid } from './SymptomGrid';
import { describeEvent } from './describe';
import { removeEntry, undoRemoval, visibleEntries } from './removeEntry';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chips } from '@/ui/Chips';
import { GlassSurface } from '@/ui/GlassBar';
import { LoggedChip } from '@/ui/LoggedChip';
import { GUTTER } from '@/ui/Screen';
import { formatDay, formatLong } from '@/ui/format';
import { Text } from '@/ui/Text';
import { showToast, ToastHost } from '@/ui/Toast';

/** Set only by deep links from outside the app (widget, home-screen quick actions); in-app buttons open the sheet plain (D-097). */
type Section = 'period' | 'temperature';
const EMPTY: DayState = { flow: null, flowKind: null, clots: false, symptoms: {}, sex: null, hasNote: false, energy: null };
type BleedKind = 'period' | 'withdrawal_bleed' | 'on_contraception';

export function LogSheet() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ section?: Section; day?: string }>();
  const { db, store, prefs, today, settings, refresh } = useApp();
  const [day, setDay] = useState<ISODate>((params.day as ISODate | undefined) ?? today);
  const [state, setState] = useState<DayState>(EMPTY);
  const [entries, setEntries] = useState<DayEvent[]>([]);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [startsHere, setStartsHere] = useState(false);
  const [bleedKind, setBleedKind] = useState<BleedKind>('withdrawal_bleed');
  const [afterPregnancy, setAfterPregnancy] = useState(false); // D-053: within the post-pregnancy window, bleeding defaults to not a period
  const [ppKind, setPpKind] = useState<'post_pregnancy' | 'period'>('post_pregnancy');
  const section = params.section;
  const quick = section === 'period'; // the widget's one-tap period path: the sheet closes after the flow tap
  const hormonal = (settings?.lifeStates ?? []).some((s) => s.kind === 'hormonal_contraception' && s.since <= day && (!s.until || day <= s.until));
  const hormonalIud = (settings?.lifeStates ?? []).some((s) => s.kind === 'hormonal_contraception' && s.method === 'hormonal_iud' && s.since <= day && (!s.until || day <= s.until));

  const reload = useCallback(async () => {
    if (!db || !store) return;
    const [s, evs, cyc, ctx] = await Promise.all([dayState(db, day), dayEvents(store, day), db.get('SELECT 1 AS x FROM cycle WHERE start_day = ?', [day]), periodContext(db, day)]);
    setState(s);
    setBleedKind(hormonalIud
      ? s.flowKind === 'on_contraception' || s.flowKind === 'withdrawal_bleed' ? 'on_contraception' : 'period'
      : s.flowKind === 'on_contraception' ? 'on_contraception' : 'withdrawal_bleed');
    setAfterPregnancy(Boolean(ctx.afterPregnancy));
    if (s.flowKind === 'period' || s.flowKind === 'post_pregnancy') setPpKind(s.flowKind);
    setStartsHere(Boolean(cyc));
    setEntries(visibleEntries(evs));
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
  }, [db, store, day, tr, prefs.tempUnit, hormonalIud]);
  useEffect(() => { void reload(); }, [reload]);
  const saved = useCallback(async () => { await refresh(); await reload(); }, [refresh, reload]);

  async function onFlow(level: Exclude<FlowLevel, 'none'>) {
    if (!db || !store) return;
    const kind = hormonal ? bleedKind : afterPregnancy ? ppKind : 'period';
    if (state.flow === level && state.flowKind === kind) { await setFlow(store, day, 'none', { kind }); await saved(); return; }
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

  async function onEnergy(level: EnergyLevel) {
    if (!store) return;
    await setEnergy(store, day, level);
    await saved();
  }

  // removal is a retraction (append-only); the toast's Undo retracts what the removal wrote (D-113, D-123)
  async function onRemove(e: DayEvent) {
    if (!db || !store) return;
    const label = describeEvent(e, tr, prefs.tempUnit);
    const written = await removeEntry(store, db, e);
    await saved();
    showToast(tr('log.removed', { label }), { label: tr('common.undo'), onPress: () => void undoRemoval(store, written).then(saved) });
  }

  const symptomCodes = useMemo(() => prefs.symptoms, [prefs.symptoms]);
  const isToday = day >= today;
  const heading = (key: string) => <Text variant="heading" accessibilityRole="header">{tr(key)}</Text>;
  const cardStyle = { gap: 12 } as const;
  const navButton = { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: t.chipBg } as const;
  return (
    <View style={{ flex: 1, backgroundColor: t.cardBg }} testID="screen-log">
      <View style={{ paddingHorizontal: t.glass.inset, paddingTop: Platform.OS === 'android' ? insets.top + 8 : 16, paddingBottom: 8 }}>
        <GlassSurface>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8, gap: 6 }}>
            <Pressable testID="log-prev" accessibilityRole="button" accessibilityLabel={tr('log.previousDay')} onPress={() => setDay(addDays(day, -1))} style={navButton}>
              <Text variant="heading" color="accent" style={{ fontSize: 22, lineHeight: 26 }}>‹</Text>
            </Pressable>
            <Text variant="heading" accessibilityRole="header" testID="log-title" style={{ flex: 1, textAlign: 'center' }}>{formatLong(day)}</Text>
            <Pressable testID="log-next" accessibilityRole="button" accessibilityLabel={tr('log.nextDay')} aria-disabled={isToday} disabled={isToday} onPress={() => setDay(addDays(day, 1))} style={[navButton, { opacity: isToday ? 0.3 : 1 }]}>
              <Text variant="heading" color="accent" style={{ fontSize: 22, lineHeight: 26 }}>›</Text>
            </Pressable>
            {/* the sheet's one filled control; it only closes, every entry is already saved */}
            <Button testID="log-done" label={tr('common.done')} accessibilityLabel={tr('a11y.doneLog')} onPress={() => router.back()} style={{ minHeight: 44, paddingHorizontal: 18 }} />
          </View>
        </GlassSurface>
      </View>
      <ToastHost />

      <ScrollView style={{ flex: 1 }} contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: insets.bottom + 32, gap: 16 }}>
        <View style={{ gap: 6, paddingHorizontal: 4 }}>
          <Text variant="caption" accessibilityRole="header" style={{ fontWeight: '600' }} color="textSecondary">{tr('log.loggedOnDay')}</Text>
          {entries.length === 0 ? <Text variant="bodySmall" color="textSecondary" testID="logged-empty">{tr('day.nothingLogged')}</Text> : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {entries.map((e) => <LoggedChip key={e.id} label={describeEvent(e, tr, prefs.tempUnit)} mark={e.kind === 'flow' ? 'flow' : e.kind === 'symptom' ? 'symptom' : 'other'} onRemove={() => void onRemove(e)} />)}
            </View>
          )}
        </View>
        <Card style={cardStyle}>
          {heading(hormonal || afterPregnancy ? 'log.bleeding' : 'log.flow')}
          {hormonal ? (
            <Chips testIDPrefix="bleed-kind" value={bleedKind} onChange={setBleedKind} options={[hormonalIud ? { value: 'period', label: tr('log.periodBleed') } : { value: 'withdrawal_bleed', label: tr('log.withdrawalBleed') }, { value: 'on_contraception', label: tr('log.otherBleed') }]} />
          ) : afterPregnancy ? (
            <Chips testIDPrefix="pp-kind" value={ppKind} onChange={setPpKind} options={[{ value: 'post_pregnancy', label: tr('log.afterPregnancyBleed') }, { value: 'period', label: tr('log.periodBleed') }]} />
          ) : null}
          <FlowSelector value={state.flow === 'none' ? null : state.flow} onChange={(l) => void onFlow(l)} />
          {startsHere && !hormonal && state.flow && state.flow !== 'none' && state.flow !== 'spotting' ? <Text variant="caption" color="textSecondary" testID="new-period-caption">{tr('log.newPeriod', { date: formatDay(day) })}</Text> : null}
        </Card>
        <Card style={cardStyle}>
          {heading('log.symptoms')}
          <SymptomGrid codes={symptomCodes} values={state.symptoms} onSet={(c, n) => void onSymptom(c, n)} />
        </Card>
        <Card style={cardStyle}>
          {heading('log.energy')}
          <EnergySlider value={(state.energy ?? 0) as EnergyLevel} onChange={(v) => void onEnergy(v)} />
        </Card>
        <Card style={[cardStyle, { paddingBottom: 4, gap: 4 }]}>
          {heading('log.more')}
          {db && store ? <MoreSection day={day} db={db} store={store} prefs={prefs} state={state} summaries={summaries} openRow={section === 'temperature' ? 'temperature' : undefined} onSaved={() => void saved()} /> : null}
        </Card>
      </ScrollView>
    </View>
  );
}
