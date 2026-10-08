import { addDays } from '@sanguine/engine';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, View } from 'react-native';
import { LIFE_CHOICES, METHODS, type LifeChoice, type Method } from '@/features/onboarding/model';
import { CHOICE_OF, changeLifeState, currentLifeStates, lifeStateHistory, type LifeStateRow } from '@/features/settings/lifeState';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chips } from '@/ui/Chips';
import { DateField } from '@/ui/DateField';
import { formatDayYear } from '@/ui/format';
import { OptionList } from '@/ui/OptionList';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

const EFFECT: Record<LifeChoice, string | undefined> = { none: undefined, hormonal: 'paused', postHormonal: 'warmup', pregnant: 'paused', postpartum: 'warmup', perimenopause: 'wider', irregular: 'wider' };

export default function LifeStateScreen() {
  const { t: tr } = useTranslation();
  const t = useTheme();
  const { db, store, today, refresh } = useApp();
  const [rows, setRows] = useState<LifeStateRow[]>([]);
  const [choice, setChoice] = useState<LifeChoice>('none');
  const [method, setMethod] = useState<Method>('combined_pill');
  const [day, setDay] = useState(today);
  const [bf, setBf] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    if (!db) return;
    const r = await lifeStateHistory(db);
    setRows(r);
    const cur = currentLifeStates(r, today)[0];
    setChoice(cur ? (CHOICE_OF[cur.kind] ?? 'none') : 'none');
    if (cur) { setDay(cur.from_day); setMethod(((cur.detail.method as Method | undefined) ?? 'combined_pill')); setBf(Boolean(cur.detail.breastfeeding)); }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: load once on open
  useEffect(() => { void load(); }, [db]);

  async function apply() {
    if (!db || !store) return;
    await changeLifeState(store, db, { choice, day, method, breastfeeding: bf });
    await refresh();
    await load();
    setSaved(true);
  }
  const needsMethod = choice === 'hormonal' || choice === 'postHormonal';
  const effect = EFFECT[choice];
  return (
    <SubScreen testID="screen-lifestate" title={tr('settings.lifeState.title')}>
      <OptionList testIDPrefix="life" value={choice} onChange={(c) => { setChoice(c); setSaved(false); }} options={LIFE_CHOICES.map((v) => ({ value: v, label: tr(`settings.lifeState.options.${v}`) }))} />
      {needsMethod ? <Chips testIDPrefix="method" value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m, label: tr(`settings.lifeState.methods.${m}`) }))} /> : null}
      {choice !== 'none' ? (<View style={{ gap: 8 }}>
        <Text variant="bodySmall" color="textSecondary">{tr('settings.lifeState.since', { date: formatDayYear(day) })}</Text>
        <DateField testID="state-date" value={day} onChange={setDay} min={addDays(today, -3650)} max={today} />
      </View>) : null}
      {choice === 'postpartum' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
          <Text>{tr('settings.lifeState.breastfeeding')}</Text>
          <Switch testID="breastfeeding" accessibilityLabel={tr('settings.lifeState.breastfeeding')} value={bf} onValueChange={setBf} trackColor={{ true: t.c.accent }} />
        </View>) : null}
      {effect ? <Text variant="bodySmall" color="textSecondary" testID="life-effect">{tr(`settings.lifeState.effect.${effect}`)}</Text> : null}
      <Button testID="life-apply" label={tr('common.save')} onPress={() => void apply()} />
      {saved ? <Text variant="bodySmall" color="textSecondary" testID="life-saved">{tr('log.saved')}</Text> : null}
      {rows.length ? (<>
        <Text variant="heading" accessibilityRole="header" style={{ marginTop: 8 }}>{tr('settings.lifeState.history')}</Text>
        {[...rows].reverse().map((r) => (
          <Card key={r.id}>
            <Text>{tr(`settings.lifeState.options.${CHOICE_OF[r.kind] ?? 'none'}`)}</Text>
            <Text variant="bodySmall" color="textSecondary">{`${formatDayYear(r.from_day)}${r.until_day ? ` – ${formatDayYear(r.until_day)}` : ''}`}</Text>
          </Card>
        ))}
      </>) : null}
    </SubScreen>
  );
}
