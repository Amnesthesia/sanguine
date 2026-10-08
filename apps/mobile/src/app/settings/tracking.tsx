import { useTranslation } from 'react-i18next';
import symptomCatalog from '../../../../../copy/symptoms.json';
import { effectivePrefs } from '@/data/prefs';
import { useApp } from '@/state/app';
import { Chips } from '@/ui/Chips';
import { Group, SwitchRow } from '@/ui/SettingsRow';
import { SubScreen } from '@/ui/SubScreen';
import { Text } from '@/ui/Text';

export default function TrackingScreen() {
  const { t } = useTranslation();
  const { prefs, profile, today, updatePrefs } = useApp();
  const eff = effectivePrefs(prefs, profile.birthYear, Number(today.slice(0, 4)));
  const toggleSymptom = (code: string, on: boolean) => {
    const set = new Set(prefs.symptoms);
    if (on) set.add(code); else set.delete(code);
    void updatePrefs({ symptoms: symptomCatalog.symptoms.map((s) => s.code).filter((c) => set.has(c)) });
  };
  return (
    <SubScreen testID="screen-tracking" title={t('settings.tracking.title')}>
      <Text variant="heading" accessibilityRole="header">{t('settings.tracking.symptoms')}</Text>
      <Group>
        {symptomCatalog.symptoms.map((s, i) => (
          <SwitchRow key={s.code} testID={`track-${s.code}`} title={t(`symptom.${s.code}`)} value={prefs.symptoms.includes(s.code)} onChange={(v) => toggleSymptom(s.code, v)} last={i === symptomCatalog.symptoms.length - 1} />
        ))}
      </Group>
      <Text variant="heading" accessibilityRole="header">{t('settings.tracking.temperatureUnit')}</Text>
      <Chips testIDPrefix="unit" value={prefs.tempUnit} onChange={(v) => void updatePrefs({ tempUnit: v })} options={[{ value: 'C', label: t('settings.tracking.celsius') }, { value: 'F', label: t('settings.tracking.fahrenheit') }]} />
      <Text variant="heading" accessibilityRole="header">{t('settings.tracking.temperatureSource')}</Text>
      <Chips testIDPrefix="source" value={prefs.tempSource} onChange={(v) => void updatePrefs({ tempSource: v })} options={(['oral', 'vaginal', 'wrist', 'finger', 'other'] as const).map((s) => ({ value: s, label: t(`log.temperatureSource.${s}`) }))} />
      <Group>
        <SwitchRow testID="track-sex" title={t('settings.tracking.sexLogging')} description={t('settings.tracking.sexLoggingDesc')} value={prefs.sexLogging} onChange={(v) => void updatePrefs({ sexLogging: v })} />
        <SwitchRow
          testID="track-estimate" title={t('settings.tracking.ovulationEstimate')} description={eff.teen ? t('settings.tracking.teenLocked') : t('settings.tracking.ovulationEstimateDesc')}
          value={eff.teen ? prefs.teenUnlockEstimate && prefs.showOvulationEstimate : prefs.showOvulationEstimate}
          onChange={(v) => void updatePrefs(eff.teen ? { teenUnlockEstimate: v, showOvulationEstimate: v } : { showOvulationEstimate: v })} last />
      </Group>
    </SubScreen>
  );
}
