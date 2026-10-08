import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { diffDays } from '@sanguine/engine';
import { effectivePrefs } from '@/data/prefs';
import { EstimateCard, FlagCard, HeadlineCard, useMsg } from '@/features/today/cards';
import { PhaseRing } from '@/features/today/PhaseRing';
import { QuickLogRow } from '@/features/today/QuickLogRow';
import { buildToday, SHOW_OVULATION_ESTIMATE } from '@/features/today/todayModel';
import { useApp } from '@/state/app';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function TodayScreen() {
  const { t } = useTranslation();
  const msg = useMsg();
  const { prediction, history, today, prefs, profile, db, version } = useApp();
  const muteFlag = useApp((s) => s.muteFlag);
  const [todayFlow, setTodayFlow] = useState<string | undefined>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-reads today's log after every write
  useEffect(() => {
    void db?.get<{ flow: string | null }>('SELECT flow FROM daily_log WHERE day = ?', [today]).then((r) => setTodayFlow(r?.flow ?? undefined));
  }, [db, today, version]);

  const year = Number(today.slice(0, 4));
  const eff = effectivePrefs(prefs, profile.birthYear, year);
  const lastCycle = history?.cycles.at(-1);
  const bleedDays = lastCycle?.end ? diffDays(lastCycle.end, lastCycle.start) + 1 : undefined;
  const model = useMemo(
    () => buildToday({ prediction, hasCycles: (history?.cycles.length ?? 0) > 0, today, showEstimate: SHOW_OVULATION_ESTIMATE && eff.showOvulationEstimate, todayFlow, ...(bleedDays ? { bleedDays } : {}) }),
    [prediction, history, today, eff.showOvulationEstimate, todayFlow, bleedDays],
  );
  const word = model.confidence && model.state === 'predicted' ? t(`confidence.${model.confidence}`) : undefined;
  const shownFlags = model.flags.filter((f) => !f.insightOnly);

  return (
    <Screen testID="screen-today" title={t('tabs.today')}>
      <PhaseRing ring={model.ring} dayOfCycle={model.dayOfCycle} phase={prediction?.currentPhase?.phase} />
      <QuickLogRow />
      <HeadlineCard headline={msg(model.headline)} {...(model.subtitle ? { subtitle: msg(model.subtitle) } : {})} {...(word ? { confidenceWord: word } : {})} />
      {model.estimate ? <EstimateCard m={model.estimate} /> : null}
      {shownFlags.slice(0, 1).map((f) => <FlagCard key={f.code} f={f} onMute={(c) => void muteFlag(c)} />)}
      <View style={{ paddingVertical: 8 }}>
        <Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }} testID="today-footer">{t(model.footerKey)}</Text>
      </View>
    </Screen>
  );
}
