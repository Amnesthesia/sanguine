// Five steps, one question each (PLAN.md §8.3, §8.6, §9.8). Only age is required; the last step needs the data-handling acknowledgement.
// Navigation is floating glass (D-125): Back, the step platter and Skip on top, the one Continue in the footer; the questions stay opaque.
import { addDays } from '@sanguine/engine';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { deviceClock, todayLocal } from '@/services/clock';
import { deviceHasLock } from '@/services/lockAuth';
import { consentRequirement, recordConsent } from '@/data/consent';
import { deviceRegion } from '@/services/locale';
import { useApp } from '@/state/app';
import { useLock } from '@/state/lock';
import { useTheme } from '@/theme';
import { BackButton } from '@/ui/BackButton';
import { Button } from '@/ui/Button';
import { Chips } from '@/ui/Chips';
import { DateField } from '@/ui/DateField';
import { GlassSurface } from '@/ui/GlassBar';
import { OptionList } from '@/ui/OptionList';
import { ProgressDots } from '@/ui/ProgressDots';
import { TextField } from '@/ui/TextField';
import { Text } from '@/ui/Text';
import { defaultBirthDate, isTeenOn, validateBirthDate } from '@/data/age';
import {
  type Answers, buildOnboardingWrites, canContinue, LIFE_CHOICES, METHODS, TOTAL_STEPS, validateMenarcheYear, validateUsualLength,
} from './model';
import { useKeyboardHeight } from './useKeyboardHeight';

type LastChoice = 'today' | 'yesterday' | 'weekAgo' | 'other';
const digits = (s: string) => s.replace(/\D/g, '');
const num = (s: string, len = 0) => (s.length > 0 && (len === 0 || s.length === len) ? Number(s) : undefined);

const BAR = 44; // height of the glass controls in the header
const SIDE = 80; // the Back and Skip slots are the same width, so the platter stays centred
const GUTTER = 24;

/** A line of text with an icon, so a message never relies on colour alone. */
function Notice({ icon, children, testID, live, tone = 'error' }: { icon: ReactNode; children: ReactNode; testID?: string; live?: boolean; tone?: 'error' | 'info' }) {
  const t = useTheme();
  const body = <Text variant="bodySmall" style={{ flex: 1, ...(tone === 'error' ? { color: t.c.period } : null) }}>{children}</Text>;
  return (
    <View testID={testID} {...(live ? { accessibilityLiveRegion: 'polite' as const } : null)} style={tone === 'info' ? { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.chipBg } : { flexDirection: 'row', gap: 6 }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ marginTop: 2 }}>{icon}</View>
      {body}
    </View>
  );
}
const InfoIcon = ({ color, size = 16 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16"><Circle cx={8} cy={8} r={6.8} fill="none" stroke={color} strokeWidth={1.5} /><Path d="M8 7.2V11.6M8 4.6V4.8" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" /></Svg>
);
const stroke = (color: string, d: string, w = 1.7) => <Path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;

/** A label on the left and its date picker on the right, on one grouped row. */
function DateRow({ label, children, divider }: { label: string; children: ReactNode; divider?: boolean }) {
  const t = useTheme();
  return (
    <View style={[{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 6, paddingLeft: 16, paddingRight: 6 }, divider ? { borderTopWidth: 1, borderTopColor: t.hairline } : null]}>
      <Text style={{ flex: 1, fontSize: 17, lineHeight: 22 }}>{label}</Text>
      {children}
    </View>
  );
}

export function OnboardingFlow() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const store = useApp((s) => s.store);
  const db = useApp((s) => s.db);
  const refresh = useApp((s) => s.refresh);
  const complete = useApp((s) => s.completeOnboarding);
  const today = useMemo(() => todayLocal(), []);
  const year = Number(today.slice(0, 4));

  const [step, setStep] = useState(0);
  const [birthDate, setBirthDate] = useState(defaultBirthDate(today)); // the selector starts 30 years back; the age gate is checked on the chosen date
  const [menarcheText, setMenarcheText] = useState('');
  const [usualText, setUsualText] = useState('');
  const [lastChoice, setLastChoice] = useState<LastChoice | undefined>();
  const [other, setOther] = useState(addDays(today, -14));
  const [a, setA] = useState<Pick<Answers, 'lifeState' | 'method' | 'stateDate' | 'breastfeeding' | 'consent'>>({ lifeState: 'none', method: 'combined_pill', stateDate: today, breastfeeding: false, consent: false });
  const [healthNote, setHealthNote] = useState(false);
  const explicit = useMemo(() => consentRequirement(deviceRegion()) === 'explicit', []);
  const [explicitOk, setExplicitOk] = useState(false);
  const [backupIntent, setBackupIntent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lockAvailable, setLockAvailable] = useState<boolean | undefined>();
  const [footerH, setFooterH] = useState(76);
  useEffect(() => { void deviceHasLock().then(setLockAvailable); }, []);

  const lastPeriod = lastChoice === 'today' ? today : lastChoice === 'yesterday' ? addDays(today, -1) : lastChoice === 'weekAgo' ? addDays(today, -7) : lastChoice === 'other' ? other : undefined;
  const answers: Answers = { birthDate, menarcheYear: num(menarcheText, 4), lastPeriod, usualLength: num(usualText), ...a };
  const birthCheck = validateBirthDate(birthDate, today);
  const menarcheCheck = menarcheText.length === 4 ? validateMenarcheYear(answers.menarcheYear, birthDate, year) : { ok: true as const };
  const usualCheck = validateUsualLength(answers.usualLength);
  const teen = birthCheck.ok && isTeenOn({ birthDate }, today);
  const ok = canContinue(step, answers, today) && (step !== TOTAL_STEPS - 1 || !explicit || explicitOk);
  const healthLabel = Platform.OS === 'ios' ? tr('onboarding.s5.importIos') : tr('onboarding.s5.importAndroid');

  async function finish() {
    if (!store || busy) return;
    setBusy(true);
    try {
      const w = buildOnboardingWrites(answers, today);
      await store.setProfile(w.profile);
      if (w.events.length) await store.appendMany(w.events);
      useLock.setState({ unlockedThisSession: true }); // the person is here: no lock prompt straight after setup
      if (db) await recordConsent(db, deviceClock.iso(), explicit ? 'art9-explicit' : 'standard');
      await complete();
      await refresh();
      router.replace(backupIntent ? '/settings' : '/today');
      if (healthNote) router.push('/settings/health' as never);
    } finally {
      setBusy(false);
    }
  }
  // skipping "when was your last period" leaves it empty; skipping the life state keeps "none"
  const skip = () => { if (step === 2) setLastChoice(undefined); else setA({ ...a, lifeState: 'none' }); setStep(step + 1); };
  const next = () => (step === TOTAL_STEPS - 1 ? void finish() : setStep(step + 1));

  const title = (key: string) => <Text variant="title" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34 }}>{tr(key)}</Text>;
  const needsMethod = a.lifeState === 'hormonal' || a.lifeState === 'postHormonal';
  const dateLabel = a.lifeState === 'postHormonal' ? 'onboarding.s4.whenStopped' : a.lifeState === 'postpartum' ? 'onboarding.s4.whenBirth' : a.lifeState === 'afterLoss' ? 'onboarding.s4.whenLoss' : 'onboarding.s4.whenStarted';
  const needsDate = a.lifeState === 'postHormonal' || a.lifeState === 'pregnant' || a.lifeState === 'postpartum' || a.lifeState === 'afterLoss';
  const onAccent = t.scheme === 'dark' ? t.c.bg : t.c.surface; // the same ink the filled Continue uses
  const box = (on: boolean) => (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: t.c.accent, backgroundColor: on ? t.c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on ? <Svg width={14} height={14} viewBox="0 0 14 14">{stroke(onAccent, 'M2.5 7.5L5.5 10.5L11.5 3.5', 2)}</Svg> : null}
    </View>
  );
  const group = { borderRadius: 24, backgroundColor: t.chipBg, overflow: 'hidden' as const };
  const offer = { backgroundColor: t.chipBg, borderWidth: 0, minHeight: 52 };

  // padding on both platforms shrinks the scroll view above the keyboard (the dev client is edge-to-edge on Android, where adjustResize no longer does, P3-1);
  // it does not move the absolute footer, so the footer's own bottom follows the keyboard height (which already includes the safe-area edge)
  return (
    <KeyboardAvoidingView testID="screen-onboarding" behavior="padding" style={{ flex: 1, backgroundColor: t.screenBg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + t.glass.inset + BAR + 24, paddingBottom: footerH + insets.bottom + 24, paddingHorizontal: GUTTER, gap: 16, flexGrow: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {step === 0 && (<>
          {title('onboarding.s1.title')}
          <Text>{tr('onboarding.s1.body')}</Text>
        </>)}

        {step === 1 && (<>
          {title('onboarding.s2.title')}
          <View style={{ gap: 8 }}>
            <View style={group}><DateRow label={tr('onboarding.s2.dateLabel')}><DateField testID="birth-date" value={birthDate} onChange={setBirthDate} min={addDays(today, -365 * 110)} max={today} /></DateRow></View>
            {!birthCheck.ok ? <Notice testID="birth-error" live icon={<InfoIcon color={t.c.period} size={14} />}>{birthCheck.reason === 'tooYoung' ? tr('onboarding.s2.tooYoung') : tr('onboarding.s2.invalidDate')}</Notice> : null}
            <Text variant="bodySmall" color="textSecondary">{tr('onboarding.s2.ageHelp')}</Text>
          </View>
          <TextField testID="menarche-year" label={tr('onboarding.s2.menarcheLabel')} value={menarcheText} onChangeText={(s) => setMenarcheText(digits(s).slice(0, 4))} maxLength={4} error={!menarcheCheck.ok ? tr('onboarding.s2.invalidYear') : undefined} />
          {teen ? <Notice tone="info" testID="teen-note" icon={<InfoIcon color={t.c.textSecondary} />}>{tr('onboarding.teenNote')}</Notice> : null}
        </>)}

        {step === 2 && (<>
          {title('onboarding.s3.title')}
          <Chips testIDPrefix="last" value={lastChoice} onChange={setLastChoice} options={[
            { value: 'today', label: tr('onboarding.s3.today') }, { value: 'yesterday', label: tr('onboarding.s3.yesterday') },
            { value: 'weekAgo', label: tr('onboarding.s3.weekAgo') }, { value: 'other', label: tr('onboarding.s3.other') }]} />
          {lastChoice === 'other' ? <View style={{ ...group, borderRadius: 28 }}><DateRow label={tr('onboarding.s3.startedLabel')}><DateField testID="last-date" value={other} onChange={setOther} min={addDays(today, -730)} max={today} /></DateRow></View> : null}
          {lastPeriod ? (lastChoice === 'other' ? null : <Text variant="bodySmall" color="textSecondary">{tr('onboarding.s3.chosen', { date: new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${lastPeriod}T00:00:00Z`)) })}</Text>) : <Text variant="bodySmall" color="textSecondary" accessibilityLiveRegion="polite">{tr('onboarding.s3.emptyNote')}</Text>}
          <View style={{ height: 8 }} />
          <TextField testID="usual-length" label={tr('onboarding.s3.usualLength')} value={usualText} onChangeText={(s) => setUsualText(digits(s).slice(0, 2))} maxLength={2} helper={tr('onboarding.s3.usualLengthHelp')} error={!usualCheck.ok ? tr('onboarding.s3.usualLengthInvalid') : undefined} />
        </>)}

        {step === 3 && (<>
          {title('onboarding.s4.title')}
          <OptionList testIDPrefix="life" value={a.lifeState} onChange={(v) => setA({ ...a, lifeState: v })} options={LIFE_CHOICES.map((v) => ({ value: v, label: tr(`onboarding.s4.options.${v}`) }))} />
          {needsMethod ? (<View style={{ gap: 8 }}><Text variant="bodySmall" color="textSecondary">{tr('onboarding.s4.method')}</Text>
            <Chips testIDPrefix="method" value={a.method} onChange={(m) => setA({ ...a, method: m })} options={METHODS.map((m) => ({ value: m, label: tr(`settings.lifeState.methods.${m}`) }))} /></View>) : null}
          {needsDate || a.lifeState === 'postpartum' ? (
            <View style={group}>
              {needsDate ? <DateRow label={tr(dateLabel)}><DateField testID="state-date" value={a.stateDate} onChange={(d) => setA({ ...a, stateDate: d })} min={addDays(today, -1100)} max={today} /></DateRow> : null}
              {a.lifeState === 'postpartum' ? (
                <View style={[{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16 }, needsDate ? { borderTopWidth: 1, borderTopColor: t.hairline } : null]}>
                  <Text style={{ flex: 1, fontSize: 17, lineHeight: 22 }}>{tr('settings.lifeState.breastfeeding')}</Text>
                  <Switch testID="breastfeeding" accessibilityLabel={tr('settings.lifeState.breastfeeding')} value={a.breastfeeding} onValueChange={(v) => setA({ ...a, breastfeeding: v })} trackColor={{ true: t.c.accent }} />
                </View>) : null}
            </View>) : null}
        </>)}

        {step === 4 && (<>
          {title('onboarding.s5.title')}
          <Text>{tr('legal.privacyThreeSentences')}</Text>
          {lockAvailable !== undefined ? <Text variant="bodySmall" color="textSecondary" testID="lock-explain">{tr(lockAvailable ? 'lock.explain' : 'lock.off')}</Text> : null}
          <View style={group}>
            <Pressable testID="consent" accessibilityRole="checkbox" accessibilityLabel={tr('onboarding.s5.consent')} aria-checked={a.consent} onPress={() => setA({ ...a, consent: !a.consent })}
              style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 56, paddingHorizontal: 16, paddingVertical: 12 }}>
              {box(a.consent)}
              <Text style={{ flex: 1, fontSize: 16, lineHeight: 22 }}>{tr('onboarding.s5.consent')}</Text>
            </Pressable>
            {explicit ? (
              <Pressable testID="consent-explicit" accessibilityRole="checkbox" accessibilityLabel={tr('onboarding.s5.consentExplicit')} aria-checked={explicitOk} onPress={() => setExplicitOk(!explicitOk)}
                style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.hairline }}>
                {box(explicitOk)}
                <Text style={{ flex: 1, fontSize: 16, lineHeight: 22 }}>{tr('onboarding.s5.consentExplicit')}</Text>
              </Pressable>) : null}
          </View>
          <View style={{ gap: 8, marginTop: 4 }}>
            <Button testID="health-offer" kind="secondary" label={healthLabel} style={offer} onPress={() => setHealthNote(true)}
              icon={<Svg width={20} height={20} viewBox="0 0 24 24">{stroke(t.c.accent, 'M12 20C12 20 4.5 15.4 4.5 9.9A4 4 0 0 1 12 7.6A4 4 0 0 1 19.5 9.9C19.5 15.4 12 20 12 20Z')}</Svg>} />
            {healthNote ? <Text variant="bodySmall" color="textSecondary" testID="health-note">{tr('onboarding.s5.healthLater')}</Text> : null}
            <Button testID="backup-offer" kind="secondary" label={tr('onboarding.s5.backup')} style={offer} onPress={() => setBackupIntent(true)}
              icon={<Svg width={20} height={20} viewBox="0 0 24 24">{stroke(t.c.accent, 'M7.2 18.5H17A4 4 0 0 0 17.6 10.5A5.8 5.8 0 0 0 6.4 9.8A4.4 4.4 0 0 0 7.2 18.5Z')}{stroke(t.c.accent, 'M12 16V11.5M9.8 13.4L12 11.2L14.2 13.4')}</Svg>} />
            {backupIntent ? <Text variant="bodySmall" color="textSecondary" testID="backup-note">{tr('onboarding.s5.backupHint')}</Text> : null}
          </View>
        </>)}
      </ScrollView>

      {/* floating glass header: Back on the left, the step platter in the middle, Skip on the right (optional steps only) */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + t.glass.inset, left: t.glass.inset, right: t.glass.inset, height: BAR, flexDirection: 'row', alignItems: 'center' }}>
        <View pointerEvents="box-none" style={{ minWidth: SIDE, alignItems: 'flex-start' }}>
          {step > 0 ? <GlassSurface style={{ borderRadius: BAR / 2 }}><BackButton onGlass testID="onboarding-back" onPress={() => setStep(step - 1)} /></GlassSurface> : null}
        </View>
        <View pointerEvents="box-none" style={{ flex: 1, alignItems: 'center' }}><ProgressDots step={step} total={TOTAL_STEPS} /></View>
        <View pointerEvents="box-none" style={{ minWidth: SIDE, alignItems: 'flex-end' }}>
          {step === 2 || step === 3 ? (
            <GlassSurface style={{ borderRadius: BAR / 2 }}>
              <Pressable testID="onboarding-skip" accessibilityRole="button" accessibilityLabel={tr('onboarding.skipStep')} onPress={skip} style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' }}>
                <Text color="textOnGlass" style={{ fontSize: 15, fontWeight: '600' }}>{tr('common.skip')}</Text>
              </Pressable>
            </GlassSurface>
          ) : null}
        </View>
      </View>

      {/* floating glass footer: the one filled Continue; the reason Finish does not respond sits above it (I-20, D-075) */}
      <View testID="onboarding-footer" pointerEvents="box-none" onLayout={(e) => setFooterH(e.nativeEvent.layout.height)} style={{ position: 'absolute', left: t.glass.inset, right: t.glass.inset, bottom: (keyboard > 0 ? keyboard : insets.bottom) + 8 }}>
        <GlassSurface>
          <View style={{ padding: 8, gap: 6 }}>
            {step === TOTAL_STEPS - 1 && !ok ? <Text variant="bodySmall" color="textOnGlass" testID="finish-hint" style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">{tr(explicit ? 'onboarding.s5.finishHintBoth' : 'onboarding.s5.finishHint')}</Text> : null}
            <Button testID="onboarding-continue" label={step === TOTAL_STEPS - 1 ? tr('common.finish') : tr('common.continue')} disabled={!ok || busy} onPress={next} />
          </View>
        </GlassSurface>
      </View>
    </KeyboardAvoidingView>
  );
}
