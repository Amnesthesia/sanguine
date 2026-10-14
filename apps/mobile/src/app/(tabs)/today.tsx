import { energyDays } from '@/features/logging/actions';
import { energyInsight, lowPhaseOf } from '@/features/insights/energyModel';
import { useRouter } from 'expo-router';
import { GuidanceCard } from '@/features/guidance/GuidanceCard';
import { phaseOn, showSupplements } from '@/features/guidance/guidance';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { analyzeCycles, diffDays } from '@sanguine/engine';
import { effectivePrefs } from '@/data/prefs';
import { EstimateCard, FlagCard, HeadlineCard, useMsg } from '@/features/today/cards';
import { PhaseRing } from '@/features/today/PhaseRing';
import { QuickLogRow } from '@/features/today/QuickLogRow';
import { buildToday, SHOW_OVULATION_ESTIMATE } from '@/features/today/todayModel';
import { pregnancyModel } from '@/features/today/pregnancyModel';
import { answeredShortCycles, keepAsPeriod, notAPeriod, shortCycleQuestion } from '@/features/today/shortCycle';
import { noteDay, symptomNote } from '@/features/today/symptomNote';
import { useApp } from '@/state/app';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { formatDay, formatRange } from '@/ui/format';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const msg = useMsg();
  const router = useRouter();
  const { prediction, history, settings, today, prefs, profile, db, store, version, refresh } = useApp();
  const muteFlag = useApp((s) => s.muteFlag);
  const [todayFlow, setTodayFlow] = useState<string | undefined>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads today's log after every write
  useEffect(() => {
    void db?.get<{ flow: string | null }>('SELECT flow FROM daily_log WHERE day = ?', [today]).then((r) => setTodayFlow(r?.flow ?? undefined));
  }, [db, today, version]);

  // pregnancy view (P8-5): the open pregnant state and the due date the user may have entered
  const pregnantSince = settings?.lifeStates.flatMap((s) => (s.kind === 'pregnant' && s.since <= today && (s.until === undefined || s.until >= today) ? [s.since] : []))[0];
  const [dueDate, setDueDate] = useState<string | undefined>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads after a life-state change
  useEffect(() => {
    if (!pregnantSince) { setDueDate(undefined); return; }
    void db?.get<{ detail: string }>("SELECT detail FROM life_state WHERE kind = 'pregnant' AND until_day IS NULL ORDER BY from_day DESC LIMIT 1").then((r) => {
      const d = r ? (JSON.parse(r.detail) as { dueDate?: unknown }).dueDate : undefined;
      setDueDate(typeof d === 'string' ? d : undefined);
    });
  }, [db, pregnantSince, version]);
  const pregnancy = pregnantSince ? pregnancyModel({ since: pregnantSince, cycleStarts: history?.cycles.map((c) => c.start) ?? [], dueDate, today }) : undefined;

  const eff = effectivePrefs(prefs, profile, today);
  const records = useMemo(() => (history && settings ? analyzeCycles(history, settings).map((c) => c.record) : []), [history, settings]);
  const showEstimate = SHOW_OVULATION_ESTIMATE && eff.showOvulationEstimate;
  const lastCycle = history?.cycles.at(-1);
  const bleedDays = lastCycle?.end ? diffDays(lastCycle.end, lastCycle.start) + 1 : undefined;
  const model = useMemo(
    () => buildToday({ prediction, hasCycles: (history?.cycles.length ?? 0) > 0, today, showEstimate, todayFlow, ...(bleedDays ? { bleedDays } : {}) }),
    [prediction, history, today, showEstimate, todayFlow, bleedDays],
  );
  const guide = useMemo(
    () => (prefs.cycleGuidance ? phaseOn({ date: today, today, prediction, cycles: records, showEstimate }) : undefined),
    [prefs.cycleGuidance, today, prediction, records, showEstimate],
  );
  const [energyPoints, setEnergyPoints] = useState<Array<{ day: string; level: number }>>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads after every write
  useEffect(() => { if (db) void energyDays(db).then(setEnergyPoints); }, [db, version]);
  const energyLow = useMemo(() => {
    if (!guide) return false;
    const { suggestions } = energyInsight(energyPoints, today, (d) => phaseOn({ date: d, today, prediction, cycles: records, showEstimate }));
    return lowPhaseOf(suggestions) === guide.phase;
  }, [guide, energyPoints, today, prediction, records, showEstimate]);
  const note = useMemo(
    // analyzed records carry nextStart, length and the engine's quality; the raw history does not (same as Insights)
    () => symptomNote(records, history?.logs ?? [], noteDay(prefs.symptomNote, model.state, model.dayOfCycle)),
    [records, history, prefs.symptomNote, model.state, model.dayOfCycle],
  );
  // P8-13 item 5 (D-094): a cycle far shorter than hers is asked about once, never set aside on its own
  const [answered, setAnswered] = useState<string[] | undefined>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads after an answer
  useEffect(() => { if (db) void answeredShortCycles(db).then(setAnswered); }, [db, version]);
  const shortQ = useMemo(
    () => (history && settings && answered ? shortCycleQuestion(records, today, answered) : undefined),
    [history, settings, records, answered, today],
  );
  const answer = (f: () => Promise<unknown>) => void f().then(() => refresh());
  const word = model.confidence && model.state === 'predicted' ? t(`confidence.${model.confidence}`) : undefined;
  const shownFlags = model.flags.filter((f) => !f.insightOnly);

  return (
    <Screen testID="screen-today" title={t('tabs.today')} floating={<QuickLogRow />}>
      <PhaseRing ring={model.ring} dayOfCycle={model.dayOfCycle} phase={prediction?.currentPhase?.phase} />
      <HeadlineCard headline={msg(model.headline)} {...(model.subtitle ? { subtitle: msg(model.subtitle) } : {})} {...(word ? { confidenceWord: word } : {})} />
      {pregnantSince ? (
        <Card testID="pregnancy-card">
          {pregnancy ? (<>
            <Text variant="heading" testID="pregnancy-week">{t('today.pregnancy.week', { week: pregnancy.week, day: pregnancy.day })}</Text>
            <Text testID="pregnancy-due">{t('today.pregnancy.due', { range: formatRange(pregnancy.due.lo, pregnancy.due.hi) })}</Text>
            <Text variant="caption" color="textSecondary">{t(pregnancy.from === 'due' ? 'today.pregnancy.fromDue' : 'today.pregnancy.fromPeriod')}</Text>
          </>) : <Text variant="bodySmall" color="textSecondary" testID="pregnancy-none">{t('today.pregnancy.none')}</Text>}
        </Card>
      ) : null}
      {note.length ? (
        <Card testID="symptom-note" accessibilityRole="summary">
          {/* labels are lower-cased mid-sentence in English only; other languages keep their own casing (German nouns, Turkish I) */}
          {note.map((l) => <Text key={l.code} variant="bodySmall" testID={`symptom-note-${l.code}`}>{t('today.symptomNote.line', { hits: l.hits, cycles: l.cycles, name: i18n.language.startsWith('en') ? t(`symptom.${l.code}`).toLocaleLowerCase(i18n.language) : t(`symptom.${l.code}`) })}</Text>)}
          <Text variant="caption" color="textSecondary">{t('today.symptomNote.caption')}</Text>
        </Card>
      ) : null}
      {shortQ && db && store ? (
        <Card testID="short-cycle-card">
          <Text variant="heading">{t('today.shortCycle.title')}</Text>
          <Text variant="bodySmall">{t('today.shortCycle.body', { date: formatDay(shortQ.start), days: shortQ.length })}</Text>
          <Button testID="short-cycle-yes" kind="secondary" label={t('today.shortCycle.yes')} onPress={() => answer(() => keepAsPeriod(db, shortQ))} />
          <Button testID="short-cycle-no" kind="secondary" label={t('today.shortCycle.no')} onPress={() => answer(() => notAPeriod(store, db, shortQ))} />
        </Card>
      ) : null}
      {model.estimate ? <EstimateCard m={model.estimate} /> : null}
      {shownFlags.slice(0, 1).map((f) => <FlagCard key={f.code} f={f} onMute={(c) => void muteFlag(c)} />)}
      {guide ? <GuidanceCard energyLow={energyLow} day={guide} supplements={showSupplements(eff.teen)} onMore={() => router.push({ pathname: '/day/[date]', params: { date: today } })} /> : null}
      <View style={{ paddingVertical: 8 }}>
        <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }} testID="today-footer">{t(model.footerKey)}</Text>
      </View>
    </Screen>
  );
}
