import { addDays } from '@sanguine/engine';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Switch, View } from 'react-native';
import { LIFE_CHOICES, METHODS, type LifeChoice, type Method } from '@/features/onboarding/model';
import { changeLifeState, choiceOf, symptomsForChoice, currentLifeStates, lifeStateHistory, type LifeStateRow } from '@/features/settings/lifeState';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chips } from '@/ui/Chips';
import { DateField } from '@/ui/DateField';
import { formatDayYear } from '@/ui/format';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

const EFFECT: Record<LifeChoice, string | undefined> = { none: undefined, hormonal: 'paused', postHormonal: 'warmup', pregnant: 'paused', postpartum: 'warmup', afterLoss: 'warmup', perimenopause: 'wider', irregular: 'wider' };

/** The life states as one card of radio rows with hairlines (single select): the selected row is named by the filled dot and bold accent text, not colour alone. */
function RadioRows({ options, value, onChange }: { options: Array<{ value: LifeChoice; label: string }>; value: LifeChoice; onChange: (v: LifeChoice) => void }) {
  const t = useTheme();
  return (
    <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
      <View accessibilityRole="radiogroup">
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} testID={`life-${o.value}`} accessibilityRole="radio" accessibilityLabel={o.label} aria-checked={on} accessibilityState={{ selected: on, checked: on }} onPress={() => onChange(o.value)}
              style={{ minHeight: 52, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: i === options.length - 1 ? 0 : 1, borderBottomColor: t.hairline }}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? t.c.accent : t.c.textSecondary, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.c.accent }} /> : null}
              </View>
              <Text style={{ flex: 1, ...(on ? { fontWeight: '600', color: t.c.onAccentSoft } : null) }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

export default function LifeStateScreen() {
  const { t: tr } = useTranslation();
  const t = useTheme();
  const { db, store, today, refresh, prefs, updatePrefs } = useApp();
  const [rows, setRows] = useState<LifeStateRow[]>([]);
  const [choice, setChoice] = useState<LifeChoice>('none');
  const [method, setMethod] = useState<Method>('combined_pill');
  const [day, setDay] = useState(today);
  const [bf, setBf] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pregnant, setPregnant] = useState(false);
  const [knowDue, setKnowDue] = useState(false);
  const [due, setDue] = useState(addDays(today, 200));

  const load = async () => {
    if (!db) return;
    const r = await lifeStateHistory(db);
    setRows(r);
    const cur = currentLifeStates(r, today)[0];
    setChoice(cur ? choiceOf(cur) : 'none');
    setPregnant(cur?.kind === 'pregnant');
    if (cur?.kind === 'pregnant' && typeof cur.detail.dueDate === 'string') { setKnowDue(true); setDue(cur.detail.dueDate); }
    if (cur) { setDay(cur.from_day); setMethod(((cur.detail.method as Method | undefined) ?? 'combined_pill')); setBf(Boolean(cur.detail.breastfeeding)); }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: load once on open
  useEffect(() => { void load(); }, [db]);

  async function apply() {
    if (!db || !store) return;
    await changeLifeState(store, db, { choice, day, method, breastfeeding: bf, dueDate: choice === 'pregnant' && knowDue ? due : undefined });
    const symptoms = symptomsForChoice(choice, prefs.symptoms);
    if (symptoms.length !== prefs.symptoms.length) await updatePrefs({ symptoms });
    await refresh();
    await load();
    setSaved(true);
  }
  const needsMethod = choice === 'hormonal' || choice === 'postHormonal';
  const effect = choice === 'hormonal' && method === 'hormonal_iud' ? 'iud' : EFFECT[choice];
  const details = pregnant || needsMethod || choice !== 'none' || effect;
  return (
    <SubScreen testID="screen-lifestate" title={tr('settings.lifeState.title')}>
      <RadioRows value={choice} onChange={(c) => { setChoice(c); setSaved(false); }} options={LIFE_CHOICES.map((v) => ({ value: v, label: tr(`settings.lifeState.options.${v}`) }))} />
      {details ? (
        <Card style={{ gap: 12 }}>
          {pregnant ? <Text variant="bodySmall" color="textSecondary" testID="pregnancy-ended-hint">{tr('settings.lifeState.pregnancyEnded')}</Text> : null}
          {needsMethod ? <Chips testIDPrefix="method" value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m, label: tr(`settings.lifeState.methods.${m}`) }))} /> : null}
          {choice !== 'none' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <Text>{tr('settings.lifeState.sinceLabel')}</Text>
              <DateField testID="state-date" value={day} onChange={setDay} min={addDays(today, -3650)} max={today} />
            </View>
          ) : null}
          {choice === 'pregnant' ? (<View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
              <Text style={{ flex: 1 }}>{tr('settings.lifeState.knowDue')}</Text>
              <Switch testID="know-due" accessibilityLabel={tr('settings.lifeState.knowDue')} value={knowDue} onValueChange={setKnowDue} trackColor={{ true: t.c.accent }} />
            </View>
            {knowDue ? (<>
              <Text variant="bodySmall" color="textSecondary">{tr('settings.lifeState.dueDate', { date: formatDayYear(due) })}</Text>
              <DateField testID="due-date" value={due} onChange={setDue} min={today} max={addDays(today, 300)} />
            </>) : null}
          </View>) : null}
          {choice === 'perimenopause' ? <Text variant="bodySmall" color="textSecondary" testID="pattern-symptoms-note">{tr('settings.lifeState.patternSymptoms')}</Text> : null}
          {choice === 'postpartum' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
              <Text style={{ flex: 1 }}>{tr('settings.lifeState.breastfeeding')}</Text>
              <Switch testID="breastfeeding" accessibilityLabel={tr('settings.lifeState.breastfeeding')} value={bf} onValueChange={setBf} trackColor={{ true: t.c.accent }} />
            </View>) : null}
          {effect ? <View style={{ borderRadius: 16, backgroundColor: t.chipBg, padding: 12 }}><Text variant="bodySmall" testID="life-effect">{tr(`settings.lifeState.effect.${effect}`)}</Text></View> : null}
        </Card>
      ) : null}
      <Button testID="life-apply" label={tr('common.save')} onPress={() => void apply()} />
      {saved ? <Text variant="bodySmall" color="textSecondary" testID="life-saved" accessibilityLiveRegion="polite">{tr('log.saved')}</Text> : null}
      {rows.length ? (<>
        <Text variant="heading" accessibilityRole="header" style={{ marginTop: 8 }}>{tr('settings.lifeState.history')}</Text>
        <Card style={{ gap: 0 }}>
          {[...rows].reverse().map((r, i) => (
            <View key={r.id} style={{ paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.hairline }}>
              <Text>{tr(`settings.lifeState.options.${choiceOf(r)}`)}</Text>
              <Text variant="bodySmall" color="textSecondary">{`${formatDayYear(r.from_day)}${r.until_day ? ` – ${formatDayYear(r.until_day)}` : ''}`}</Text>
            </View>
          ))}
        </Card>
      </>) : null}
    </SubScreen>
  );
}
