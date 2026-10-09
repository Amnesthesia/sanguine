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
import { noteDay, symptomNote } from '@/features/today/symptomNote';
import { useApp } from '@/state/app';
import { Card } from '@/ui/Card';
import { formatRange } from '@/ui/format';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function TodayScreen() {
  const { t } = useTranslation();
  const msg = useMsg();
  const { prediction, history, settings, today, prefs, profile, db, version } = useApp();
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
  const lastCycle = history?.cycles.at(-1);
  const bleedDays = lastCycle?.end ? diffDays(lastCycle.end, lastCycle.start) + 1 : undefined;
  const model = useMemo(
    () => buildToday({ prediction, hasCycles: (history?.cycles.length ?? 0) > 0, today, showEstimate: SHOW_OVULATION_ESTIMATE && eff.showOvulationEstimate, todayFlow, ...(bleedDays ? { bleedDays } : {}) }),
    [prediction, history, today, eff.showOvulationEstimate, todayFlow, bleedDays],
  );
  const note = useMemo(
    // analyzed records carry nextStart, length and the engine's quality; the raw history does not (same as Insights)
    () => symptomNote(history && settings ? analyzeCycles(history, settings).map((c) => c.record) : [], history?.logs ?? [], noteDay(prefs.symptomNote, model.state, model.dayOfCycle)),
    [history, settings, prefs.symptomNote, model.state, model.dayOfCycle],
  );
  const word = model.confidence && model.state === 'predicted' ? t(`confidence.${model.confidence}`) : undefined;
  const shownFlags = model.flags.filter((f) => !f.insightOnly);

  return (
    <Screen testID="screen-today" title={t('tabs.today')}>
      <PhaseRing ring={model.ring} dayOfCycle={model.dayOfCycle} phase={prediction?.currentPhase?.phase} />
      <QuickLogRow />
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
          {/* ponytail: label lower-cased for mid-sentence use; a language where nouns keep capitals needs inline label keys */}
          {note.map((l) => <Text key={l.code} variant="bodySmall" testID={`symptom-note-${l.code}`}>{t('today.symptomNote.line', { hits: l.hits, cycles: l.cycles, name: t(`symptom.${l.code}`).toLocaleLowerCase('en-AU') })}</Text>)}
          <Text variant="caption" color="textSecondary">{t('today.symptomNote.caption')}</Text>
        </Card>
      ) : null}
      {model.estimate ? <EstimateCard m={model.estimate} /> : null}
      {shownFlags.slice(0, 1).map((f) => <FlagCard key={f.code} f={f} onMute={(c) => void muteFlag(c)} />)}
      <View style={{ paddingVertical: 8 }}>
        <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }} testID="today-footer">{t(model.footerKey)}</Text>
      </View>
    </Screen>
  );
}
