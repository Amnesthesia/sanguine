import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import symptomCatalog from '../../../../../copy/symptoms.json';
import { effectivePrefs } from '@/data/prefs';
import { useApp } from '@/state/app';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Chips } from '@/ui/Chips';
import { Group, SwitchRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

/** One symptom as a toggle chip (checkbox semantics): the selected state is the tint, the border and a check mark, never colour alone. */
function SymptomChip({ code, label, on, onChange }: { code: string; label: string; on: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Pressable
      testID={`track-${code}`} accessibilityRole="checkbox" accessibilityLabel={label} aria-checked={on} accessibilityState={{ checked: on }} onPress={() => onChange(!on)}
      style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: on ? t.c.accentSoft : t.chipBg, borderWidth: 1.5, borderColor: on ? t.c.accent : 'transparent' }}>
      {on ? <Svg width={12} height={12} viewBox="0 0 12 12" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Path d="M2 6.3L4.8 9L10 3" fill="none" stroke={t.c.onAccentSoft} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg> : null}
      <Text variant="bodySmall" color={on ? 'onAccentSoft' : 'textPrimary'} style={{ fontWeight: on ? '600' : '400' }}>{label}</Text>
    </Pressable>
  );
}

export default function TrackingScreen() {
  const { t } = useTranslation();
  const { prefs, profile, today, updatePrefs } = useApp();
  const eff = effectivePrefs(prefs, profile, today);
  const toggleSymptom = (code: string, on: boolean) => {
    const set = new Set(prefs.symptoms);
    if (on) set.add(code); else set.delete(code);
    void updatePrefs({ symptoms: symptomCatalog.symptoms.map((s) => s.code).filter((c) => set.has(c)) });
  };
  // the uncertain-estimates switch is an ovulation-estimate option: not shown while that estimate is off, nor in teen mode (D-124)
  const showUncertain = eff.showOvulationEstimate && !eff.teen;
  return (
    <SubScreen testID="screen-tracking" title={t('settings.tracking.title')}>
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <Text variant="heading" accessibilityRole="header" style={{ flex: 1 }}>{t('settings.tracking.symptoms')}</Text>
          <Text variant="bodySmall" color="textSecondary">{t('settings.summary.symptomsN', { n: prefs.symptoms.length })}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {symptomCatalog.symptoms.map((s) => (
            <SymptomChip key={s.code} code={s.code} label={t(`symptom.${s.code}`)} on={prefs.symptoms.includes(s.code)} onChange={(v) => toggleSymptom(s.code, v)} />
          ))}
        </View>
      </Card>
      <Card style={{ gap: 12 }}>
        <Text variant="heading" accessibilityRole="header">{t('settings.tracking.temperatureUnit')}</Text>
        <Chips testIDPrefix="unit" value={prefs.tempUnit} onChange={(v) => void updatePrefs({ tempUnit: v })} options={[{ value: 'C', label: t('settings.tracking.celsius') }, { value: 'F', label: t('settings.tracking.fahrenheit') }]} />
        <Text variant="heading" accessibilityRole="header">{t('settings.tracking.temperatureSource')}</Text>
        <Chips testIDPrefix="source" value={prefs.tempSource} onChange={(v) => void updatePrefs({ tempSource: v })} options={(['oral', 'vaginal', 'wrist', 'finger', 'other'] as const).map((s) => ({ value: s, label: t(`log.temperatureSource.${s}`) }))} />
      </Card>
      <Group>
        <SwitchRow testID="track-symptom-note" title={t('settings.tracking.symptomNote')} description={t('settings.tracking.symptomNoteDesc')} value={prefs.symptomNote} onChange={(v) => void updatePrefs({ symptomNote: v })} />
        <SwitchRow testID="track-guidance" title={t('settings.tracking.guidance')} description={t('settings.tracking.guidanceDesc')} value={prefs.cycleGuidance} onChange={(v) => void updatePrefs({ cycleGuidance: v })} />
        <SwitchRow testID="track-sex" title={t('settings.tracking.sexLogging')} description={t('settings.tracking.sexLoggingDesc')} value={prefs.sexLogging} onChange={(v) => void updatePrefs({ sexLogging: v })} />
        <SwitchRow
          testID="track-estimate" title={t('settings.tracking.ovulationEstimate')} description={eff.teen ? t('settings.tracking.teenLocked') : t('settings.tracking.ovulationEstimateDesc')}
          value={eff.teen ? prefs.teenUnlockEstimate && prefs.showOvulationEstimate : prefs.showOvulationEstimate}
          onChange={(v) => void updatePrefs(eff.teen ? { teenUnlockEstimate: v, showOvulationEstimate: v } : { showOvulationEstimate: v })} last={!showUncertain} />
        {showUncertain ? <SwitchRow testID="track-uncertain" title={t('settings.tracking.uncertainEstimates')} description={t('settings.tracking.uncertainEstimatesDesc')} value={prefs.showUncertainEstimates} onChange={(v) => void updatePrefs({ showUncertainEstimates: v })} last /> : null}
      </Group>
    </SubScreen>
  );
}
