import { dayEvents, type DayEvent, energyDays } from '@/features/logging/actions';
import { LoggedEntries } from '@/features/logging/LoggedEntries';
import { visibleEntries } from '@/features/logging/removeEntry';
import { usePeriodDays } from '@/features/calendar/useCalendarData';
import { energyInsight, lowPhaseOf } from '@/features/insights/energyModel';
import { GuidanceSections } from '@/features/guidance/sections/GuidanceSections';
import { phaseOn, showSupplements } from '@/features/guidance/guidance';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { analyzeCycles } from '@sanguine/engine';
import { effectivePrefs } from '@/data/prefs';
import { CycleDial, type DialCentre } from '@/features/today/CycleDial';
import { dialModel } from '@/features/today/dialModel';
import { EstimateCard, FlagCard, HeadlineCard, HeroCard, HeroWash, PausedRing, RangeCard, SectionsSheet, useHeroGlass, useMsg } from '@/features/today/cards';
import { ovulationDrawable, shownFertileDays } from '@/features/today/fertileShown';
import { QuickLogRow } from '@/features/today/QuickLogRow';
import { buildToday, SHOW_OVULATION_ESTIMATE } from '@/features/today/todayModel';
import { pregnancyModel } from '@/features/today/pregnancyModel';
import { answeredShortCycles, keepAsPeriod, notAPeriod, shortCycleQuestion } from '@/features/today/shortCycle';
import { noteDay, symptomNote } from '@/features/today/symptomNote';
import { useApp } from '@/state/app';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EstimateTag } from '@/ui/EstimateTag';
import { formatDay, formatRange, formatWeekday } from '@/ui/format';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const msg = useMsg();
  const { prediction, history, settings, today, prefs, profile, db, store, version, refresh } = useApp();
  const periodDays = usePeriodDays(); // two small queries; the full calendar data (event scan, past ovulations) is not needed here
  const heroGlass = useHeroGlass();
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
  const model = useMemo(
    () => buildToday({ prediction, hasCycles: (history?.cycles.length ?? 0) > 0, today, showEstimate, todayFlow }),
    [prediction, history, today, showEstimate, todayFlow],
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
  const shownFlags = model.flags.filter((f) => !f.insightOnly);

  // today's logged entries as chips; removal is a retraction and the toast's Undo retracts what it wrote (D-113)
  const [entries, setEntries] = useState<DayEvent[]>([]);
  const loadEntries = useCallback(async () => { if (store) setEntries(visibleEntries(await dayEvents(store, today))); }, [store, today]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads today's entries after every write
  useEffect(() => { void loadEntries(); }, [loadEntries, version]);
  const saved = async () => { await refresh(); await loadEntries(); };

  // the dial: the effective gate (teen mode included) decides whether any fertile or ovulation mark is drawn
  const includeUncertain = eff.showUncertainEstimates;
  const dial = useMemo(() => dialModel({ ...(prediction ? { prediction } : {}), today, periodDays: [...periodDays], showEstimate, includeUncertain }), [prediction, today, periodDays, showEstimate, includeUncertain]);
  const centre = useMemo<DialCentre>(() => {
    const p = prediction;
    if (!p || p.suspended || !model.dayOfCycle) return { kicker: t('today.dial.noDataKicker'), big: '–', sub: t('today.dial.noDataSub') };
    const kicker = t('today.dial.kicker');
    const big = String(model.dayOfCycle);
    const next = p.nextPeriod;
    const nextSub = next ? t('today.dial.nextPeriod', { range: formatRange(next.i80.lo, next.i80.hi) }) : undefined;
    if (model.state === 'inProgress' && p.currentBleed) return { kicker, big, pill: t('today.dial.legend.period'), sub: t('today.dial.likelyEnds', { range: formatRange(p.currentBleed.i80.lo, p.currentBleed.i80.hi) }) };
    if (showEstimate && shownFertileDays(p, { includeUncertain }).some((f) => f.date === today)) {
      const o = p.ovulation;
      const sub = o && ovulationDrawable(p, includeUncertain) ? t('today.dial.ovulationLikely', { range: formatRange(o.i80.lo, o.i80.hi) }) : nextSub;
      return { kicker, big, pill: t('today.dial.pillFertile'), ...(sub ? { sub } : {}) };
    }
    const w = model.confidence ? t(`confidence.${model.confidence}`) : '';
    const pill = w ? `${w.charAt(0).toLocaleUpperCase(i18n.language)}${w.slice(1)}` : undefined;
    return { kicker, big, ...(pill ? { pill } : {}), ...(nextSub ? { sub: nextSub } : {}) };
  }, [prediction, model.dayOfCycle, model.state, model.confidence, showEstimate, includeUncertain, today, t, i18n.language]);

  const [sheet, setSheet] = useState(false);
  const shortDate = `${formatWeekday(today).slice(0, 3)} ${formatDay(today)}`;
  const next = prediction?.nextPeriod;
  const paused = model.state === 'suspended';
  // the headline is a hero card over the wash when it is about the next period; while the period is on, or with nothing to estimate, it is a plain card
  const nextAsHero = !paused && model.state !== 'inProgress' && model.state !== 'empty' && next !== undefined;
  const hasHero = pregnantSince !== undefined || (!paused && model.state !== 'empty'); // the wash shows whenever a glass hero card renders

  return (
    <Screen
      testID="screen-today" title={t('tabs.today')} bottomInset={96}
      floating={<QuickLogRow title={shortDate} subtitle={model.dayOfCycle && !paused && model.state !== 'empty' ? t('today.ring.dayLabel', { day: model.dayOfCycle }) : model.state === 'empty' ? t('today.ring.noData') : ''} />}>
      {heroGlass && hasHero ? <HeroWash /> : null}
      <Text variant="caption" color="textOnGlass" style={{ marginTop: -16 }} testID="today-date" accessibilityElementsHidden importantForAccessibility="no">{shortDate}</Text>{/* hidden from screen readers: the quick-log pill carries the same date */}
      {paused ? <PausedRing /> : <CycleDial model={dial} centre={centre} />}
      {dial.arcs.some((a) => a.kind === 'fertile') ? <Text variant="caption" color="textOnGlass" style={{ textAlign: 'center', marginTop: -8 }} testID="today-legend">{t('today.legend')}</Text> : null}
      {nextAsHero ? null : <HeadlineCard headline={msg(model.headline)} {...(model.subtitle ? { subtitle: msg(model.subtitle) } : {})} />}
      {entries.length ? (
        <View testID="today-logs" accessibilityRole="list" accessibilityLabel={t('today.logsToday')}>
          <LoggedEntries entries={entries} onChanged={saved} />
        </View>
      ) : null}
      {pregnantSince ? (
        <HeroCard testID="pregnancy-card">
          {pregnancy ? (<>
            <EstimateTag onGlass={heroGlass} />
            <Text variant="heading" testID="pregnancy-week">{t('today.pregnancy.week', { week: pregnancy.week, day: pregnancy.day })}</Text>
            <Text testID="pregnancy-due">{t('today.pregnancy.due', { range: formatRange(pregnancy.due.lo, pregnancy.due.hi) })}</Text>
            <Text variant="caption" color="textOnGlass">{t(pregnancy.from === 'due' ? 'today.pregnancy.fromDue' : 'today.pregnancy.fromPeriod')}</Text>
          </>) : <Text variant="bodySmall" color="textOnGlass" testID="pregnancy-none">{t('today.pregnancy.none')}</Text>}
        </HeroCard>
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
      {model.state === 'inProgress' && prediction?.currentBleed ? (
        <RangeCard testID="period-end-card" title={t('today.periodEndsLikely')} line={formatRange(prediction.currentBleed.i80.lo, prediction.currentBleed.i80.hi)} confidence={prediction.currentBleed.confidence} />
      ) : null}
      {!paused && next ? (
        nextAsHero
          ? <RangeCard testID="next-period-card" title={msg(model.headline)} {...(model.subtitle ? { line: msg(model.subtitle) } : {})} confidence={next.confidence} />
          : <RangeCard testID="next-period-card" title={t('today.nextPeriodLikely')} line={formatRange(next.i80.lo, next.i80.hi)} confidence={next.confidence} />
      ) : null}
      {model.estimate ? <EstimateCard m={model.estimate} /> : null}
      {shownFlags.slice(0, 1).map((f) => <FlagCard key={f.code} f={f} onMute={(c) => void muteFlag(c)} />)}
      {guide ? (
        <View style={{ gap: 12 }}>
          <GuidanceSections compact day={guide} supplements={showSupplements(eff.teen)} onMore={() => setSheet(true)} />
          {energyLow ? <Card><Text variant="bodySmall" testID="guidance-energy-low">{t('guidance.energyLow')}</Text></Card> : null}
        </View>
      ) : null}
      <View style={{ paddingVertical: 8 }}>
        <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }} testID="today-footer">{t(model.footerKey)}</Text>
      </View>
      {guide ? (
        <SectionsSheet visible={sheet} onClose={() => setSheet(false)}>
          <GuidanceSections compact={false} day={guide} supplements={showSupplements(eff.teen)} />
        </SectionsSheet>
      ) : null}
    </Screen>
  );
}
