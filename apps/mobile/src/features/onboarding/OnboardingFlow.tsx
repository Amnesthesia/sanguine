// Five steps, one question each (PLAN.md §8.3, §8.6, §9.8). Only age is required; the last step needs the data-handling acknowledgement.
import { addDays } from '@sanguine/engine';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { todayLocal } from '@/services/clock';
import { deviceHasLock } from '@/services/lockAuth';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Chips } from '@/ui/Chips';
import { DateField } from '@/ui/DateField';
import { OptionList } from '@/ui/OptionList';
import { ProgressDots } from '@/ui/ProgressDots';
import { TextField } from '@/ui/TextField';
import { Text } from '@/ui/Text';
import {
  type Answers, buildOnboardingWrites, canContinue, isTeenYear, LIFE_CHOICES, METHODS, TOTAL_STEPS, validateBirthYear, validateMenarcheYear, validateUsualLength,
} from './model';

type LastChoice = 'today' | 'yesterday' | 'weekAgo' | 'other';
const digits = (s: string) => s.replace(/\D/g, '');
const num = (s: string, len = 0) => (s.length > 0 && (len === 0 || s.length === len) ? Number(s) : undefined);

export function OnboardingFlow() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useApp((s) => s.store);
  const refresh = useApp((s) => s.refresh);
  const complete = useApp((s) => s.completeOnboarding);
  const today = useMemo(() => todayLocal(), []);
  const year = Number(today.slice(0, 4));

  const [step, setStep] = useState(0);
  const [birthText, setBirthText] = useState('');
  const [menarcheText, setMenarcheText] = useState('');
  const [usualText, setUsualText] = useState('');
  const [lastChoice, setLastChoice] = useState<LastChoice | undefined>();
  const [other, setOther] = useState(addDays(today, -14));
  const [a, setA] = useState<Pick<Answers, 'lifeState' | 'method' | 'stateDate' | 'breastfeeding' | 'consent'>>({ lifeState: 'none', method: 'combined_pill', stateDate: today, breastfeeding: false, consent: false });
  const [healthNote, setHealthNote] = useState(false);
  const [backupIntent, setBackupIntent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lockAvailable, setLockAvailable] = useState<boolean | undefined>();
  useEffect(() => { void deviceHasLock().then(setLockAvailable); }, []);

  const birthYear = num(birthText, 4);
  const lastPeriod = lastChoice === 'today' ? today : lastChoice === 'yesterday' ? addDays(today, -1) : lastChoice === 'weekAgo' ? addDays(today, -7) : lastChoice === 'other' ? other : undefined;
  const answers: Answers = { birthYear, menarcheYear: num(menarcheText, 4), lastPeriod, usualLength: num(usualText), ...a };
  const birthCheck = birthText.length === 4 ? validateBirthYear(birthYear, year) : { ok: true as const };
  const menarcheCheck = menarcheText.length === 4 ? validateMenarcheYear(answers.menarcheYear, birthYear, year) : { ok: true as const };
  const usualCheck = validateUsualLength(answers.usualLength);
  const teen = birthYear !== undefined && birthCheck.ok && isTeenYear(birthYear, year);
  const ok = canContinue(step, answers, year);
  const healthLabel = Platform.OS === 'ios' ? tr('onboarding.s5.importIos') : tr('onboarding.s5.importAndroid');

  async function finish() {
    if (!store || busy) return;
    setBusy(true);
    try {
      const w = buildOnboardingWrites(answers, today);
      await store.setProfile(w.profile);
      if (w.events.length) await store.appendMany(w.events);
      await complete();
      await refresh();
      router.replace(backupIntent ? '/settings' : '/today');
    } finally {
      setBusy(false);
    }
  }
  const next = () => (step === TOTAL_STEPS - 1 ? void finish() : setStep(step + 1));

  const title = (key: string) => <Text variant="title" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34 }}>{tr(key)}</Text>;
  const needsMethod = a.lifeState === 'hormonal' || a.lifeState === 'postHormonal';
  const dateLabel = a.lifeState === 'postHormonal' ? 'onboarding.s4.whenStopped' : a.lifeState === 'postpartum' ? 'onboarding.s4.whenBirth' : 'onboarding.s4.whenStarted';
  const needsDate = a.lifeState === 'postHormonal' || a.lifeState === 'pregnant' || a.lifeState === 'postpartum';

  return (
    <KeyboardAvoidingView testID="screen-onboarding" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.screenBg, paddingTop: insets.top + 12 }}>
      <ProgressDots step={step} total={TOTAL_STEPS} />
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16, flexGrow: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {step === 0 && (<>
          {title('onboarding.s1.title')}
          <Text>{tr('onboarding.s1.body')}</Text>
        </>)}

        {step === 1 && (<>
          {title('onboarding.s2.title')}
          <TextField testID="birth-year" label={tr('onboarding.s2.yearLabel')} value={birthText} onChangeText={(s) => setBirthText(digits(s).slice(0, 4))} maxLength={4} placeholder="1990" helper={tr('onboarding.s2.ageHelp')}
            error={!birthCheck.ok ? (birthCheck.reason === 'tooYoung' ? tr('onboarding.s2.tooYoung') : tr('onboarding.s2.invalidYear')) : undefined} />
          <TextField testID="menarche-year" label={tr('onboarding.s2.menarcheLabel')} value={menarcheText} onChangeText={(s) => setMenarcheText(digits(s).slice(0, 4))} maxLength={4} error={!menarcheCheck.ok ? tr('onboarding.s2.invalidYear') : undefined} />
          {teen ? <Text variant="bodySmall" color="textSecondary" testID="teen-note">{tr('onboarding.teenNote')}</Text> : null}
        </>)}

        {step === 2 && (<>
          {title('onboarding.s3.title')}
          <Chips testIDPrefix="last" value={lastChoice} onChange={setLastChoice} options={[
            { value: 'today', label: tr('onboarding.s3.today') }, { value: 'yesterday', label: tr('onboarding.s3.yesterday') },
            { value: 'weekAgo', label: tr('onboarding.s3.weekAgo') }, { value: 'other', label: tr('onboarding.s3.other') }]} />
          {lastChoice === 'other' ? <DateField testID="last-date" value={other} onChange={setOther} min={addDays(today, -730)} max={today} /> : null}
          {lastPeriod ? <Text variant="bodySmall" color="textSecondary">{tr('onboarding.s3.chosen', { date: new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${lastPeriod}T00:00:00Z`)) })}</Text> : <Text variant="bodySmall" color="textSecondary">{tr('onboarding.s3.emptyNote')}</Text>}
          <TextField testID="usual-length" label={tr('onboarding.s3.usualLength')} value={usualText} onChangeText={(s) => setUsualText(digits(s).slice(0, 2))} maxLength={2} helper={tr('onboarding.s3.usualLengthHelp')} error={!usualCheck.ok ? tr('onboarding.s3.usualLengthInvalid') : undefined} />
        </>)}

        {step === 3 && (<>
          {title('onboarding.s4.title')}
          <OptionList testIDPrefix="life" value={a.lifeState} onChange={(v) => setA({ ...a, lifeState: v })} options={LIFE_CHOICES.map((v) => ({ value: v, label: tr(`onboarding.s4.options.${v}`) }))} />
          {needsMethod ? (<View style={{ gap: 8 }}><Text variant="bodySmall" color="textSecondary">{tr('onboarding.s4.method')}</Text>
            <Chips testIDPrefix="method" value={a.method} onChange={(m) => setA({ ...a, method: m })} options={METHODS.map((m) => ({ value: m, label: tr(`settings.lifeState.methods.${m}`) }))} /></View>) : null}
          {needsDate ? (<View style={{ gap: 8 }}><Text variant="bodySmall" color="textSecondary">{tr(dateLabel)}</Text>
            <DateField testID="state-date" value={a.stateDate} onChange={(d) => setA({ ...a, stateDate: d })} min={addDays(today, -1100)} max={today} /></View>) : null}
          {a.lifeState === 'postpartum' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
              <Text>{tr('settings.lifeState.breastfeeding')}</Text>
              <Switch testID="breastfeeding" accessibilityLabel={tr('settings.lifeState.breastfeeding')} value={a.breastfeeding} onValueChange={(v) => setA({ ...a, breastfeeding: v })} trackColor={{ true: t.c.accent }} />
            </View>) : null}
        </>)}

        {step === 4 && (<>
          {title('onboarding.s5.title')}
          <Text>{tr('legal.privacyThreeSentences')}</Text>
          {lockAvailable !== undefined ? <Text variant="bodySmall" color="textSecondary" testID="lock-explain">{tr(lockAvailable ? 'lock.explain' : 'lock.off')}</Text> : null}
          <Pressable testID="consent" accessibilityRole="checkbox" accessibilityLabel={tr('onboarding.s5.consent')} aria-checked={a.consent} onPress={() => setA({ ...a, consent: !a.consent })}
            style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 52 }}>
            <View style={{ width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: t.c.accent, backgroundColor: a.consent ? t.c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {a.consent ? <Text style={{ color: t.scheme === 'dark' ? '#3A0A14' : '#FFFFFF', fontWeight: '700' }}>✓</Text> : null}
            </View>
            <Text style={{ flex: 1 }}>{tr('onboarding.s5.consent')}</Text>
          </Pressable>
          <Button testID="health-offer" kind="secondary" label={healthLabel} onPress={() => setHealthNote(true)} />
          {healthNote ? <Text variant="bodySmall" color="textSecondary" testID="health-note">{tr('onboarding.s5.healthUnavailable')}</Text> : null}
          <Button testID="backup-offer" kind="secondary" label={tr('onboarding.s5.backup')} onPress={() => setBackupIntent(true)} />
          {backupIntent ? <Text variant="bodySmall" color="textSecondary" testID="backup-note">{tr('onboarding.s5.backupHint')}</Text> : null}
        </>)}
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: insets.bottom + 12, gap: 4 }}>
        <Button testID="onboarding-continue" label={step === TOTAL_STEPS - 1 ? tr('common.finish') : tr('common.continue')} disabled={!ok || busy} onPress={next} />
        {step === 2 || step === 3 ? (
          <Button testID="onboarding-skip" kind="text" label={step === 2 ? tr('common.dontKnow') : tr('common.skip')} onPress={() => { if (step === 2) { setLastChoice(undefined); } else { setA({ ...a, lifeState: 'none' }); } setStep(step + 1); }} />
        ) : null}
        {step > 0 ? <Button testID="onboarding-back" kind="text" label={tr('common.back')} onPress={() => setStep(step - 1)} /> : null}
      </View>
    </KeyboardAvoidingView>
  );
}
